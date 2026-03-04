import { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { datasetsApi, purchasesApi, getApiError } from '../services/api';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import {
  FiSearch, FiX, FiDatabase, FiTrendingUp, FiSliders,
  FiDownload, FiStar, FiChevronLeft, FiChevronRight,
  FiClock, FiShoppingCart, FiHeart,
} from 'react-icons/fi';
import { formatOwner } from '../utils/name';
import { truncateWords } from '../utils/text';

export default function BrowsePage() {
  const { isAuthenticated } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [datasets, setDatasets] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [localQuery, setLocalQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const query = searchParams.get('query') || '';
  const categoryId = searchParams.get('category_id') || '';
  const sortBy = searchParams.get('sort_by') || 'relevance';
  const pricingModel = searchParams.get('pricing_model') || '';
  const fileFormat = searchParams.get('file_format') || '';
  const page = parseInt(searchParams.get('page') || '1');

  useEffect(() => { setLocalQuery(query); }, [query]);
  useEffect(() => { loadDatasets(); loadCategories(); }, [searchParams.toString()]);

  const loadDatasets = async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: 30 };
      if (query) params.query = query;
      if (categoryId) params.category_id = parseInt(categoryId);
      if (sortBy) params.sort_by = sortBy;
      if (pricingModel) {
        if (pricingModel === 'free') {
          params.min_price = 0;
          params.max_price = 0;
        } else {
          params.pricing_model = pricingModel;
        }
      }
      if (fileFormat) params.file_format = fileFormat;

      const { data } = await datasetsApi.search(params);
      setDatasets(data.datasets || []);
      setTotalCount(data.total_count || 0);
      setTotalPages(data.total_pages || 1);
    } catch {
      toast.error('Failed to load datasets');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const { data } = await datasetsApi.getCategories();
      setCategories(data.categories || []);
    } catch {}
  };

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.set('page', '1');
    setSearchParams(params);
  };

  const clearFilters = () => { setSearchParams({}); };

  const handleAddToCart = async (id: string) => {
    if (!isAuthenticated) { toast.error('Sign in to add to cart'); return; }
    try {
      await purchasesApi.addToCart(id);
      toast.success('Added to cart');
    } catch (e: any) {
      toast.error(getApiError(e, 'Failed to add'));
    }
  };

  const handleLocalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilter('query', localQuery.trim());
  };

  const activeFilterCount = [categoryId, pricingModel, fileFormat].filter(Boolean).length;

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
      {/* ─── Header ────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 via-transparent to-purple-600/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <FiDatabase className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {query ? `Results for "${query}"` : 'Datasets'}
                </h1>
                <p className="text-xs text-white/40 mt-0.5">
                  <span className="inline-flex items-center gap-1">
                    <FiTrendingUp className="w-3 h-3" /> {totalCount.toLocaleString()}
                  </span>{' '}
                  datasets available
                </p>
              </div>
            </div>
          </div>

          {/* Search + Sort row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <form onSubmit={handleLocalSearch} className="relative flex-1 max-w-xl">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                ref={searchInputRef}
                type="text"
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                placeholder="Search datasets..."
                className="w-full pl-9 pr-8 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
              />
              {localQuery && (
                <button type="button" onClick={() => { setLocalQuery(''); updateFilter('query', ''); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
                  <FiX className="w-3.5 h-3.5" />
                </button>
              )}
            </form>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-all ${
                  showFilters || activeFilterCount > 0
                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                    : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                }`}
              >
                <FiSliders className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="ml-1 w-4 h-4 rounded-full bg-indigo-500 text-[10px] flex items-center justify-center text-white font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <select
                value={sortBy}
                onChange={(e) => updateFilter('sort_by', e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg text-sm text-white/60 px-3 py-2 focus:outline-none cursor-pointer hover:bg-white/10 transition-all"
              >
                <option value="relevance">Relevance</option>
                <option value="newest">Newest</option>
                <option value="downloads">Most Downloads</option>
                <option value="rating">Highest Rated</option>
                <option value="price_asc">Price: Low → High</option>
                <option value="price_desc">Price: High → Low</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Filters panel ─────────────────────────────────────────────── */}
      {showFilters && (
        <div className="border-b border-white/5 bg-white/[0.02]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Category */}
              <div>
                <label className="text-xs text-white/40 mb-1.5 block font-medium">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => updateFilter('category_id', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg text-sm text-white/70 px-3 py-2 focus:outline-none appearance-none cursor-pointer"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat: any) => (
                    <option key={cat.CategoryId} value={cat.CategoryId}>{cat.Name}</option>
                  ))}
                </select>
              </div>

              {/* Pricing */}
              <div>
                <label className="text-xs text-white/40 mb-1.5 block font-medium">Pricing</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { value: '', label: 'All' },
                    { value: 'free', label: 'Free' },
                    { value: 'one-time', label: 'Paid' },
                    { value: 'subscription', label: 'Sub' },
                    { value: 'freemium', label: 'Freemium' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => updateFilter('pricing_model', opt.value)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        pricingModel === opt.value
                          ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                          : 'bg-white/5 text-white/40 border border-transparent hover:border-white/10 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* File Format */}
              <div>
                <label className="text-xs text-white/40 mb-1.5 block font-medium">File Format</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { value: '', label: 'All' },
                    { value: 'csv', label: 'CSV' },
                    { value: 'json', label: 'JSON' },
                    { value: 'parquet', label: 'Parquet' },
                    { value: 'xlsx', label: 'Excel' },
                    { value: 'xml', label: 'XML' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => updateFilter('file_format', opt.value)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        fileFormat === opt.value
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : 'bg-white/5 text-white/40 border border-transparent hover:border-white/10 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clear */}
              <div className="flex items-end">
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
                  >
                    <FiX size={12} /> Clear all filters
                  </button>
                )}
              </div>
            </div>

            {/* Active filter chips */}
            {activeFilterCount > 0 && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {categoryId && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/50">
                    {categories.find((c: any) => String(c.CategoryId) === categoryId)?.Name || `Category #${categoryId}`}
                    <button onClick={() => updateFilter('category_id', '')} className="hover:text-white transition-colors"><FiX size={10} /></button>
                  </span>
                )}
                {pricingModel && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/50">
                    {pricingModel === 'free' ? 'Free' : pricingModel === 'one-time' ? 'One-Time' : pricingModel}
                    <button onClick={() => updateFilter('pricing_model', '')} className="hover:text-white transition-colors"><FiX size={10} /></button>
                  </span>
                )}
                {fileFormat && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/50">
                    {fileFormat.toUpperCase()}
                    <button onClick={() => updateFilter('file_format', '')} className="hover:text-white transition-colors"><FiX size={10} /></button>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Dataset card grid ────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 animate-pulse">
                <div className="h-4 w-3/4 bg-white/10 rounded mb-3" />
                <div className="h-3 w-full bg-white/5 rounded mb-2" />
                <div className="h-3 w-1/2 bg-white/5 rounded mb-4" />
                <div className="flex gap-3">
                  <div className="h-3 w-16 bg-white/5 rounded" />
                  <div className="h-3 w-16 bg-white/5 rounded" />
                  <div className="h-3 w-16 bg-white/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : datasets.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/10 flex items-center justify-center mx-auto mb-4">
              <FiSearch className="w-7 h-7 text-white/20" />
            </div>
            <p className="text-white/40 text-lg font-medium mb-1">No datasets found</p>
            <p className="text-white/25 text-sm mb-4">
              {query ? `No results for "${query}". Try different keywords or broaden your filters.` : 'No datasets match your current filters.'}
            </p>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-indigo-500/20 transition-all">
                <FiX size={14} /> Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {datasets.map((d: any) => {
              const id = d.DatasetId || d.dataset_id;
              const title = d.Title || d.title;
              const desc = d.ShortDescription || d.short_description;
              const price = d.Price ?? d.price ?? 0;
              const isFree = d.PricingModel === 'free' || price === 0;
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
                  className="group relative bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:border-indigo-500/30 hover:bg-white/[0.05] transition-all duration-200"
                >
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="text-[13px] font-semibold text-white group-hover:text-indigo-300 transition-colors truncate flex-1">
                      <span className="text-white/40 font-normal">{formatOwner(seller)}{verified ? ' ✓' : ''} / </span>
                      {title}
                    </h3>
                    {/* Price badge */}
                    <span className={`shrink-0 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                      isFree
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-indigo-500/15 text-indigo-400'
                    }`}>
                      {isFree ? 'Free' : `$${price.toFixed(2)}`}
                    </span>
                  </div>

                  {/* Description */}
                  {desc && (
                    <p className="text-[11px] text-white/30 line-clamp-2 mb-2.5 leading-relaxed">
                      {truncateWords(desc, 20)}
                    </p>
                  )}

                  {/* Category tag */}
                  {catName && (
                    <div className="mb-2.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-[11px] text-indigo-300 font-medium">
                        <span>{categoryIcon(catName)}</span>
                        {catName}
                      </span>
                    </div>
                  )}

                  {/* Meta row */}
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

                  {/* Quick actions (show on hover) */}
                  <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAddToCart(id); }}
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

        {/* ─── Pagination ──────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              disabled={page <= 1}
              onClick={() => page > 1 && updateFilter('page', String(page - 1))}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white/50 hover:bg-white/10 disabled:opacity-30 transition-all"
            >
              <FiChevronLeft className="w-4 h-4" /> Previous
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (page <= 4) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = page - 3 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => updateFilter('page', String(pageNum))}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                      page === pageNum
                        ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-300'
                        : 'text-white/40 hover:bg-white/10'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              disabled={page >= totalPages}
              onClick={() => page < totalPages && updateFilter('page', String(page + 1))}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white/50 hover:bg-white/10 disabled:opacity-30 transition-all"
            >
              Next <FiChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
