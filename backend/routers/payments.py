"""
retomY — Stripe Payments Router
Handles Checkout Sessions, Webhooks, and Seller Connect Onboarding
"""
import json
import uuid
import stripe
import structlog
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from pydantic import BaseModel, Field
from typing import List, Optional
from core.config import get_settings
from core.security import get_current_user
from core.database import execute_query
from core.storage import generate_presigned_url

logger = structlog.get_logger()
settings = get_settings()
router = APIRouter(prefix="/payments", tags=["Payments"])

# Configure Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


# =============================================================================
# REQUEST MODELS
# =============================================================================

class CreateCheckoutRequest(BaseModel):
    dataset_ids: List[str] = Field(..., min_length=1)


class SingleCheckoutRequest(BaseModel):
    dataset_id: str


# =============================================================================
# HELPERS
# =============================================================================

def get_or_create_stripe_customer(user: dict) -> str:
    """Get existing or create a new Stripe Customer for the user."""
    user_id = str(user["UserId"])

    row = execute_query(
        "SELECT StripeCustomerId FROM retomy.Users WHERE UserId = ?",
        [user_id], fetch="one"
    )

    if row and row.get("StripeCustomerId"):
        return row["StripeCustomerId"]

    # Create new Stripe customer
    customer = stripe.Customer.create(
        email=user.get("Email", ""),
        name=f"{user.get('FirstName', '')} {user.get('LastName', '')}".strip(),
        metadata={"retomy_user_id": user_id},
    )

    execute_query(
        "UPDATE retomy.Users SET StripeCustomerId = ? WHERE UserId = ?",
        [customer.id, user_id], fetch="none"
    )

    return customer.id


def fulfill_checkout(session_id: str):
    """
    Called after Stripe confirms payment.
    Creates Purchase + Entitlement records for each dataset in the session.
    """
    # Get session details
    checkout_session = execute_query(
        "SELECT UserId, DatasetIds, TotalAmount, Currency FROM retomy.CheckoutSessions WHERE SessionId = ? AND Status = 'pending'",
        [session_id], fetch="one"
    )

    if not checkout_session:
        logger.warning("checkout_session_not_found_or_already_completed", session_id=session_id)
        return

    user_id = str(checkout_session["UserId"])
    dataset_ids = json.loads(checkout_session["DatasetIds"])
    commission_rate = settings.PLATFORM_COMMISSION_RATE

    for dataset_id in dataset_ids:
        # Get dataset info
        dataset = execute_query(
            "SELECT DatasetId, SellerId, Price, Currency FROM retomy.Datasets WHERE DatasetId = ? AND DeletedAt IS NULL",
            [dataset_id], fetch="one"
        )
        if not dataset:
            continue

        price = float(dataset.get("Price", 0))
        platform_fee = round(price * commission_rate, 2)
        seller_earnings = round(price - platform_fee, 2)
        purchase_id = str(uuid.uuid4())
        invoice_number = f"INV-{uuid.uuid4().hex[:8].upper()}"
        license_key = f"LK-{uuid.uuid4().hex[:12].upper()}"

        # Check if already purchased (idempotency)
        existing = execute_query(
            "SELECT PurchaseId FROM retomy.Purchases WHERE BuyerId = ? AND DatasetId = ? AND Status = 'completed'",
            [user_id, dataset_id], fetch="one"
        )
        if existing:
            continue

        # Create purchase record
        execute_query(
            """INSERT INTO retomy.Purchases
               (PurchaseId, BuyerId, DatasetId, SellerId, Amount, PlatformFee, SellerEarnings,
                Currency, PaymentMethod, PaymentRef, Status, StripeSessionId,
                InvoiceNumber, LicenseKey, CompletedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'stripe', ?, 'completed', ?, ?, ?, SYSUTCDATETIME())""",
            [purchase_id, user_id, dataset_id, str(dataset["SellerId"]),
             price, platform_fee, seller_earnings,
             dataset.get("Currency", "USD"), session_id, session_id,
             invoice_number, license_key],
            fetch="none"
        )

        # Create entitlement
        entitlement_id = str(uuid.uuid4())
        execute_query(
            """INSERT INTO retomy.Entitlements
               (EntitlementId, UserId, DatasetId, PurchaseId, AccessType, IsActive, GrantedAt, ExpiresAt)
               VALUES (?, ?, ?, ?, 'full', 1, SYSUTCDATETIME(), NULL)""",
            [entitlement_id, user_id, dataset_id, purchase_id],
            fetch="none"
        )

        # Update dataset download count
        execute_query(
            "UPDATE retomy.Datasets SET TotalDownloads = ISNULL(TotalDownloads, 0) + 1 WHERE DatasetId = ?",
            [dataset_id], fetch="none"
        )

        logger.info("purchase_fulfilled", purchase_id=purchase_id, dataset_id=dataset_id, user_id=user_id)

    # Mark checkout session as completed
    execute_query(
        "UPDATE retomy.CheckoutSessions SET Status = 'completed', CompletedAt = SYSUTCDATETIME() WHERE SessionId = ?",
        [session_id], fetch="none"
    )

    # Clear purchased items from cart
    for dataset_id in dataset_ids:
        execute_query(
            "DELETE FROM retomy.CartItems WHERE UserId = ? AND DatasetId = ?",
            [user_id, dataset_id], fetch="none"
        )


