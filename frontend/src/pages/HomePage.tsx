import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DatasetCard from '../components/DatasetCard';
import { datasetsApi, purchasesApi, getApiError } from '../services/api';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import {
  FiDatabase, FiUsers, FiDownload, FiShield, FiArrowRight,
  FiTrendingUp, FiStar, FiZap, FiLock, FiCode
} from 'react-icons/fi';

export default function HomePage() {
  const { isAuthenticated } = useAuthStore();
  const [data, setData] = useState<any>({
    featured: [], trending: [], new_arrivals: [], categories: [], platform_stats: {}
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: result } = await datasetsApi.getFeatured();
      setData(result);
    } catch {
      // Will show empty state
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (id: string) => {
    if (!isAuthenticated) { toast.error('Sign in to add to cart'); return; }
    try {
      await purchasesApi.addToCart(id);
      toast.success('Added to cart');
    } catch (e: any) {
      toast.error(getApiError(e, 'Failed to add'));
    }
  };

  const stats = data.platform_stats || {};

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-hero-gradient overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, rgba(102, 192, 244, 0.15) 0%, transparent 50%),
                              radial-gradient(circle at 75% 75%, rgba(26, 159, 255, 0.1) 0%, transparent 50%)`,
          }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="max-w-3xl">
            <div className="badge-accent mb-4 text-sm">Data Marketplace</div>
            <h1 className="text-4xl lg:text-6xl font-extrabold text-retomy-text-bright leading-tight">
              Retomy Db
            </h1>
            <p className="mt-6 text-lg text-retomy-text-secondary leading-relaxed max-w-xl">
              Discover high-quality data. Trusted by data teams worldwide
              for AI/ML training, analytics, and research.
            </p>
            <div className="flex flex-wrap gap-4 mt-8">
              <Link to="/browse" className="btn-primary text-base !px-8 !py-3 flex items-center gap-2">
                Explore Data <FiArrowRight />
              </Link>
              {!isAuthenticated && (
                <Link to="/signup?role=seller" className="btn-secondary text-base !px-8 !py-3">
                  Start Selling
                </Link>
              )}
            </div>
          </div>

          {/* Stats Cards - modern responsive layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mt-16 pt-8">
            <div className="card p-4 flex items-center gap-4 hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 rounded-md bg-retomy-accent/10 flex items-center justify-center">
                <FiDatabase className="text-retomy-accent" size={22} />
              </div>
              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="text-center">
                  <div className="text-2xl lg:text-3xl font-extrabold text-retomy-text-bright">{stats.TotalDatasets ?? '0'}</div>
                  <div className="text-xs uppercase text-retomy-text-secondary tracking-wide mt-1">DATA</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl lg:text-3xl font-extrabold text-retomy-text-bright">{stats.FreeDatasets ?? '0'}</div>
                  <div className="text-xs uppercase text-retomy-text-secondary tracking-wide mt-1">FREE</div>
                </div>
              </div>
            </div>

            <div className="card p-4 flex items-center gap-4 hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 rounded-md bg-retomy-green-light/10 flex items-center justify-center">
                <FiUsers className="text-retomy-green-light" size={22} />
              </div>
              <div>
                <div className="text-2xl lg:text-3xl font-extrabold text-retomy-text-bright">{stats.TotalSellers || '0'}</div>
                <div className="text-xs uppercase text-retomy-text-secondary tracking-wide mt-1">Data Providers</div>
              </div>
            </div>

            <div className="card p-4 flex items-center gap-4 hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 rounded-md bg-retomy-accent/10 flex items-center justify-center">
                <FiUsers className="text-retomy-accent" size={22} />
              </div>
              <div>
                <div className="text-2xl lg:text-3xl font-extrabold text-retomy-text-bright">{stats.TotalUsers || '0'}</div>
                <div className="text-xs uppercase text-retomy-text-secondary tracking-wide mt-1">Active Users</div>
              </div>
            </div>

            <div className="card p-4 flex items-center gap-4 hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 rounded-md bg-retomy-gold/10 flex items-center justify-center">
                <FiDownload className="text-retomy-gold" size={22} />
              </div>
              <div>
                <div className="text-2xl lg:text-3xl font-extrabold text-retomy-text-bright">{(stats.TotalDownloads || 0).toLocaleString()}</div>
                <div className="text-xs uppercase text-retomy-text-secondary tracking-wide mt-1">Total Downloads</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="bg-retomy-bg-secondary py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="card p-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-lg bg-retomy-accent/10 flex items-center justify-center mb-4">
                <FiShield className="text-retomy-accent" size={24} />
              </div>
              <h3 className="font-bold text-retomy-text-bright mb-2">Platform Security</h3>
              <p className="text-sm text-retomy-text-secondary">
                End-to-end encryption, privacy scoring, and compliance-ready data governance.
              </p>
            </div>
            <div className="card p-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-lg bg-retomy-accent/10 flex items-center justify-center mb-4">
                <FiCode className="text-retomy-accent" size={24} />
              </div>
              <h3 className="font-bold text-retomy-text-bright mb-2">API-First Access</h3>
                <p className="text-sm text-retomy-text-secondary">
                RESTful APIs with presigned URLs, API keys, and programmatic access to all data.
              </p>
            </div>
            <div className="card p-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-lg bg-retomy-accent/10 flex items-center justify-center mb-4">
                <FiLock className="text-retomy-accent" size={24} />
              </div>
              <h3 className="font-bold text-retomy-text-bright mb-2">Data Provenance</h3>
              <p className="text-sm text-retomy-text-secondary">
                Full lineage tracking, licensing, and consent management for every dataset.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Datasets */}
      {data.featured.length > 0 && (
        <section className="page-container py-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <FiStar className="text-retomy-gold" size={20} />
              <h2 className="section-title">Featured Data</h2>
            </div>
            <Link to="/browse?sort_by=featured" className="text-sm text-retomy-accent hover:underline flex items-center gap-1">
              View All <FiArrowRight size={14} />
            </Link>
          </div>
          <div className="bg-retomy-bg-card rounded-lg p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 browse-grid">
              {data.featured.slice(0, 4).map((d: any) => (
                <div key={d.DatasetId} className="min-w-0">
                  <DatasetCard dataset={d} onAddToCart={handleAddToCart} />
                </div>
              ))}
            </div>
            <div className="mt-3">
              <Link to="/browse?sort_by=featured" className="text-sm text-retomy-accent hover:underline">
                Browse all data &rarr;
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Trending */}
      {data.trending.length > 0 && (
        <section className="page-container py-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <FiTrendingUp className="text-retomy-green-light" size={20} />
              <h2 className="section-title">Trending Now</h2>
            </div>
            <Link to="/browse?sort_by=downloads" className="text-sm text-retomy-accent hover:underline flex items-center gap-1">
              View All <FiArrowRight size={14} />
            </Link>
          </div>
          <div className="bg-retomy-bg-card rounded-lg p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 browse-grid">
              {data.trending.slice(0, 8).map((d: any) => (
                <div key={d.DatasetId} className="min-w-0">
                  <DatasetCard dataset={d} onAddToCart={handleAddToCart} />
                </div>
              ))}
            </div>
            <div className="mt-3">
              <Link to="/browse?sort_by=downloads" className="text-sm text-retomy-accent hover:underline">
                Browse all data &rarr;
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* New Arrivals */}
      {data.new_arrivals.length > 0 && (
        <section className="page-container py-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <FiZap className="text-retomy-accent" size={20} />
              <h2 className="section-title">New Arrivals</h2>
            </div>
            <Link to="/browse?sort_by=newest" className="text-sm text-retomy-accent hover:underline flex items-center gap-1">
              View All <FiArrowRight size={14} />
            </Link>
          </div>
          <div className="bg-retomy-bg-card rounded-lg p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 browse-grid">
              {data.new_arrivals.slice(0, 4).map((d: any) => (
                <div key={d.DatasetId} className="min-w-0">
                  <DatasetCard dataset={d} onAddToCart={handleAddToCart} />
                </div>
              ))}
            </div>
            <div className="mt-3">
              <Link to="/browse?sort_by=newest" className="text-sm text-retomy-accent hover:underline">
                Browse all data &rarr;
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Categories */}
      {data.categories.length > 0 && (
        <section className="bg-retomy-bg-secondary py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="section-title mb-8">Browse by Category</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
              {data.categories.map((cat: any) => (
                <Link
                  key={cat.CategoryId}
                  to={`/browse?category_id=${cat.CategoryId}`}
                  className="card p-4 hover:border-retomy-accent/40 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-retomy-text-bright text-sm group-hover:text-retomy-accent transition-colors">
                        {cat.Name}
                      </h3>
                      <p className="text-xs text-retomy-text-secondary mt-1">
                        {cat.DatasetCount || 0} data
                      </p>
                    </div>
                    <FiDatabase className="text-retomy-accent/40 group-hover:text-retomy-accent transition-colors" size={20} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Empty state / CTA if no data */}
      {!loading && data.featured.length === 0 && data.trending.length === 0 && (
        <section className="page-container py-20 text-center">
          <div className="max-w-lg mx-auto">
            <FiDatabase className="mx-auto text-retomy-accent/30 mb-6" size={64} />
            <h2 className="text-2xl font-bold text-retomy-text-bright mb-4">
              Marketplace is Ready
            </h2>
            <p className="text-retomy-text-secondary mb-8">
              The retomY marketplace is set up and waiting for data. Sign up as a seller to list your first data, or explore the platform.
            </p>
            <div className="flex justify-center gap-4">
              <Link to="/signup?role=seller" className="btn-primary">Become a Seller</Link>
              <Link to="/browse" className="btn-secondary">Browse Store</Link>
            </div>
          </div>
        </section>
      )}

      {/* CTA Banner */}
      <section className="bg-gradient-to-r from-retomy-accent/10 to-retomy-bg-secondary py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-retomy-text-bright mb-4">
            Ready to monetize your data?
          </h2>
          <p className="text-retomy-text-secondary max-w-lg mx-auto mb-8">
            Join thousands of data providers selling to clients worldwide. 
            Set your price, we handle the rest. Only 15% platform fee.
          </p>
          <Link to="/signup?role=seller" className="btn-primary text-lg !px-10 !py-3">
            Start Selling Today
          </Link>
        </div>
      </section>
    </div>
  );
}
