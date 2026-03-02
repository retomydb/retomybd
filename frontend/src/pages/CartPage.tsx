import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { purchasesApi, paymentsApi, getApiError } from '../services/api';
import { useAuthStore, useCartStore } from '../store/authStore';
import { FiTrash2, FiShoppingCart, FiPackage, FiArrowRight, FiCreditCard } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function CartPage() {
  const { isAuthenticated } = useAuthStore();
  const { items, total, loadCart, removeItem } = useCartStore();
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    init();
  }, []);

  const init = async () => {
    await loadCart();
    setLoading(false);
  };

  const handleRemove = async (cartItemId: string) => {
    try {
      await removeItem(cartItemId);
      toast.success('Removed from cart');
    } catch {
      toast.error('Failed to remove');
    }
  };

  const handleCheckout = async () => {
    setPurchasing(true);
    try {
      const dataset_ids = items.map((item: any) => item.DatasetId);

      // Use Stripe Checkout for the whole cart
      const { data } = await paymentsApi.createCheckoutSession(dataset_ids);

      if (data.checkout_url) {
        // Redirect to Stripe
        window.location.href = data.checkout_url;
        return;
      }

      if (data.free) {
        // All items were free — already granted
        toast.success(data.message || 'All free datasets granted!');
        await loadCart();
        navigate('/dashboard');
        return;
      }
    } catch (e: any) {
      toast.error(getApiError(e, 'Checkout failed'));
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-retomy-bg-hover rounded w-1/4" />
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-retomy-bg-hover rounded" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-retomy-text-bright mb-6 flex items-center gap-3">
        <FiShoppingCart /> Shopping Cart
        {items.length > 0 && <span className="text-sm font-normal text-retomy-text-secondary">({items.length} items)</span>}
      </h1>

      {items.length === 0 ? (
        <div className="card p-12 text-center">
          <FiShoppingCart className="mx-auto text-retomy-text-secondary mb-3" size={48} />
          <h2 className="text-lg font-semibold text-retomy-text-bright mb-2">Your cart is empty</h2>
          <p className="text-sm text-retomy-text-secondary mb-4">Browse our marketplace to find datasets you need.</p>
          <Link to="/browse" className="btn-primary inline-flex items-center gap-2">
            Browse Datasets <FiArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-3">
            {items.map((item: any) => (
              <div key={item.CartItemId} className="card p-4 flex items-center gap-4">
                <div className="w-16 h-16 rounded bg-retomy-bg-hover flex items-center justify-center flex-shrink-0">
                  {item.ThumbnailUrl ? (
                    <img src={item.ThumbnailUrl} alt="" className="w-full h-full rounded object-cover" />
                  ) : (
                    <FiPackage className="text-retomy-accent/40" size={20} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link to={`/dataset/${item.DatasetId}`} className="font-medium text-sm text-retomy-text-bright hover:text-retomy-accent truncate block">
                    {item.Title}
                  </Link>
                  <p className="text-xs text-retomy-text-secondary mt-0.5">{item.SellerName} · {item.FileFormat?.toUpperCase()}</p>
                </div>
                <div className="text-right flex items-center gap-4">
                  <p className="font-bold text-retomy-text-bright">
                    {Number(item.Price || 0) === 0 || item.PricingModel === 'free'
                      ? <span className="text-retomy-accent text-sm">Free</span>
                      : `$${Number(item.Price || 0).toFixed(2)}`}
                  </p>
                  <button onClick={() => handleRemove(item.DatasetId)} className="text-retomy-text-secondary hover:text-red-400 transition-colors p-1" title="Remove">
                    <FiTrash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="card p-6 h-fit sticky top-20">
            <h2 className="font-semibold text-retomy-text-bright mb-4">Order Summary</h2>
            <div className="space-y-2 mb-4 text-sm">
              <div className="flex justify-between">
                <span className="text-retomy-text-secondary">Subtotal ({items.length} items)</span>
                <span className="text-retomy-text-bright">${total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-retomy-text-secondary">Processing Fee</span>
                <span className="text-retomy-text-bright">$0.00</span>
              </div>
              <div className="border-t border-retomy-border/30 pt-2 flex justify-between font-semibold">
                <span className="text-retomy-text-bright">Total</span>
                <span className="text-retomy-accent text-lg">${total.toFixed(2)}</span>
              </div>
            </div>
            <button
              onClick={handleCheckout}
              disabled={purchasing}
              className="btn-success w-full flex items-center justify-center gap-2"
            >
              {purchasing ? (
                <span className="animate-spin">⟳</span>
              ) : (
                <><FiCreditCard size={14} /> {total > 0 ? 'Checkout with Stripe' : 'Get Free Access'}</>
              )}
            </button>
            <p className="text-[10px] text-retomy-text-secondary text-center mt-3">
              {total > 0
                ? 'You will be securely redirected to Stripe to complete payment'
                : 'By completing this you agree to our Terms of Service'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
