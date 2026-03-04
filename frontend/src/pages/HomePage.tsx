import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DatasetCard from '../components/DatasetCard';
import { formatOwner } from '../utils/name';
import { truncateWords } from '../utils/text';
import PipelineAnimation from '../components/PipelineAnimationV2';
import { datasetsApi, purchasesApi, getApiError, modelsApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import {
  FiDatabase, FiUsers, FiDownload, FiShield, FiArrowRight,
  FiTrendingUp, FiStar, FiZap, FiLock, FiCode, FiDollarSign, FiShoppingCart, FiClock
} from 'react-icons/fi';

export default function HomePage() {
  const { isAuthenticated } = useAuthStore();
  const [data, setData] = useState<any>({
    featured: [], trending: [], new_arrivals: [], categories: [], platform_stats: {}
  });
  const [modelCategories, setModelCategories] = useState<any[]>([]);
  const MODEL_CATEGORY_FALLBACK = [
    'Audio-Text-to-Text', 'Image-Text-to-Text', 'Image-Text-to-Image', 'Image-Text-to-Video',
    'Visual Question Answering', 'Document Question Answering', 'Video-Text-to-Text',
    'Visual Document Retrieval', 'Any-to-Any', 'Computer Vision', 'Depth Estimation',
    'Image Classification', 'Object Detection', 'Image Segmentation', 'Text-to-Image',
    'Image-to-Text', 'Image-to-Image', 'Image-to-Video', 'Unconditional Image Generation',
    'Video Classification', 'Text-to-Video', 'Zero-Shot Image Classification', 'Mask Generation',
    'Zero-Shot Object Detection', 'Text-to-3D', 'Image-to-3D', 'Image Feature Extraction',
    'Keypoint Detection', 'Video-to-Video', 'Natural Language Processing', 'Text Classification',
    'Token Classification', 'Table Question Answering', 'Question Answering', 'Zero-Shot Classification',
    'Translation', 'Summarization', 'Feature Extraction', 'Text Generation', 'Fill-Mask',
    'Sentence Similarity', 'Text Ranking'
  ].map((n) => ({ name: n, count: 0 }));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: result } = await datasetsApi.getFeatured();
      setData(result);
      // load model category filter options
      try {
        const { data: modelOpts } = await modelsApi.filterOptions();
        const cats = modelOpts.categories || modelOpts.options?.categories || [];
        setModelCategories((cats && cats.length > 0) ? cats : MODEL_CATEGORY_FALLBACK);
      } catch (e) {
        setModelCategories(MODEL_CATEGORY_FALLBACK);
      }
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

  function formatNumber(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n || 0);
  }

  function formatSize(bytes: number | null) {
    if (!bytes) return null;
    if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
    if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
    if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(0)} KB`;
    return `${bytes} B`;
  }

  function timeAgo(dateStr?: string) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
  }

  function categoryIcon(cat: string | null) {
    if (!cat) return '📊';
    const map: Record<string, string> = {
      'finance': '💰', 'financial': '💰', 'healthcare': '🏥', 'health': '🏥',
      'education': '📚', 'technology': '💻', 'tech': '💻', 'science': '🔬',
      'sports': '⚽', 'entertainment': '🎬', 'social': '👥', 'media': '📱',
      'government': '🏛️', 'energy': '⚡', 'transportation': '🚗', 'environment': '🌍',
      'real estate': '🏠', 'agriculture': '🌾', 'retail': '🛒', 'ecommerce': '🛒',
      'nlp': '📝', 'text': '📝', 'image': '🖼️', 'audio': '🔊', 'video': '🎥',
      'geospatial': '🗺️', 'weather': '🌤️', 'climate': '🌡️',
    };
    const lower = cat.toLowerCase();
    for (const [key, icon] of Object.entries(map)) {
      if (lower.includes(key)) return icon;
    }
    return '📊';
  }

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
              <Link
                to="/browse"
                className="group relative inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-7 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/40 hover:scale-[1.03] active:scale-[0.98]"
              >
                Explore Data <FiArrowRight className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              {!isAuthenticated && (
                <Link
                  to="/signup?role=seller"
                  className="inline-flex items-center rounded-full border border-retomy-border px-7 py-2.5 text-sm font-semibold text-retomy-text-bright backdrop-blur-sm transition-all duration-300 hover:border-purple-500/60 hover:bg-purple-500/10 hover:shadow-lg hover:shadow-purple-500/10 hover:scale-[1.03] active:scale-[0.98]"
                >
                  Get Started
                </Link>
              )}
            </div>
          </div>
          {/* Decorative animated pipeline on the right of the hero text */}
          <PipelineAnimation />

          {/* Stats Cards - modern responsive layout */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mt-28 pt-8">
            {/* Datasets + Free combined */}
            <div className="animated-border-box p-4 flex flex-col items-center justify-center text-center hover:shadow-lg transition-shadow" style={{ '--border-color': '#6366f1' } as React.CSSProperties}>
              <div className="w-10 h-10 rounded-full bg-indigo-400/10 flex items-center justify-center mb-2">
                <FiDatabase className="text-indigo-400" size={18} />
              </div>
              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="flex flex-col items-center">
                  <div className="text-2xl lg:text-3xl font-extrabold text-retomy-text-bright">{stats.TotalDatasets ?? '0'}</div>
                  <div className="text-[10px] uppercase text-retomy-text-secondary tracking-widest mt-1">Datasets</div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="text-2xl lg:text-3xl font-extrabold text-retomy-text-bright">{stats.FreeDatasets ?? '0'}</div>
                  <div className="text-[10px] uppercase text-retomy-text-secondary tracking-widest mt-1">Free</div>
                </div>
              </div>
            </div>

            {/* Data Providers */}
            <div className="animated-border-box p-4 flex flex-col items-center justify-center text-center hover:shadow-lg transition-shadow" style={{ '--border-color': '#a78bfa' } as React.CSSProperties}>
              <div className="w-10 h-10 rounded-full bg-purple-400/10 flex items-center justify-center mb-2">
                <FiUsers className="text-purple-400" size={18} />
              </div>
              <div className="text-2xl lg:text-3xl font-extrabold text-retomy-text-bright">{stats.TotalSellers || '0'}</div>
              <div className="text-[10px] uppercase text-retomy-text-secondary tracking-widest mt-1">Data Providers</div>
            </div>

            {/* Active Users */}
            <div className="animated-border-box p-4 flex flex-col items-center justify-center text-center hover:shadow-lg transition-shadow" style={{ '--border-color': '#34d399' } as React.CSSProperties}>
              <div className="w-10 h-10 rounded-full bg-emerald-400/10 flex items-center justify-center mb-2">
                <FiUsers className="text-emerald-400" size={18} />
              </div>
              <div className="text-2xl lg:text-3xl font-extrabold text-retomy-text-bright">{stats.TotalUsers || '0'}</div>
              <div className="text-[10px] uppercase text-retomy-text-secondary tracking-widest mt-1">Active Users</div>
            </div>

            {/* Total Downloads */}
            <div className="animated-border-box p-4 flex flex-col items-center justify-center text-center hover:shadow-lg transition-shadow" style={{ '--border-color': '#fbbf24' } as React.CSSProperties}>
              <div className="w-10 h-10 rounded-full bg-amber-400/10 flex items-center justify-center mb-2">
                <FiDownload className="text-amber-400" size={18} />
              </div>
              <div className="text-2xl lg:text-3xl font-extrabold text-retomy-text-bright">{(stats.TotalDownloads || 0).toLocaleString()}</div>
              <div className="text-[10px] uppercase text-retomy-text-secondary tracking-widest mt-1">Downloads</div>
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
        <section className="page-container py-6">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
              {data.trending.slice(0, 8).map((d: any) => {
                const id = d.DatasetId || d.dataset_id;
                const title = d.Title || d.title;
                const desc = d.ShortDescription || d.short_description;
                const price = d.Price ?? d.price ?? 0;
                const isFree = (d.PricingModel || d.pricing_model) === 'free' || price === 0;
                const seller = d.SellerName || d.seller_name;
                const verified = d.IsSellerVerified || d.is_seller_verified;
                const catName = d.CategoryName || d.category_name;
                const format = (d.FileFormat || d.file_format || '').toUpperCase();
                const downloads = d.TotalDownloads || d.total_downloads || 0;
                const rating = d.AverageRating || d.average_rating;
                const reviews = d.TotalReviews || d.total_reviews || 0;
                const rows = d.RowCount || d.row_count;
                const fileSize = d.FileSize || d.file_size;
                const published = d.PublishedAt || d.published_at;

                return (
                  <Link
                    key={id}
                    to={`/dataset/${id}`}
                           className="group relative bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 hover:border-indigo-500/30 hover:bg-white/[0.05] transition-all duration-200"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="text-[13px] font-semibold text-white group-hover:text-indigo-300 transition-colors truncate flex-1">
                        <span className="text-white/40 font-normal">{formatOwner(seller)}{verified ? ' ✓' : ''} / </span>
                        {title}
                      </h3>
                      <span className={`shrink-0 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                        isFree ? 'bg-emerald-500/15 text-emerald-400' : 'bg-indigo-500/15 text-indigo-400'
                      }`}>
                        {isFree ? 'Free' : `$${price.toFixed(2)}`}
                      </span>
                    </div>

                    {/* description redacted for compact layout */}

                    {catName && (
                      <div className="mb-2.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-[11px] text-indigo-300 font-medium">
                          <span>{categoryIcon(catName)}</span>
                          {catName}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-white/30 flex-wrap">
                      {format && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-[10px] text-purple-400/70 font-medium">
                          {format}
                        </span>
                      )}

                      {fileSize != null && formatSize(fileSize) && (
                        <span>{formatSize(fileSize)}</span>
                      )}

                      {rows != null && rows > 0 && (
                        <span>{formatNumber(rows)} rows</span>
                      )}

                      {published && (
                        <span className="inline-flex items-center gap-0.5">
                          <FiClock className="w-3 h-3" />
                          {timeAgo(published)}
                        </span>
                      )}

                      <span className="inline-flex items-center gap-0.5">
                        <FiDownload className="w-3 h-3" />
                        {formatNumber(downloads)}
                      </span>

                      {rating != null && rating > 0 && (
                        <span className="inline-flex items-center gap-0.5">
                          <FiStar className="w-3 h-3 text-amber-400/60" />
                          {Number(rating).toFixed(1)}
                          {reviews > 0 && <span className="text-white/20">({reviews})</span>}
                        </span>
                      )}
                    </div>

                           <div className="mt-2 border-t border-white/5 pt-2" />
                  </Link>
                );
              })}
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
        <section className="page-container py-6">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
              {data.new_arrivals.slice(0, 8).map((d: any) => {
                const id = d.DatasetId || d.dataset_id;
                const title = d.Title || d.title;
                const desc = d.ShortDescription || d.short_description;
                const price = d.Price ?? d.price ?? 0;
                const isFree = (d.PricingModel || d.pricing_model) === 'free' || price === 0;
                const seller = d.SellerName || d.seller_name;
                const verified = d.IsSellerVerified || d.is_seller_verified;
                const catName = d.CategoryName || d.category_name;
                const format = (d.FileFormat || d.file_format || '').toUpperCase();
                const downloads = d.TotalDownloads || d.total_downloads || 0;
                const rating = d.AverageRating || d.average_rating;
                const reviews = d.TotalReviews || d.total_reviews || 0;
                const rows = d.RowCount || d.row_count;
                const fileSize = d.FileSize || d.file_size;
                const published = d.PublishedAt || d.published_at;

                return (
                  <Link
                    key={id}
                    to={`/dataset/${id}`}
                    className="group relative bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 hover:border-indigo-500/30 hover:bg-white/[0.05] transition-all duration-200"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="text-[13px] font-semibold text-white group-hover:text-indigo-300 transition-colors truncate flex-1">
                        <span className="text-white/40 font-normal">{formatOwner(seller)}{verified ? ' ✓' : ''} / </span>
                        {title}
                      </h3>
                      <span className={`shrink-0 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                        isFree ? 'bg-emerald-500/15 text-emerald-400' : 'bg-indigo-500/15 text-indigo-400'
                      }`}>
                        {isFree ? 'Free' : `$${price.toFixed(2)}`}
                      </span>
                    </div>

                    {/* description redacted for compact layout */}

                    {catName && (
                      <div className="mb-2.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-[11px] text-indigo-300 font-medium">
                          <span>{categoryIcon(catName)}</span>
                          {catName}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-[10px] text-white/30 flex-wrap mt-2">
                      {format && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-[10px] text-purple-400/70 font-medium">
                          {format}
                        </span>
                      )}

                      {fileSize != null && formatSize(fileSize) && (
                        <span>{formatSize(fileSize)}</span>
                      )}

                      {rows != null && rows > 0 && (
                        <span>{formatNumber(rows)} rows</span>
                      )}

                      {published && (
                        <span className="inline-flex items-center gap-0.5">
                          <FiClock className="w-3 h-3" />
                          {timeAgo(published)}
                        </span>
                      )}

                      <span className="inline-flex items-center gap-0.5">
                        <FiDownload className="w-3 h-3" />
                        {formatNumber(downloads)}
                      </span>

                      {rating != null && rating > 0 && (
                        <span className="inline-flex items-center gap-0.5">
                          <FiStar className="w-3 h-3 text-amber-400/60" />
                          {Number(rating).toFixed(1)}
                          {reviews > 0 && <span className="text-white/20">({reviews})</span>}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 border-t border-white/5 pt-2" />
                  </Link>
                );
              })}
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
            <h2 className="text-lg font-semibold text-white mb-6">Browse by Category</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Data categories (left) */}
                <div>
                  <div className="mb-4 text-sm text-white/80 font-medium">Data</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {data.categories.slice(0,18).map((cat: any) => (
                      <Link
                        key={cat.CategoryId}
                        to={`/browse?category_id=${cat.CategoryId}`}
                        className="relative overflow-hidden bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 hover:bg-white/[0.06] hover:border-white/15 transition-all group"
                      >
                        <div className="absolute -top-6 -right-6 w-16 h-16 bg-indigo-500/10 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative flex items-center justify-between">
                          <div className="min-w-0">
                            <h3 className="font-medium text-white text-xs truncate group-hover:text-indigo-400 transition-colors">
                              {cat.Name}
                            </h3>
                            <p className="text-[10px] text-retomy-text-secondary mt-0.5">
                              {cat.DatasetCount || 0} data
                            </p>
                          </div>
                          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                            <FiDatabase className="text-indigo-400/60 group-hover:text-indigo-400 transition-colors" size={14} />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <div className="mt-3">
                    <Link to="/browse" className="text-sm text-retomy-accent hover:underline">
                      Browse all data &rarr;
                    </Link>
                  </div>
                </div>

                {/* Model categories (right) */}
                <div className="md:pl-6 md:border-l md:border-white/5">
                  <div className="mb-4 text-sm text-white/80 font-medium">Models</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {modelCategories.length > 0 ? modelCategories.slice(0,18).map((mc: any) => (
                      <Link
                        key={mc.id || mc.name}
                        to={`/models?category=${encodeURIComponent(mc.name || mc.id)}`}
                        className="relative overflow-hidden bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 hover:bg-white/[0.06] hover:border-white/15 transition-all group"
                      >
                        <div className="relative flex items-center justify-between">
                          <div className="min-w-0">
                            <h3 className="font-medium text-white text-xs truncate group-hover:text-violet-300 transition-colors">
                              {mc.name || mc.display_name || mc.id}
                            </h3>
                            <p className="text-[10px] text-retomy-text-secondary mt-0.5">
                              {mc.count || mc.model_count || 0} models
                            </p>
                          </div>
                          <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                            <FiCode className="text-violet-400/60 group-hover:text-violet-400 transition-colors" size={14} />
                          </div>
                        </div>
                      </Link>
                    )) : (
                      <div className="text-sm text-retomy-text-secondary">No model categories available</div>
                    )}
                  </div>
                  <div className="mt-3 md:pl-6 md:mt-0">
                    <Link to="/models" className="text-sm text-retomy-accent hover:underline">
                      Browse all models &rarr;
                    </Link>
                  </div>
                </div>
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
      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 via-retomy-bg/80 to-purple-600/10" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/8 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-purple-500/8 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-xs text-indigo-400 font-medium mb-6">
            <FiDollarSign size={12} /> Only 15% platform fee
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to monetize your data?
          </h2>
          <p className="text-retomy-text-secondary max-w-lg mx-auto mb-8 leading-relaxed">
            Join thousands of data providers selling to clients worldwide.
            Set your price, we handle the rest.
          </p>
          <Link
            to="/signup?role=seller"
            className="inline-flex items-center gap-2 px-10 py-3.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-lg font-medium hover:shadow-lg hover:shadow-indigo-500/25 transition-all hover:scale-105"
          >
            Get Started Today <FiArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}