# =============================================================================
# CHECKOUT ENDPOINTS
# =============================================================================

@router.post("/create-checkout-session")
async def create_checkout_session(
    body: CreateCheckoutRequest,
    user: dict = Depends(get_current_user),
):
    """Create a Stripe Checkout Session for one or more datasets."""
    if not settings.STRIPE_SECRET_KEY or settings.STRIPE_SECRET_KEY.startswith("sk_test_REPLACE"):
        raise HTTPException(status_code=503, detail="Stripe is not configured. Please add your Stripe keys to .env")

    user_id = str(user["UserId"])
    customer_id = get_or_create_stripe_customer(user)
    line_items = []
    dataset_ids_valid = []
    total_amount = 0

    for dataset_id in body.dataset_ids:
        dataset = execute_query(
            """SELECT d.DatasetId, d.Title, d.Price, d.Currency, d.PricingModel, d.SellerId,
                      d.ShortDescription, d.ThumbnailUrl
               FROM retomy.Datasets d
               WHERE d.DatasetId = ? AND d.Status = 'published' AND d.DeletedAt IS NULL""",
            [dataset_id], fetch="one"
        )

        if not dataset:
            raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found or not available")

        # Don't let user buy own dataset
        if str(dataset["SellerId"]) == user_id:
            raise HTTPException(status_code=400, detail=f"Cannot purchase your own dataset: {dataset['Title']}")

        # Check if already purchased
        existing = execute_query(
            "SELECT PurchaseId FROM retomy.Purchases WHERE BuyerId = ? AND DatasetId = ? AND Status = 'completed'",
            [user_id, dataset_id], fetch="one"
        )
        if existing:
            raise HTTPException(status_code=409, detail=f"You already own: {dataset['Title']}")

        price = float(dataset.get("Price", 0))
        is_free = price == 0 or dataset.get("PricingModel") == "free"

        if is_free:
            # Process free datasets directly — no Stripe needed
            fulfill_free_dataset(user_id, dataset)
            continue

        total_amount += price
        dataset_ids_valid.append(dataset_id)

        line_items.append({
            "price_data": {
                "currency": (dataset.get("Currency") or "USD").lower(),
                "product_data": {
                    "name": dataset["Title"],
                    "description": (dataset.get("ShortDescription") or "Dataset purchase")[:500],
                    **({"images": [dataset["ThumbnailUrl"]]} if dataset.get("ThumbnailUrl") and dataset["ThumbnailUrl"].startswith("http") else {}),
                },
                "unit_amount": int(price * 100),  # Stripe expects cents
            },
            "quantity": 1,
        })

    if not line_items:
        # All datasets were free — already fulfilled
        return {"message": "All free datasets granted!", "free": True, "redirect_url": None}

    # Store checkout session in DB
    session_id_placeholder = f"pending_{uuid.uuid4().hex[:16]}"

    # Create Stripe Checkout Session
    try:
        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=line_items,
            mode="payment",
            success_url=f"{settings.FRONTEND_URL}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{settings.FRONTEND_URL}/checkout/cancel",
            metadata={
                "retomy_user_id": user_id,
                "dataset_ids": json.dumps(dataset_ids_valid),
            },
            payment_intent_data={
                "metadata": {
                    "retomy_user_id": user_id,
                    "dataset_ids": json.dumps(dataset_ids_valid),
                },
            },
        )
    except stripe.StripeError as e:
        logger.error("stripe_checkout_error", error=str(e))
        raise HTTPException(status_code=502, detail=f"Payment service error: {str(e)}")

    # Save checkout session to DB
    execute_query(
        """INSERT INTO retomy.CheckoutSessions (SessionId, UserId, DatasetIds, TotalAmount, Currency, Status)
           VALUES (?, ?, ?, ?, 'USD', 'pending')""",
        [checkout_session.id, user_id, json.dumps(dataset_ids_valid), total_amount],
        fetch="none"
    )

    return {
        "checkout_url": checkout_session.url,
        "session_id": checkout_session.id,
    }


