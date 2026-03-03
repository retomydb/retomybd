import { Link } from 'react-router-dom';
import { FiGithub, FiTwitter, FiMail } from 'react-icons/fi';

export default function Footer() {
  return (
    <footer className="bg-retomy-bg-secondary border-t border-retomy-border/30 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-accent-gradient rounded-md flex items-center justify-center">
                <span className="text-retomy-bg font-extrabold text-sm">rY</span>
              </div>
              <span className="text-retomy-text-bright font-bold text-lg">
                reto<span className="text-retomy-accent">m</span>Y
              </span>
            </Link>
            <p className="text-sm text-retomy-text-secondary leading-relaxed">
              The marketplace for data. Buy, sell, and discover data at scale.
            </p>
            <div className="flex items-center gap-4 mt-4">
              <a href="#" className="text-retomy-text-secondary hover:text-retomy-accent transition-colors"><FiTwitter size={18} /></a>
              <a href="#" className="text-retomy-text-secondary hover:text-retomy-accent transition-colors"><FiGithub size={18} /></a>
              <a href="#" className="text-retomy-text-secondary hover:text-retomy-accent transition-colors"><FiMail size={18} /></a>
            </div>
          </div>

          {/* Marketplace */}
          <div>
            <h4 className="text-sm font-semibold text-retomy-text-bright uppercase tracking-wider mb-4">Marketplace</h4>
            <div className="space-y-2">
              <Link to="/browse" className="block text-sm text-retomy-text-secondary hover:text-retomy-text-bright transition-colors">Browse Data</Link>
              <Link to="/browse?sort_by=downloads" className="block text-sm text-retomy-text-secondary hover:text-retomy-text-bright transition-colors">Popular</Link>
              <Link to="/browse?pricing_model=free" className="block text-sm text-retomy-text-secondary hover:text-retomy-text-bright transition-colors">Free Data</Link>
              <Link to="/browse" className="block text-sm text-retomy-text-secondary hover:text-retomy-text-bright transition-colors">Categories</Link>
            </div>
          </div>

          {/* Sellers */}
          <div>
            <h4 className="text-sm font-semibold text-retomy-text-bright uppercase tracking-wider mb-4">Sellers</h4>
            <div className="space-y-2">
              <Link to="/signup?role=seller" className="block text-sm text-retomy-text-secondary hover:text-retomy-text-bright transition-colors">Become a Seller</Link>
              <Link to="/seller" className="block text-sm text-retomy-text-secondary hover:text-retomy-text-bright transition-colors">Seller Dashboard</Link>
              <a href="#" className="block text-sm text-retomy-text-secondary hover:text-retomy-text-bright transition-colors">Pricing & Fees</a>
              <a href="#" className="block text-sm text-retomy-text-secondary hover:text-retomy-text-bright transition-colors">Seller Guidelines</a>
            </div>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold text-retomy-text-bright uppercase tracking-wider mb-4">Company</h4>
            <div className="space-y-2">
              <Link to="/about" className="block text-sm text-retomy-text-secondary hover:text-retomy-text-bright transition-colors">About Us</Link>
              <Link to="/terms" className="block text-sm text-retomy-text-secondary hover:text-retomy-text-bright transition-colors">Terms of Service</Link>
              <Link to="/privacy" className="block text-sm text-retomy-text-secondary hover:text-retomy-text-bright transition-colors">Privacy Policy</Link>
              <Link to="/contact" className="block text-sm text-retomy-text-secondary hover:text-retomy-text-bright transition-colors">Contact Support</Link>
            </div>
          </div>
        </div>

        <div className="border-t border-retomy-border/30 mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-retomy-text-secondary">
            &copy; {new Date().getFullYear()} retomY Inc. All rights reserved.
          </p>
          <p className="text-xs text-retomy-text-secondary">
            Data Marketplace — v1.0.0
          </p>
        </div>
      </div>
    </footer>
  );
}
