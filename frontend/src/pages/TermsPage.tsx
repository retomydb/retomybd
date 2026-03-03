import { Link } from 'react-router-dom';

const EFFECTIVE_DATE = 'January 1, 2025';
const LAST_UPDATED = 'March 1, 2026';

export default function TermsPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="bg-hero-gradient border-b border-retomy-border/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h1 className="text-4xl font-extrabold text-retomy-text-bright mb-3">Terms of Service</h1>
          <p className="text-retomy-text-secondary">
            Effective Date: {EFFECTIVE_DATE} &middot; Last Updated: {LAST_UPDATED}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="prose prose-retomy space-y-10">
          {/* 1 */}
          <div>
            <h2 className="text-xl font-bold text-retomy-text-bright mb-3">1. Agreement to Terms</h2>
            <p className="text-retomy-text-secondary leading-relaxed mb-3">
              By accessing or using the retomY platform ("Service"), operated by retomY Inc. ("Company," "we," "us," or "our"),
              you ("User," "you," or "your") agree to be bound by these Terms of Service ("Terms"). If you do not agree
              to these Terms, you may not access or use the Service.
            </p>
            <p className="text-retomy-text-secondary leading-relaxed">
              These Terms apply to all visitors, registered users, buyers, sellers, API consumers, and any other
              persons who access or use the Service. By creating an account, listing data, purchasing data,
              or otherwise engaging with retomY, you represent that you have the legal capacity to enter into a
              binding agreement and that you accept these Terms in their entirety.
            </p>
          </div>

          {/* 2 */}
          <div>
            <h2 className="text-xl font-bold text-retomy-text-bright mb-3">2. Description of Service</h2>
            <p className="text-retomy-text-secondary leading-relaxed mb-3">
              retomY is an online marketplace that enables data producers ("Sellers") to list, price, and distribute
              data, and data consumers ("Buyers") to discover, evaluate, purchase, and download those data.
              The Service includes, but is not limited to:
            </p>
            <ul className="list-disc list-inside text-retomy-text-secondary space-y-1 ml-4">
              <li>Data listing, search, and discovery tools</li>
              <li>Secure file hosting and delivery via Azure Blob Storage</li>
              <li>Payment processing through Stripe and platform credits</li>
              <li>Seller dashboards, analytics, and payout management</li>
              <li>Buyer dashboards, order history, and review submission</li>
              <li>API access for programmatic data retrieval</li>
            </ul>
          </div>

          {/* 3 */}
          <div>
            <h2 className="text-xl font-bold text-retomy-text-bright mb-3">3. Account Registration & Security</h2>
            <p className="text-retomy-text-secondary leading-relaxed mb-3">
              To use certain features of the Service, you must create an account. You agree to provide accurate,
              current, and complete information during registration, and to update such information as necessary.
              You are solely responsible for maintaining the confidentiality of your account credentials and for
              all activity that occurs under your account.
            </p>
            <p className="text-retomy-text-secondary leading-relaxed">
              You must immediately notify retomY of any unauthorized use of your account or any other breach of security.
              retomY will not be liable for any loss or damage arising from your failure to protect your account information.
              We reserve the right to suspend or terminate accounts that we reasonably believe have been compromised
              or are being used in violation of these Terms.
            </p>
          </div>

          {/* 4 */}
          <div>
            <h2 className="text-xl font-bold text-retomy-text-bright mb-3">4. Seller Obligations</h2>
            <p className="text-retomy-text-secondary leading-relaxed mb-3">
              If you list data for sale on retomY, you represent and warrant that:
            </p>
            <ul className="list-disc list-inside text-retomy-text-secondary space-y-1 ml-4 mb-3">
              <li>You have all necessary rights, licenses, consents, and permissions to distribute the data</li>
              <li>The data does not infringe upon the intellectual property, privacy, or other rights of any third party</li>
              <li>The data does not contain personally identifiable information (PII) unless explicitly disclosed and lawfully collected</li>
              <li>Your data listing description is accurate, complete, and not misleading</li>
              <li>Your data listing includes a full description of at least 100 words</li>
              <li>You comply with all applicable laws, regulations, and industry standards</li>
            </ul>
            <p className="text-retomy-text-secondary leading-relaxed">
              retomY reserves the right to review, reject, or remove any data listing that violates these Terms,
              infringes on third-party rights, contains prohibited content, or is otherwise deemed inappropriate at
              our sole discretion. Repeated violations may result in account suspension or permanent ban.
            </p>
          </div>

          {/* 5 */}
          <div>
            <h2 className="text-xl font-bold text-retomy-text-bright mb-3">5. Buyer Obligations</h2>
            <p className="text-retomy-text-secondary leading-relaxed mb-3">
              When you purchase data through retomY, you agree to:
            </p>
            <ul className="list-disc list-inside text-retomy-text-secondary space-y-1 ml-4 mb-3">
              <li>Use the data only in accordance with the license type specified in the listing</li>
              <li>Not redistribute, resell, or sublicense the data unless the license explicitly permits it</li>
              <li>Not attempt to reverse-engineer, de-anonymize, or re-identify data subjects where applicable</li>
              <li>Report any data quality issues, licensing concerns, or ethical violations through our support channels</li>
            </ul>
            <p className="text-retomy-text-secondary leading-relaxed">
              All sales are final unless otherwise stated in the data listing or required by applicable consumer
              protection laws. retomY may, at its discretion, facilitate refunds or dispute resolution between
              Buyers and Sellers in cases of material misrepresentation or defective delivery.
            </p>
          </div>

          {/* 6 */}
          <div>
            <h2 className="text-xl font-bold text-retomy-text-bright mb-3">6. Pricing, Payments & Fees</h2>
            <p className="text-retomy-text-secondary leading-relaxed mb-3">
              Sellers set the prices for their datasets. retomY charges a platform commission on each sale, which is
              deducted from the Seller's payout. The current commission rate is displayed in the Seller Dashboard and
              may be updated with reasonable notice. Payments are processed by Stripe. By using retomY's payment
              features, you also agree to Stripe's terms of service.
            </p>
            <p className="text-retomy-text-secondary leading-relaxed">
              retomY also offers a credit-based system. Credits can be purchased and used to acquire datasets. Credit
              balances are non-refundable and non-transferable unless required by applicable law. We reserve the right
              to modify pricing structures, commission rates, and credit policies with advance notice.
            </p>
          </div>

          {/* 7 */}
          <div>
            <h2 className="text-xl font-bold text-retomy-text-bright mb-3">7. Intellectual Property</h2>
            <p className="text-retomy-text-secondary leading-relaxed mb-3">
              The retomY platform — including its design, logos, trademarks, software, APIs, documentation, and
              proprietary algorithms — is the exclusive property of retomY Inc. and is protected by applicable
              intellectual property laws. You may not copy, modify, distribute, or create derivative works of any
              part of the platform without our prior written consent.
            </p>
            <p className="text-retomy-text-secondary leading-relaxed">
              Sellers retain all intellectual property rights to the data they list. By listing data on retomY,
              you grant retomY a non-exclusive, worldwide, royalty-free license to host, display, cache, and transmit
              the data metadata and preview samples for the purpose of operating the marketplace. This license
              terminates when you remove the listing from the platform.
            </p>
          </div>

          {/* 8 */}
          <div>
            <h2 className="text-xl font-bold text-retomy-text-bright mb-3">8. Prohibited Conduct</h2>
            <p className="text-retomy-text-secondary leading-relaxed mb-3">
              You agree not to:
            </p>
            <ul className="list-disc list-inside text-retomy-text-secondary space-y-1 ml-4">
              <li>Upload malicious software, viruses, or harmful code</li>
              <li>Scrape, crawl, or use automated means to access the Service without authorization</li>
              <li>Circumvent or attempt to circumvent security measures, access controls, or payment mechanisms</li>
              <li>Engage in fraudulent activity, including fake reviews, shill purchases, or manipulated download counts</li>
              <li>Harass, threaten, or abuse other users of the platform</li>
              <li>List or distribute illegal content, including stolen data, child exploitation material, or data obtained through unauthorized access</li>
              <li>Use the platform for money laundering, sanctions evasion, or any activity prohibited by applicable law</li>
            </ul>
          </div>

          {/* 9 */}
          <div>
            <h2 className="text-xl font-bold text-retomy-text-bright mb-3">9. Limitation of Liability</h2>
            <p className="text-retomy-text-secondary leading-relaxed mb-3">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, RETOMY INC. AND ITS OFFICERS, DIRECTORS, EMPLOYEES,
              AGENTS, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
              PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, REVENUE, GOODWILL, OR BUSINESS
              OPPORTUNITY, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE.
            </p>
            <p className="text-retomy-text-secondary leading-relaxed">
              retomY acts as a marketplace facilitator and does not guarantee the accuracy, completeness, quality,
              legality, or fitness for purpose of any dataset listed by Sellers. Your use of any purchased dataset
              is at your own risk. Our total aggregate liability to you for all claims arising from or related to
              these Terms or the Service shall not exceed the amount you paid to retomY in the twelve (12) months
              preceding the event giving rise to the claim.
            </p>
          </div>

          {/* 10 */}
          <div>
            <h2 className="text-xl font-bold text-retomy-text-bright mb-3">10. Dispute Resolution & Governing Law</h2>
            <p className="text-retomy-text-secondary leading-relaxed mb-3">
              These Terms shall be governed by and construed in accordance with the laws of the State of Delaware,
              United States, without regard to its conflict-of-law provisions. Any disputes arising under or in
              connection with these Terms shall first be submitted to good-faith mediation. If mediation is
              unsuccessful, disputes shall be resolved through binding arbitration in accordance with the rules of
              the American Arbitration Association.
            </p>
            <p className="text-retomy-text-secondary leading-relaxed">
              You agree that any arbitration shall be conducted on an individual basis and not as a class, consolidated,
              or representative action. You waive any right to participate in a class action lawsuit or class-wide arbitration.
            </p>
          </div>

          {/* 11 */}
          <div>
            <h2 className="text-xl font-bold text-retomy-text-bright mb-3">11. Modifications to Terms</h2>
            <p className="text-retomy-text-secondary leading-relaxed">
              retomY reserves the right to modify these Terms at any time. We will provide reasonable notice of material
              changes through email, in-app notifications, or prominent posting on the platform. Your continued use
              of the Service after such modifications constitutes acceptance of the updated Terms. If you do not agree
              with the modified Terms, you must discontinue use of the Service and may request account deletion.
            </p>
          </div>

          {/* 12 */}
          <div>
            <h2 className="text-xl font-bold text-retomy-text-bright mb-3">12. Contact</h2>
            <p className="text-retomy-text-secondary leading-relaxed mb-2">
              If you have questions about these Terms of Service, please contact us:
            </p>
            <div className="card p-4 text-sm text-retomy-text-secondary">
              <p><strong className="text-retomy-text-bright">retomY Inc.</strong></p>
              <p>Email: <a href="mailto:legal@retomy.com" className="text-retomy-accent hover:underline">legal@retomy.com</a></p>
              <p>Support: <Link to="/contact" className="text-retomy-accent hover:underline">Contact Support</Link></p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