@router.post("/create-single-checkout")
async def create_single_checkout(
    body: SingleCheckoutRequest,
    user: dict = Depends(get_current_user),
):
    """Convenience: Create checkout for a single dataset (wraps create-checkout-session)."""
    return await create_checkout_session(
        body=CreateCheckoutRequest(dataset_ids=[body.dataset_id]),
        user=user,
    )


def fulfill_free_dataset(user_id: str, dataset: dict):
    """Grant instant access for free datasets (no Stripe needed)."""
    dataset_id = str(dataset["DatasetId"])

    # Check if already have access
    existing = execute_query(
        "SELECT PurchaseId FROM retomy.Purchases WHERE BuyerId = ? AND DatasetId = ? AND Status = 'completed'",
        [user_id, dataset_id], fetch="one"
    )
    if existing:
        return  # Already owns it

    purchase_id = str(uuid.uuid4())
    entitlement_id = str(uuid.uuid4())
    invoice_number = f"INV-{uuid.uuid4().hex[:8].upper()}"
    license_key = f"LK-{uuid.uuid4().hex[:12].upper()}"

    execute_query(
        """INSERT INTO retomy.Purchases
           (PurchaseId, BuyerId, DatasetId, SellerId, Amount, PlatformFee, SellerEarnings,
            Currency, PaymentMethod, PaymentRef, Status, InvoiceNumber, LicenseKey, CompletedAt)
           VALUES (?, ?, ?, ?, 0, 0, 0, 'USD', 'free', 'free', 'completed', ?, ?, SYSUTCDATETIME())""",
        [purchase_id, user_id, dataset_id, str(dataset["SellerId"]),
         invoice_number, license_key],
        fetch="none"
    )

    execute_query(
        """INSERT INTO retomy.Entitlements
           (EntitlementId, UserId, DatasetId, PurchaseId, AccessType, IsActive, GrantedAt, ExpiresAt)
           VALUES (?, ?, ?, ?, 'full', 1, SYSUTCDATETIME(), NULL)""",
        [entitlement_id, user_id, dataset_id, purchase_id],
        fetch="none"
    )

    logger.info("free_dataset_granted", dataset_id=dataset_id, user_id=user_id)


# =============================================================================
# CHECKOUT STATUS
# =============================================================================

@router.get("/checkout-status/{session_id}")
async def get_checkout_status(
    session_id: str,
    user: dict = Depends(get_current_user),
):
    """Check the status of a checkout session."""
    session_record = execute_query(
        "SELECT SessionId, Status, DatasetIds, TotalAmount, CompletedAt FROM retomy.CheckoutSessions WHERE SessionId = ? AND UserId = ?",
        [session_id, str(user["UserId"])], fetch="one"
    )

    if not session_record:
        raise HTTPException(status_code=404, detail="Session not found")

    for k, v in session_record.items():
        if hasattr(v, "isoformat"):
            session_record[k] = v.isoformat()
        elif hasattr(v, "__float__"):
            session_record[k] = float(v)

    return {"session": session_record}


# =============================================================================
# STRIPE WEBHOOK
# =============================================================================

@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    # If webhook secret is configured, verify signature
    if settings.STRIPE_WEBHOOK_SECRET and not settings.STRIPE_WEBHOOK_SECRET.startswith("whsec_REPLACE"):
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid payload")
        except stripe.SignatureVerificationError:
            raise HTTPException(status_code=400, detail="Invalid signature")
    else:
        # Dev mode — no signature verification
        try:
            event = stripe.Event.construct_from(json.loads(payload), stripe.api_key)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid payload")

    # Handle the event
    event_type = event.get("type", "")
    logger.info("stripe_webhook_received", event_type=event_type)

    if event_type == "checkout.session.completed":
        session = event["data"]["object"]
        session_id = session.get("id")
        payment_status = session.get("payment_status")

        if payment_status == "paid":
            try:
                fulfill_checkout(session_id)
                logger.info("checkout_fulfilled", session_id=session_id)
            except Exception as e:
                logger.error("checkout_fulfillment_failed", session_id=session_id, error=str(e))

    elif event_type == "checkout.session.expired":
        session = event["data"]["object"]
        session_id = session.get("id")
        execute_query(
            "UPDATE retomy.CheckoutSessions SET Status = 'expired' WHERE SessionId = ?",
            [session_id], fetch="none"
        )

    return {"received": True}


