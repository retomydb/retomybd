import { Link } from 'react-router-dom';

const EFFECTIVE_DATE = 'January 1, 2025';
const LAST_UPDATED = 'March 1, 2026';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="bg-hero-gradient border-b border-retomy-border/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h1 className="text-4xl font-extrabold text-retomy-text-bright mb-3">Privacy Policy</h1>
          <p className="text-retomy-text-secondary">
            Effective Date: {EFFECTIVE_DATE} &middot; Last Updated: {LAST_UPDATED}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="prose prose-retomy space-y-10">

          {/* Intro */}
          <div>
            <p className="text-retomy-text-secondary leading-relaxed">
              retomY Inc. ("retomY," "we," "us," or "our") is committed to protecting your privacy. This Privacy Policy
              describes how we collect, use, disclose, and safeguard your information when you visit our website, use our
              platform, or interact with our services (collectively, the "Service"). By using the Service, you consent to
              the practices described in this Privacy Policy.
            </p>
          </div>

          {/* 1 */}
          <div>
            <h2 className="text-xl font-bold text-retomy-text-bright mb-3">1. Information We Collect</h2>

            <h3 className="text-lg font-semibold text-retomy-text-bright mb-2 mt-4">1.1 Information You Provide</h3>
            <ul className="list-disc list-inside text-retomy-text-secondary space-y-1 ml-4 mb-4">
              <li><strong className="text-retomy-text-bright">Account Information:</strong> Name, email address, password, display name, and profile details when you register</li>
              <li><strong className="text-retomy-text-bright">Seller Information:</strong> Business name, tax identification numbers, payout bank details (processed by Stripe), and verification documents</li>
              <li><strong className="text-retomy-text-bright">Payment Information:</strong> Credit card numbers, billing addresses, and transaction data (processed and stored by Stripe; retomY does not store full card numbers)</li>
              <li><strong className="text-retomy-text-bright">Content:</strong> Data listings, descriptions, reviews, support tickets, and any files you upload</li>
              <li><strong className="text-retomy-text-bright">Communications:</strong> Messages you send through the platform, surveys you respond to, or emails you send us</li>
            </ul>

            <h3 className="text-lg font-semibold text-retomy-text-bright mb-2">1.2 Information Collected Automatically</h3>
            <ul className="list-disc list-inside text-retomy-text-secondary space-y-1 ml-4 mb-4">
              <li><strong className="text-retomy-text-bright">Device & Browser Data:</strong> IP address, browser type, operating system, device identifiers, and screen resolution</li>
              <li><strong className="text-retomy-text-bright">Usage Data:</strong> Pages viewed, features used, search queries, click patterns, session duration, and referral sources</li>
              <li><strong className="text-retomy-text-bright">Cookies & Tracking:</strong> We use cookies, local storage, and similar technologies to maintain sessions, remember preferences, and analyze usage patterns</li>
            </ul>

            <h3 className="text-lg font-semibold text-retomy-text-bright mb-2">1.3 Information from Third Parties</h3>
            <p className="text-retomy-text-secondary leading-relaxed">
              We may receive information from payment processors (Stripe), identity verification services, analytics
              providers, and social login platforms (if offered) to enhance your experience and ensure platform integrity.
            </p>
          </div>

          {/* 2 */}
          <div>
            <h2 className="text-xl font-bold text-retomy-text-bright mb-3">2. How We Use Your Information</h2>
            <p className="text-retomy-text-secondary leading-relaxed mb-3">We use the information we collect to:</p>
            <ul className="list-disc list-inside text-retomy-text-secondary space-y-1 ml-4">
              <li>Provide, operate, maintain, and improve the Service</li>
              <li>Process transactions, manage accounts, and deliver purchased data securely</li>
              <li>Verify seller identities and prevent fraud, abuse, and unauthorized access</li>
              <li>Send transactional notifications (order confirmations, download links, account alerts)</li>
              <li>Send marketing communications (with your consent, where required by law)</li>
              <li>Analyze usage patterns to improve user experience, search relevance, and platform performance</li>
              <li>Comply with legal obligations, resolve disputes, and enforce our Terms of Service</li>
              <li>Generate aggregated, anonymized analytics that do not identify individual users</li>
            </ul>
          </div>

          {/* 3 */}
          <div>
            <h2 className="text-xl font-bold text-retomy-text-bright mb-3">3. How We Share Your Information</h2>
            <p className="text-retomy-text-secondary leading-relaxed mb-3">
              retomY does not sell your personal information. We may share information in the following circumstances:
            </p>
            <ul className="list-disc list-inside text-retomy-text-secondary space-y-1 ml-4">
              <li>
                <strong className="text-retomy-text-bright">Service Providers:</strong> With third-party vendors who
                help us operate the platform (hosting via Microsoft Azure, payment processing via Stripe, email delivery,
                analytics, and customer support tools)
              </li>
              <li>
                <strong className="text-retomy-text-bright">Between Buyers and Sellers:</strong> Limited transaction
                information (such as display name and purchase confirmation) may be shared to facilitate transactions
              </li>
              <li>
                <strong className="text-retomy-text-bright">Legal Compliance:</strong> When required by law, subpoena,
                court order, or governmental regulation, or when we believe disclosure is necessary to protect our rights,
                prevent fraud, or ensure user safety
              </li>
              <li>
                <strong className="text-retomy-text-bright">Business Transfers:</strong> In connection with a merger,
                acquisition, reorganization, or sale of assets, your information may be transferred as part of the transaction
              </li>
              <li>
                <strong className="text-retomy-text-bright">With Your Consent:</strong> In any other circumstances where
                you have provided explicit consent
              </li>
            </ul>
          </div>

          {/* 4 */}
          <div>
            <h2 className="text-xl font-bold text-retomy-text-bright mb-3">4. Data Security</h2>
            <p className="text-retomy-text-secondary leading-relaxed mb-3">
              We implement industry-standard security measures to protect your data, including:
            </p>
            <ul className="list-disc list-inside text-retomy-text-secondary space-y-1 ml-4 mb-3">
              <li>TLS/SSL encryption for all data in transit</li>
              <li>Encryption at rest for stored data via Azure Blob Storage encryption</li>
              <li>Bcrypt password hashing with per-user salts</li>
              <li>Short-lived JWT access tokens and secure refresh token rotation</li>
              <li>Role-based access controls and principle of least privilege</li>
              <li>Regular security audits and vulnerability assessments</li>
            </ul>
            <p className="text-retomy-text-secondary leading-relaxed">
              While we strive to protect your information, no method of electronic transmission or storage is 100% secure.
              We cannot guarantee absolute security and encourage you to use strong, unique passwords and enable any additional
              security features we offer.
            </p>
          </div>

          {/* 5 */}
          <div>
            <h2 className="text-xl font-bold text-retomy-text-bright mb-3">5. Data Retention</h2>
            <p className="text-retomy-text-secondary leading-relaxed">
              We retain your personal information for as long as your account is active or as needed to provide the Service.
              After account deletion, we may retain certain information for a reasonable period to comply with legal obligations,
              resolve disputes, enforce agreements, and for legitimate business purposes (such as fraud prevention). Transaction
              records may be retained for up to seven (7) years as required by financial regulations. Anonymized or aggregated
              data that cannot identify you may be retained indefinitely for analytics purposes.
            </p>
          </div>

          {/* 6 */}
          <div>
            <h2 className="text-xl font-bold text-retomy-text-bright mb-3">6. Your Rights & Choices</h2>
            <p className="text-retomy-text-secondary leading-relaxed mb-3">
              Depending on your jurisdiction, you may have the following rights regarding your personal information:
            </p>
            <ul className="list-disc list-inside text-retomy-text-secondary space-y-1 ml-4 mb-3">
              <li><strong className="text-retomy-text-bright">Access:</strong> Request a copy of the personal data we hold about you</li>
              <li><strong className="text-retomy-text-bright">Correction:</strong> Request correction of inaccurate or incomplete data</li>
              <li><strong className="text-retomy-text-bright">Deletion:</strong> Request deletion of your personal data, subject to legal retention requirements</li>
              <li><strong className="text-retomy-text-bright">Portability:</strong> Request your data in a structured, machine-readable format</li>
              <li><strong className="text-retomy-text-bright">Opt-Out:</strong> Unsubscribe from marketing communications at any time</li>
              <li><strong className="text-retomy-text-bright">Restriction:</strong> Request restriction of processing in certain circumstances</li>
            </ul>
            <p className="text-retomy-text-secondary leading-relaxed">
              To exercise these rights, please contact us at{' '}
              <a href="mailto:privacy@retomy.com" className="text-retomy-accent hover:underline">privacy@retomy.com</a>.
              We will respond within 30 days (or sooner if required by applicable law).
            </p>
          </div>

          {/* 7 */}
          <div>
            <h2 className="text-xl font-bold text-retomy-text-bright mb-3">7. International Data Transfers</h2>
            <p className="text-retomy-text-secondary leading-relaxed">
              retomY operates globally. Your information may be transferred to and processed in countries other than your
              country of residence, including the United States. We ensure that appropriate safeguards are in place for
              international transfers, including Standard Contractual Clauses (SCCs) approved by the European Commission
              where applicable. By using the Service, you consent to the transfer of your information to the United States
              and other jurisdictions as described in this Policy.
            </p>
          </div>

          {/* 8 */}
          <div>
            <h2 className="text-xl font-bold text-retomy-text-bright mb-3">8. GDPR Compliance (EEA Users)</h2>
            <p className="text-retomy-text-secondary leading-relaxed mb-3">
              If you are located in the European Economic Area (EEA), the General Data Protection Regulation (GDPR)
              provides additional rights. Our lawful bases for processing include:
            </p>
            <ul className="list-disc list-inside text-retomy-text-secondary space-y-1 ml-4">
              <li><strong className="text-retomy-text-bright">Contract:</strong> Processing necessary to perform our contract with you (providing the Service)</li>
              <li><strong className="text-retomy-text-bright">Legitimate Interests:</strong> Platform security, fraud prevention, and Service improvement</li>
              <li><strong className="text-retomy-text-bright">Consent:</strong> Marketing communications and optional analytics</li>
              <li><strong className="text-retomy-text-bright">Legal Obligation:</strong> Financial record-keeping and regulatory compliance</li>
            </ul>
          </div>

          {/* 9 */}
          <div>
            <h2 className="text-xl font-bold text-retomy-text-bright mb-3">9. CCPA Compliance (California Residents)</h2>
            <p className="text-retomy-text-secondary leading-relaxed">
              Under the California Consumer Privacy Act (CCPA), California residents have the right to know what personal
              information we collect, request deletion, and opt out of the "sale" of personal information. retomY does
              not sell personal information. To exercise your CCPA rights, contact us at{' '}
              <a href="mailto:privacy@retomy.com" className="text-retomy-accent hover:underline">privacy@retomy.com</a>.
              We will not discriminate against you for exercising your CCPA rights.
            </p>
          </div>

          {/* 10 */}
          <div>
            <h2 className="text-xl font-bold text-retomy-text-bright mb-3">10. Cookies & Tracking Technologies</h2>
            <p className="text-retomy-text-secondary leading-relaxed mb-3">
              We use the following types of cookies and tracking technologies:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-retomy-text-secondary border border-retomy-border/30 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-retomy-bg-secondary">
                    <th className="text-left px-4 py-2 text-retomy-text-bright font-semibold border-b border-retomy-border/30">Type</th>
                    <th className="text-left px-4 py-2 text-retomy-text-bright font-semibold border-b border-retomy-border/30">Purpose</th>
                    <th className="text-left px-4 py-2 text-retomy-text-bright font-semibold border-b border-retomy-border/30">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-retomy-border/20">
                    <td className="px-4 py-2">Essential</td>
                    <td className="px-4 py-2">Authentication, security, session management</td>
                    <td className="px-4 py-2">Session</td>
                  </tr>
                  <tr className="border-b border-retomy-border/20">
                    <td className="px-4 py-2">Functional</td>
                    <td className="px-4 py-2">User preferences, cart state, language</td>
                    <td className="px-4 py-2">1 year</td>
                  </tr>
                  <tr className="border-b border-retomy-border/20">
                    <td className="px-4 py-2">Analytics</td>
                    <td className="px-4 py-2">Usage patterns, feature adoption, performance</td>
                    <td className="px-4 py-2">2 years</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Marketing</td>
                    <td className="px-4 py-2">Ad relevance, conversion tracking (if applicable)</td>
                    <td className="px-4 py-2">90 days</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-retomy-text-secondary leading-relaxed mt-3">
              You can manage cookie preferences through your browser settings. Disabling essential cookies may impair
              the functionality of the Service.
            </p>
          </div>

          {/* 11 */}
          <div>
            <h2 className="text-xl font-bold text-retomy-text-bright mb-3">11. Children's Privacy</h2>
            <p className="text-retomy-text-secondary leading-relaxed">
              The Service is not directed to children under the age of 16. We do not knowingly collect personal
              information from children. If we become aware that a child under 16 has provided us with personal data,
              we will take steps to delete such information promptly. If you believe a child has provided information
              to us, please contact us at{' '}
              <a href="mailto:privacy@retomy.com" className="text-retomy-accent hover:underline">privacy@retomy.com</a>.
            </p>
          </div>

          {/* 12 */}
          <div>
            <h2 className="text-xl font-bold text-retomy-text-bright mb-3">12. Changes to This Policy</h2>
            <p className="text-retomy-text-secondary leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of material changes by posting
              the updated policy on this page with a revised "Last Updated" date and, where required, by providing
              additional notice (such as email or in-app notification). We encourage you to review this policy
              periodically. Your continued use of the Service after any changes constitutes acceptance of the updated policy.
            </p>
          </div>

          {/* 13 */}
          <div>
            <h2 className="text-xl font-bold text-retomy-text-bright mb-3">13. Contact Us</h2>
            <p className="text-retomy-text-secondary leading-relaxed mb-2">
              If you have questions, concerns, or requests regarding this Privacy Policy or your personal data, contact us:
            </p>
            <div className="card p-4 text-sm text-retomy-text-secondary">
              <p><strong className="text-retomy-text-bright">retomY Inc. — Privacy Team</strong></p>
              <p>Email: <a href="mailto:privacy@retomy.com" className="text-retomy-accent hover:underline">privacy@retomy.com</a></p>
              <p>Support: <Link to="/contact" className="text-retomy-accent hover:underline">Contact Support</Link></p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
