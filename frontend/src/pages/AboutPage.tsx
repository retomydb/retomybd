import { Link } from 'react-router-dom';
import {
  FiDatabase, FiShield, FiUsers, FiGlobe, FiTrendingUp,
  FiZap, FiAward, FiHeart, FiTarget, FiLayers
} from 'react-icons/fi';

const values = [
  {
    icon: FiShield,
    title: 'Trust & Transparency',
    desc: 'Every dataset on retomY undergoes rigorous quality checks. We enforce clear licensing, verified seller identities, and comprehensive data provenance so buyers know exactly what they are acquiring.',
  },
  {
    icon: FiZap,
    title: 'Speed to Insight',
    desc: 'Our infrastructure is built for performance. From instant search across millions of listings to one-click downloads and seamless API integration, we eliminate friction between discovery and deployment.',
  },
  {
    icon: FiUsers,
    title: 'Community First',
    desc: 'We believe the best marketplaces are built by their participants. Peer reviews, seller ratings, and open feedback loops ensure that quality rises to the top organically.',
  },
  {
    icon: FiGlobe,
    title: 'Global Accessibility',
    desc: 'Data knows no borders. retomY supports multiple currencies, regional compliance frameworks, and localized payment methods to serve data professionals in every corner of the world.',
  },
];

const milestones = [
  { year: '2024', title: 'Founded', desc: 'retomY was born from a simple observation: acquiring quality data for machine learning, analytics, and research was far harder than it should be.' },
  { year: '2024', title: 'Beta Launch', desc: 'Our private beta opened to 500 data professionals, generating over 1,200 data listings within the first quarter.' },
  { year: '2025', title: 'Public Launch', desc: 'retomY opened to the public with robust security, Stripe-powered payments, and Azure-backed storage infrastructure.' },
  { year: '2025', title: 'Marketplace Growth', desc: 'Thousands of data spanning finance, healthcare, geospatial, NLP, and computer vision now power teams across 40+ countries.' },
];

