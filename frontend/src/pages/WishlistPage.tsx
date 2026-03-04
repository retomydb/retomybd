import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { datasetsApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { FiHeart, FiArrowRight, FiClock, FiDownload, FiStar, FiShoppingCart } from 'react-icons/fi';
import { formatOwner } from '../utils/name';
import { truncateWords } from '../utils/text';

export default function WishlistPage() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    loadWishlist();
  }, []);

  const loadWishlist = async () => {
    try {
      const { data } = await datasetsApi.search({ wishlisted: true });
      setDatasets(data.datasets || []);
    } catch { }
    finally { setLoading(false); }
  };

  function formatNumber(n: number) {
    if (n == null) return '0';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
  }

  function formatSize(bytes: number | null) {
    if (!bytes && bytes !== 0) return null;
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

  if (loading) {
    return (
      <div className="min-h-screen bg-retomy-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div className="h-20 bg-white/[0.03] rounded-2xl animate-shimmer" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-56 bg-white/[0.03] border border-white/5 rounded-2xl animate-shimmer" style={{ animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-retomy-surface">
      {/* Header Banner */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-pink-600/8 via-retomy-bg/80 to-rose-600/8" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/3 w-80 h-80 bg-rose-500/5 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
              <FiHeart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">My Wishlist</h1>
              <p className="text-sm text-retomy-text-secondary">
                {datasets.length > 0 ? `${datasets.length} saved item${datasets.length !== 1 ? 's' : ''}` : 'Data you\'ve saved for later'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {datasets.length === 0 ? (
          <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-pink-500/10 border border-white/10 flex items-center justify-center">
              <FiHeart className="text-pink-400" size={28} />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">No wishlisted data</h2>
            <p className="text-sm text-retomy-text-secondary mb-6">Save data you're interested in for later.</p>
            <Link to="/browse" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-pink-500/20 hover:scale-105 transition-all">
              Browse Data <FiArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {datasets.map((d: any) => {
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
              const published = d.PublishedAt || d.published_at || d.UpdatedAt || d.updated_at;

              return (
                <Link
                  key={id}
                  to={`/dataset/${id}`}
                  className="group relative bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:border-indigo-500/30 hover:bg-white/[0.05] transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="text-[13px] font-semibold text-white group-hover:text-indigo-300 transition-colors truncate flex-1">
                      <span className="text-white/40 font-normal">{formatOwner(seller)}{verified ? ' ✓' : ''} / </span>
                      {title}
                    </h3>
                    <span className={`shrink-0 px-2 py-0.5 rounded-md text-[11px] font-semibold ${isFree ? 'bg-emerald-500/15 text-emerald-400' : 'bg-indigo-500/15 text-indigo-400'}`}>
                      {isFree ? 'Free' : `$${price.toFixed(2)}`}
                    </span>
                  </div>

                  {desc && (
                    <p className="text-[11px] text-white/30 line-clamp-2 mb-2.5 leading-relaxed">
                      {truncateWords(desc, 20)}
                    </p>
                  )}

                  {catName && (
                    <div className="mb-2.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-[11px] text-indigo-300 font-medium">
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
                        {Number(rating).toFixed(1)}{reviews > 0 && <span className="text-white/20">({reviews})</span>}
                      </span>
                    )}
                  </div>

                  <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); /* add to cart logic if desired */ }}
                      className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-white/40 hover:text-indigo-400 hover:bg-indigo-500/20 transition-all"
                      title="Add to Cart"
                    >
                      <FiShoppingCart size={11} />
                    </button>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
