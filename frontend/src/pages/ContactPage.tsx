import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FiMail, FiMessageCircle, FiClock, FiBook,
  FiAlertCircle, FiCreditCard, FiShield, FiHelpCircle, FiSend
} from 'react-icons/fi';

const faqItems = [
  {
    q: 'How do I download data after purchase?',
    a: 'Navigate to your Buyer Dashboard and find the purchase under "Recent Purchases." Click the download button to receive a secure, time-limited download link. Links expire after 24 hours but can be regenerated from your dashboard at any time.',
  },
  {
    q: 'Can I get a refund?',
    a: 'All sales are generally final. However, if purchased data is materially different from its listing description or the files are corrupt/incomplete, contact our support team within 7 days of purchase and we will investigate and process a refund if warranted.',
  },
  {
    q: 'How do I become a seller?',
    a: 'Sign up for a retomY account and select "Become a Seller" from the footer or your profile menu. You will need to complete identity verification through Stripe Connect and agree to our Seller Guidelines before you can list data.',
  },
  {
    q: 'What file formats are supported?',
    a: 'retomY supports any file type — CSV, Parquet, JSON, Excel, images, video, geospatial data, ZIP archives, and more. There are no format restrictions; whatever your data looks like, you can list and sell it on our platform.',
  },
  {
    q: 'How are payments processed?',
    a: 'All payments are securely processed through Stripe. Buyers can pay with major credit/debit cards or use retomY credits. Sellers receive payouts directly to their connected Stripe account based on the payout schedule configured in their Seller Dashboard.',
  },
  {
    q: 'Is my data secure on retomY?',
    a: 'Yes. All data are stored in Microsoft Azure Blob Storage with encryption at rest and TLS encryption in transit. Download links use time-limited Shared Access Signatures (SAS tokens) so that only authorized buyers can access purchased files.',
  },
];