const stats = [
  { value: '10K+', label: 'Data Listed' },
  { value: '50K+', label: 'Data Professionals' },
  { value: '120+', label: 'Countries Served' },
  { value: '99.9%', label: 'Uptime SLA' },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative bg-hero-gradient overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 30% 20%, rgba(102,192,244,0.15) 0%, transparent 50%),
                              radial-gradient(circle at 70% 80%, rgba(26,159,255,0.1) 0%, transparent 50%)`,
          }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 text-center">
          <div className="badge-accent mb-4 text-sm inline-block">About retomY</div>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-retomy-text-bright leading-tight mb-6">
            Where the World's <span className="text-retomy-accent">Data Finds Purpose</span>
          </h1>
          <p className="text-lg text-retomy-text-secondary max-w-3xl mx-auto leading-relaxed">
            retomY is the marketplace where data producers and data consumers connect — across
            academia, business, sports, research, and beyond. We make it simple to discover, evaluate,
            purchase, and deliver high-quality data so teams can focus on building, not searching.
          </p>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-retomy-bg-secondary border-y border-retomy-border/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-extrabold text-retomy-accent mb-1">{s.value}</div>
                <div className="text-sm text-retomy-text-secondary">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="flex items-center gap-2 text-retomy-accent mb-3">
              <FiTarget size={20} />
              <span className="text-sm font-semibold uppercase tracking-wider">Our Mission</span>
            </div>
            <h2 className="text-3xl font-bold text-retomy-text-bright mb-6">
              Democratize Access to High-Quality Data
            </h2>
            <p className="text-retomy-text-secondary leading-relaxed mb-4">
              The modern world runs on data, yet acquiring the right dataset remains one of the most
              time-consuming challenges in analytics, machine learning, and business intelligence.
              Organizations spend weeks — sometimes months — sourcing, validating, and negotiating data
              acquisitions through ad-hoc channels, email threads, and opaque brokerage relationships.
            </p>
            <p className="text-retomy-text-secondary leading-relaxed mb-4">
              retomY was founded to change that. We built a secure, transparent, and scalable marketplace
              where anyone — from an independent researcher to a university lab to a professional sports analytics team — can list, discover,
              and transact data with confidence. Our platform handles licensing, payments, secure delivery,
              and quality assurance, so both buyers and sellers can focus on what they do best.
            </p>
            <p className="text-retomy-text-secondary leading-relaxed">
              Whether you need satellite imagery for geospatial analysis, labeled NLP corpora for language model
              training, financial time-series data for quantitative research, or healthcare datasets compliant
              with HIPAA and GDPR — retomY is where the world's data changes hands.
            </p>
          </div>
          <div className="card p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-accent-gradient rounded-xl flex items-center justify-center">
                <FiDatabase className="text-retomy-bg" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-retomy-text-bright">Production-Grade Infrastructure</h3>
                <p className="text-sm text-retomy-text-secondary">Azure-backed storage, SOC 2 aligned processes</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-accent-gradient rounded-xl flex items-center justify-center">
                <FiLayers className="text-retomy-bg" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-retomy-text-bright">Any Format, Any Domain</h3>
                <p className="text-sm text-retomy-text-secondary">CSV, Parquet, JSON, images, video, geospatial, and more</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-accent-gradient rounded-xl flex items-center justify-center">
                <FiTrendingUp className="text-retomy-bg" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-retomy-text-bright">Built for Scale</h3>
                <p className="text-sm text-retomy-text-secondary">From kilobytes to terabytes, single files to multi-part archives</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-accent-gradient rounded-xl flex items-center justify-center">
                <FiAward className="text-retomy-bg" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-retomy-text-bright">Verified Sellers</h3>
                <p className="text-sm text-retomy-text-secondary">Identity-checked data producers with transparent reviews</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-retomy-bg-secondary border-y border-retomy-border/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-retomy-text-bright mb-3">Our Core Values</h2>
            <p className="text-retomy-text-secondary max-w-2xl mx-auto">
              These principles guide every product decision, partnership, and policy at retomY.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v) => (
              <div key={v.title} className="card p-6 hover:border-retomy-accent/30 transition-colors">
                <div className="w-10 h-10 bg-retomy-accent/10 rounded-lg flex items-center justify-center mb-4">
                  <v.icon className="text-retomy-accent" size={20} />
                </div>
                <h3 className="font-semibold text-retomy-text-bright mb-2">{v.title}</h3>
                <p className="text-sm text-retomy-text-secondary leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Journey */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-retomy-text-bright mb-3">Our Journey</h2>
          <p className="text-retomy-text-secondary max-w-2xl mx-auto">
            From an idea scribbled on a whiteboard to a platform trusted by data teams worldwide.
          </p>
        </div>
        {/* Horizontal stepper on md+, stacked cards on mobile */}
        <div className="hidden md:flex items-start relative">
          {/* connecting line */}
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-retomy-border/40" />
          {milestones.map((m, i) => (
            <div key={i} className="flex-1 relative px-3">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-retomy-accent/15 border-2 border-retomy-accent flex items-center justify-center relative z-10 mb-4">
                  <span className="text-xs font-bold text-retomy-accent">{m.year.slice(-2)}</span>
                </div>
                <h3 className="font-semibold text-retomy-text-bright text-sm mb-1">{m.title}</h3>
                <p className="text-xs text-retomy-text-secondary leading-relaxed text-center">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
        {/* Mobile: compact grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
          {milestones.map((m, i) => (
            <div key={i} className="card p-4 flex gap-3">
              <div className="w-9 h-9 rounded-full bg-retomy-accent/15 border-2 border-retomy-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-retomy-accent">{m.year.slice(-2)}</span>
              </div>
              <div>
                <h3 className="font-semibold text-retomy-text-bright text-sm mb-0.5">{m.title}</h3>
                <p className="text-xs text-retomy-text-secondary leading-relaxed">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-retomy-bg-secondary border-t border-retomy-border/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <FiHeart className="text-retomy-accent" size={20} />
            <span className="text-sm font-semibold text-retomy-accent uppercase tracking-wider">Join the Community</span>
          </div>
          <h2 className="text-3xl font-bold text-retomy-text-bright mb-4">
            Ready to Transform How You Work With Data?
          </h2>
            <p className="text-retomy-text-secondary max-w-2xl mx-auto mb-8">
            Whether you're buying data to fuel your next breakthrough or selling data to
            reach a global audience, retomY is built for you.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/browse" className="btn-primary">Browse Data</Link>
            <Link to="/signup?role=seller" className="btn-secondary">Start Selling</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
