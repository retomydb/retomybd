import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import DatasetCard from '../components/DatasetCard';
import { datasetsApi, purchasesApi, getApiError } from '../services/api';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { FiFilter, FiGrid, FiList, FiSearch, FiX } from 'react-icons/fi';

export default function BrowsePage() {
  const { isAuthenticated } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [datasets, setDatasets] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(true);

  const query = searchParams.get('query') || '';
  const categoryId = searchParams.get('category_id') || '';
  const sortBy = searchParams.get('sort_by') || 'relevance';
  const pricingModel = searchParams.get('pricing_model') || '';
  const fileFormat = searchParams.get('file_format') || '';
  const page = parseInt(searchParams.get('page') || '1');

  useEffect(() => {
    loadDatasets();
    loadCategories();
  }, [searchParams.toString()]);

  const loadDatasets = async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: 20 };
      if (query) params.query = query;
      if (categoryId) params.category_id = parseInt(categoryId);
      if (sortBy) params.sort_by = sortBy;
      if (pricingModel) params.pricing_model = pricingModel;
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

  const clearFilters = () => {
    setSearchParams({});
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

  const activeFilterCount = [categoryId, pricingModel, fileFormat].filter(Boolean).length;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-retomy-text-bright">
            {query ? `Results for "${query}"` : 'Browse Datasets'}
          </h1>
          <p className="text-sm text-retomy-text-secondary mt-1">
            {totalCount} dataset{totalCount !== 1 ? 's' : ''} available
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary !px-3 !py-2 text-sm flex items-center gap-2 ${showFilters ? 'border-retomy-accent' : ''}`}
          >
            <FiFilter size={14} /> Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>
          <div className="flex border border-retomy-border rounded-sm">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-retomy-bg-hover text-retomy-accent' : 'text-retomy-text-secondary'}`}
            >
              <FiGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-retomy-bg-hover text-retomy-accent' : 'text-retomy-text-secondary'}`}
            >
              <FiList size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Filters */}
        {showFilters && (
          <aside className="w-64 flex-shrink-0">
            <div className="card p-4 space-y-5 sticky top-20">
              {/* Sort */}
              <div>
                <label className="label">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => updateFilter('sort_by', e.target.value)}
                  className="input-field text-sm"
                >
                  <option value="relevance">Relevance</option>
                  <option value="newest">Newest</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="rating">Highest Rated</option>
                  <option value="downloads">Most Downloaded</option>
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="label">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => updateFilter('category_id', e.target.value)}
                  className="input-field text-sm"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat: any) => (
                    <option key={cat.CategoryId} value={cat.CategoryId}>{cat.Name}</option>
                  ))}
                </select>
              </div>

              {/* Pricing Model */}
              <div>
                <label className="label">Pricing</label>
                <select
                  value={pricingModel}
                  onChange={(e) => updateFilter('pricing_model', e.target.value)}
                  className="input-field text-sm"
                >
                  <option value="">All</option>
                  <option value="free">Free</option>
                  <option value="one-time">One-Time Purchase</option>
                  <option value="subscription">Subscription</option>
                  <option value="freemium">Freemium</option>
                </select>
              </div>

              {/* File Format */}
              <div>
                <label className="label">File Format</label>
                <select
                  value={fileFormat}
                  onChange={(e) => updateFilter('file_format', e.target.value)}
                  className="input-field text-sm"
                >
                  <option value="">All Formats</option>
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                  <option value="parquet">Parquet</option>
                  <option value="xlsx">Excel</option>
                  <option value="xml">XML</option>
                </select>
              </div>

              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="text-sm text-retomy-accent hover:underline flex items-center gap-1">
                  <FiX size={12} /> Clear all filters
                </button>
              )}
            </div>
          </aside>
        )}

        {/* Results */}
        <main className="flex-1">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card animate-pulse">
                  <div className="h-36 bg-retomy-bg-hover" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-retomy-bg-hover rounded w-3/4" />
                    <div className="h-3 bg-retomy-bg-hover rounded w-full" />
                    <div className="h-3 bg-retomy-bg-hover rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : datasets.length === 0 ? (
            <div className="text-center py-20">
              <FiSearch className="mx-auto text-retomy-text-secondary mb-4" size={48} />
              <h3 className="text-xl font-semibold text-retomy-text-bright mb-2">No datasets found</h3>
              <p className="text-retomy-text-secondary mb-6">
                {query ? `No results for "${query}". Try different keywords.` : 'No datasets match your filters.'}
              </p>
              <button onClick={clearFilters} className="btn-secondary">Clear Filters</button>
            </div>
          ) : (
            <>
              <div className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
                  : 'space-y-3'
              }>
                {datasets.map((dataset: any) => (
                  viewMode === 'grid' ? (
                    <DatasetCard key={dataset.DatasetId} dataset={dataset} onAddToCart={handleAddToCart} />
                  ) : (
                    <Link key={dataset.DatasetId} to={`/dataset/${dataset.DatasetId}`}
                      className="card p-4 flex gap-4 hover:border-retomy-accent/40 transition-all">
                      <div className="w-24 h-20 bg-retomy-bg-hover rounded flex-shrink-0 flex items-center justify-center">
                        <span className="text-xs text-retomy-text-secondary uppercase">
                          {dataset.FileFormat || 'DATA'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-retomy-text-bright truncate">{dataset.Title}</h3>
                        <p className="text-sm text-retomy-text-secondary line-clamp-1 mt-1">{dataset.ShortDescription}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-retomy-text-secondary">
                          <span>{dataset.SellerName}</span>
                          <span>{dataset.TotalDownloads || 0} downloads</span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="text-lg font-bold price-tag">
                          {dataset.Price === 0 ? 'Free' : `$${dataset.Price?.toFixed(2)}`}
                        </div>
                      </div>
                    </Link>
                  )
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-8">
                  {page > 1 && (
                    <button
                      onClick={() => updateFilter('page', String(page - 1))}
                      className="btn-secondary !px-4 !py-2 text-sm"
                    >
                      Previous
                    </button>
                  )}
                  <span className="text-sm text-retomy-text-secondary px-4">
                    Page {page} of {totalPages}
                  </span>
                  {page < totalPages && (
                    <button
                      onClick={() => updateFilter('page', String(page + 1))}
                      className="btn-secondary !px-4 !py-2 text-sm"
                    >
                      Next
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