const categories = [
  { icon: FiAlertCircle, label: 'Report an Issue', desc: 'Something broken? Let us know.' },
  { icon: FiCreditCard, label: 'Billing & Payments', desc: 'Charges, refunds, or payout questions.' },
  { icon: FiShield, label: 'Account & Security', desc: 'Login issues, verification, privacy.' },
  { icon: FiHelpCircle, label: 'General Inquiry', desc: 'Anything else? We\'re here to help.' },
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', category: 'General Inquiry', subject: '', message: '' });
  const [sending, setSending] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.subject || !form.message) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSending(true);
    // Simulate sending (replace with real API call when backend support endpoint exists)
    await new Promise((r) => setTimeout(r, 1200));
    toast.success('Your message has been sent! We\'ll get back to you within 24 hours.');
    setForm({ name: '', email: '', category: 'General Inquiry', subject: '', message: '' });
    setSending(false);
  };

  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="bg-hero-gradient border-b border-retomy-border/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="badge-accent mb-4 text-sm inline-block">Support Center</div>
          <h1 className="text-4xl font-extrabold text-retomy-text-bright mb-3">How Can We Help?</h1>
          <p className="text-retomy-text-secondary max-w-2xl mx-auto">
            Whether you have a question about data, billing, account security, or anything else —
            our team is ready to assist you.
          </p>
        </div>
      </section>

      {/* Quick Support Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((c) => (
            <button
              key={c.label}
              onClick={() => setForm({ ...form, category: c.label })}
              className={`card p-5 text-left hover:border-retomy-accent/40 transition-all ${
                form.category === c.label ? 'border-retomy-accent/60 bg-retomy-accent/5' : ''
              }`}
            >
              <c.icon className="text-retomy-accent mb-3" size={24} />
              <h3 className="font-semibold text-retomy-text-bright text-sm mb-1">{c.label}</h3>
              <p className="text-xs text-retomy-text-secondary">{c.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Contact Form + Info */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="grid lg:grid-cols-3 gap-12">
          {/* Form */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-retomy-text-bright mb-6">Send Us a Message</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-retomy-text-bright mb-1">Your Name *</label>
                  <input
                    type="text" name="name" value={form.name} onChange={handleChange}
                    placeholder="Jane Doe"
                    className="w-full px-4 py-2.5 bg-retomy-bg-secondary border border-retomy-border/40 rounded-lg text-retomy-text-bright placeholder-retomy-text-secondary/50 focus:outline-none focus:border-retomy-accent/60 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-retomy-text-bright mb-1">Email Address *</label>
                  <input
                    type="email" name="email" value={form.email} onChange={handleChange}
                    placeholder="jane@company.com"
                    className="w-full px-4 py-2.5 bg-retomy-bg-secondary border border-retomy-border/40 rounded-lg text-retomy-text-bright placeholder-retomy-text-secondary/50 focus:outline-none focus:border-retomy-accent/60 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-retomy-text-bright mb-1">Category</label>
                <select
                  name="category" value={form.category} onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-retomy-bg-secondary border border-retomy-border/40 rounded-lg text-retomy-text-bright focus:outline-none focus:border-retomy-accent/60 transition-colors"
                >
                  {categories.map((c) => (
                    <option key={c.label} value={c.label}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-retomy-text-bright mb-1">Subject *</label>
                <input
                  type="text" name="subject" value={form.subject} onChange={handleChange}
                  placeholder="Brief summary of your issue or question"
                  className="w-full px-4 py-2.5 bg-retomy-bg-secondary border border-retomy-border/40 rounded-lg text-retomy-text-bright placeholder-retomy-text-secondary/50 focus:outline-none focus:border-retomy-accent/60 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-retomy-text-bright mb-1">Message *</label>
                <textarea
                  name="message" value={form.message} onChange={handleChange}
                  rows={6}
                  placeholder="Describe your issue or question in detail. Include order IDs, data names, or screenshots if relevant."
                  className="w-full px-4 py-2.5 bg-retomy-bg-secondary border border-retomy-border/40 rounded-lg text-retomy-text-bright placeholder-retomy-text-secondary/50 focus:outline-none focus:border-retomy-accent/60 transition-colors resize-y"
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                <FiSend size={16} />
                {sending ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-retomy-accent/10 rounded-lg flex items-center justify-center">
                  <FiMail className="text-retomy-accent" size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-retomy-text-bright text-sm">Email Us</h3>
                  <a href="mailto:support@retomy.com" className="text-sm text-retomy-accent hover:underline">support@retomy.com</a>
                </div>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-retomy-accent/10 rounded-lg flex items-center justify-center">
                  <FiClock className="text-retomy-accent" size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-retomy-text-bright text-sm">Response Time</h3>
                  <p className="text-sm text-retomy-text-secondary">Within 24 hours (business days)</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-retomy-accent/10 rounded-lg flex items-center justify-center">
                  <FiMessageCircle className="text-retomy-accent" size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-retomy-text-bright text-sm">Priority Support</h3>
                  <p className="text-sm text-retomy-text-secondary">Premium plans get &lt;4hr response</p>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-2 mb-3">
                <FiBook className="text-retomy-accent" size={18} />
                <h3 className="font-semibold text-retomy-text-bright text-sm">Quick Links</h3>
              </div>
              <div className="space-y-2">
                <Link to="/about" className="block text-sm text-retomy-text-secondary hover:text-retomy-accent transition-colors">About Us</Link>
                <Link to="/terms" className="block text-sm text-retomy-text-secondary hover:text-retomy-accent transition-colors">Terms of Service</Link>
                <Link to="/privacy" className="block text-sm text-retomy-text-secondary hover:text-retomy-accent transition-colors">Privacy Policy</Link>
                <Link to="/browse" className="block text-sm text-retomy-text-secondary hover:text-retomy-accent transition-colors">Browse Data</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-retomy-bg-secondary border-t border-retomy-border/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-retomy-text-bright mb-2">Frequently Asked Questions</h2>
            <p className="text-retomy-text-secondary">Quick answers to common questions.</p>
          </div>
          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <div
                key={i}
                className="card overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-retomy-accent/5 transition-colors"
                >
                  <span className="font-medium text-retomy-text-bright text-sm pr-4">{item.q}</span>
                  <span className="text-retomy-accent text-lg flex-shrink-0">{openFaq === i ? '−' : '+'}</span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 pt-0">
                    <p className="text-sm text-retomy-text-secondary leading-relaxed">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