# =============================================================================
# STRIPE CONNECT — SELLER ONBOARDING
# =============================================================================

@router.post("/connect/onboard")
async def start_seller_onboarding(
    user: dict = Depends(get_current_user),
):
    """Create a Stripe Connect account for the seller and return onboarding URL."""
    if not settings.STRIPE_SECRET_KEY or settings.STRIPE_SECRET_KEY.startswith("sk_test_REPLACE"):
        raise HTTPException(status_code=503, detail="Stripe is not configured")

    user_id = str(user["UserId"])

    # Check if already has Connect account
    row = execute_query(
        "SELECT StripeConnectAccountId, StripeConnectOnboarded FROM retomy.Users WHERE UserId = ?",
        [user_id], fetch="one"
    )

    if row and row.get("StripeConnectAccountId"):
        account_id = row["StripeConnectAccountId"]

        # If already onboarded, return dashboard link
        if row.get("StripeConnectOnboarded"):
            login_link = stripe.Account.create_login_link(account_id)
            return {
                "onboarded": True,
                "dashboard_url": login_link.url,
                "message": "Already connected! Opening Stripe Dashboard."
            }
    else:
        # Create new Connect account
        try:
            account = stripe.Account.create(
                type="express",
                email=user.get("Email", ""),
                metadata={"retomy_user_id": user_id},
                capabilities={
                    "card_payments": {"requested": True},
                    "transfers": {"requested": True},
                },
            )
            account_id = account.id

            execute_query(
                "UPDATE retomy.Users SET StripeConnectAccountId = ? WHERE UserId = ?",
                [account_id, user_id], fetch="none"
            )
        except stripe.StripeError as e:
            logger.error("connect_account_creation_failed", error=str(e))
            raise HTTPException(status_code=502, detail=f"Failed to create payment account: {str(e)}")

    # Create onboarding link
    try:
        account_link = stripe.AccountLink.create(
            account=account_id,
            refresh_url=f"{settings.FRONTEND_URL}/seller?stripe=refresh",
            return_url=f"{settings.FRONTEND_URL}/seller?stripe=success",
            type="account_onboarding",
        )
        return {
            "onboarded": False,
            "onboarding_url": account_link.url,
            "message": "Complete your Stripe Connect setup to receive payouts."
        }
    except stripe.StripeError as e:
        logger.error("connect_onboarding_link_failed", error=str(e))
        raise HTTPException(status_code=502, detail=f"Failed to create onboarding link: {str(e)}")


@router.get("/connect/status")
async def get_connect_status(
    user: dict = Depends(get_current_user),
):
    """Check seller's Stripe Connect status."""
    user_id = str(user["UserId"])

    row = execute_query(
        "SELECT StripeConnectAccountId, StripeConnectOnboarded FROM retomy.Users WHERE UserId = ?",
        [user_id], fetch="one"
    )

    if not row or not row.get("StripeConnectAccountId"):
        return {"connected": False, "onboarded": False, "account_id": None}

    account_id = row["StripeConnectAccountId"]

    # Check with Stripe if onboarding is complete
    try:
        account = stripe.Account.retrieve(account_id)
        is_onboarded = account.get("charges_enabled", False) and account.get("payouts_enabled", False)

        if is_onboarded and not row.get("StripeConnectOnboarded"):
            execute_query(
                "UPDATE retomy.Users SET StripeConnectOnboarded = 1 WHERE UserId = ?",
                [user_id], fetch="none"
            )

        return {
            "connected": True,
            "onboarded": is_onboarded,
            "account_id": account_id,
            "charges_enabled": account.get("charges_enabled", False),
            "payouts_enabled": account.get("payouts_enabled", False),
        }
    except stripe.StripeError:
        return {"connected": True, "onboarded": bool(row.get("StripeConnectOnboarded")), "account_id": account_id}


# =============================================================================
# STRIPE CONFIG (public — returns publishable key)
# =============================================================================

@router.get("/config")
async def get_stripe_config():
    """Return Stripe publishable key for frontend."""
    key = settings.STRIPE_PUBLISHABLE_KEY
    if not key or key.startswith("pk_test_REPLACE"):
        return {"publishable_key": None, "configured": False}
    return {"publishable_key": key, "configured": True}
