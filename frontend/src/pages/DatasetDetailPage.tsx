import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { datasetsApi, purchasesApi, paymentsApi, getApiError } from '../services/api';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import {
  FiStar, FiDownload, FiEye, FiShoppingCart, FiHeart,
  FiCalendar, FiDatabase, FiFile, FiLock, FiShield,
  FiUser, FiCheck, FiArrowLeft
} from 'react-icons/fi';
import { formatOwner } from '../utils/name';
import PreviewPane from '../components/PreviewPane';
import DatasetRetrievalDocs from '../components/DatasetRetrievalDocs';

export default function DatasetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const [dataset, setDataset] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', content: '' });

  useEffect(() => {
    if (id) loadDataset();
  }, [id]);

  const loadDataset = async () => {
    try {
      const { data } = await datasetsApi.getDetail(id!);
      setDataset(data.dataset);
      setReviews(data.reviews || []);
    } catch {
      toast.error('Dataset not found');
      navigate('/browse');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    const isFree = dataset?.Price === 0 || dataset?.PricingModel === 'free';

    if (isFree) {
      // Free datasets — process directly
      try {
        const { data } = await purchasesApi.purchase({ dataset_id: id! });
        if (data.purchase?.download_url) {
          toast.success('Access granted! Starting download...');
          const a = document.createElement('a');
          a.href = data.purchase.download_url;
          a.download = '';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else {
          toast.success('Access granted! Check your dashboard.');
        }
        loadDataset();
      } catch (e: any) {
        toast.error(getApiError(e, 'Failed to get access'));
      }
    } else {
      // Paid datasets — redirect to Stripe Checkout
      try {
        const { data } = await paymentsApi.createSingleCheckout(id!);
        if (data.checkout_url) {
          window.location.href = data.checkout_url;
        } else if (data.free) {
          toast.success('Access granted!');
          loadDataset();
        }
      } catch (e: any) {
        toast.error(getApiError(e, 'Checkout failed'));
      }
    }
  };

  const handleDownload = async () => {
    try {
      const { data } = await purchasesApi.downloadByDataset(id!);
      if (data.download_url) {
        const a = document.createElement('a');
        a.href = data.download_url;
        a.download = data.title || 'dataset';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success('Download started!');
      } else {
        toast.error('No files available for download yet');
      }
    } catch (e: any) {
      toast.error(getApiError(e, 'Download failed'));
    }
  };

  const handleAddToCart = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    try {
      await purchasesApi.addToCart(id!);
      toast.success('Added to cart');
    } catch (e: any) {
      toast.error(getApiError(e, 'Failed'));
    }
  };

  const handleWishlist = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    try {
      const { data } = await datasetsApi.toggleWishlist(id!);
      toast.success(data.action === 'added' ? 'Added to wishlist' : 'Removed from wishlist');
    } catch { toast.error('Failed'); }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await datasetsApi.submitReview(id!, reviewForm);
      toast.success('Review submitted');
      loadDataset();
      setReviewForm({ rating: 5, title: '', content: '' });
    } catch (e: any) {
      toast.error(getApiError(e, 'Failed to submit review'));
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-retomy-bg-hover rounded w-1/3" />
          <div className="h-64 bg-retomy-bg-hover rounded" />
          <div className="h-4 bg-retomy-bg-hover rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (!dataset) return null;

  const formatSize = (bytes: number) => {
    if (!bytes) return 'N/A';
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
  };

  return (
    <div className="page-container">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-retomy-text-secondary mb-4">
        <Link to="/browse" className="hover:text-retomy-accent flex items-center gap-1">
          <FiArrowLeft size={14} /> Store
        </Link>
        <span>/</span>
        {dataset.CategoryName && <><Link to={`/browse?category_id=${dataset.CategoryId}`} className="hover:text-retomy-accent">{dataset.CategoryName}</Link><span>/</span></>}
        <span className="text-retomy-text">{dataset.Title}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Hero / Banner */}
          <div className="card overflow-hidden">
            <div className="h-56 bg-gradient-to-br from-retomy-bg-hover to-retomy-surface flex items-center justify-center">
              <div className="text-center">
                <FiDatabase className="mx-auto text-retomy-accent/20 mb-2" size={48} />
                <span className="text-lg text-retomy-accent/40 uppercase font-bold">
                  {dataset.FileFormat || 'Dataset'}
                </span>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-retomy-text-bright">{dataset.Title}</h1>
                  <p className="text-retomy-text-secondary mt-2">{dataset.ShortDescription}</p>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="flex flex-wrap items-center gap-6 mt-4 text-sm text-retomy-text-secondary">
                {dataset.AverageRating && (
                  <span className="flex items-center gap-1">
                    <FiStar className="text-retomy-gold" />
                    {Number(dataset.AverageRating).toFixed(1)} ({dataset.TotalReviews} reviews)
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <FiDownload /> {dataset.TotalDownloads || 0} downloads
                </span>
                <span className="flex items-center gap-1">
                  <FiEye /> {dataset.TotalViews || 0} views
                </span>
                <span className="flex items-center gap-1">
                  <FiCalendar /> {dataset.PublishedAt ? new Date(dataset.PublishedAt).toLocaleDateString() : 'Draft'}
                </span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-retomy-border/30">
            <div className="flex gap-6">
              {['overview', 'preview', 'schema', 'retrieve', 'reviews', 'license'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 text-sm font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? 'text-retomy-accent border-b-2 border-retomy-accent'
                      : 'text-retomy-text-secondary hover:text-retomy-text-bright'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="card p-6">
            {activeTab === 'overview' && (
              <div className="prose prose-invert max-w-none">
                <div className="text-retomy-text whitespace-pre-wrap">
                  {dataset.FullDescription || dataset.ShortDescription}
                </div>
                {dataset.Tags && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-retomy-text-bright mb-2">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {JSON.parse(dataset.Tags || '[]').map((tag: string, i: number) => (
                        <Link key={i} to={`/browse?query=${tag}`} className="badge-accent cursor-pointer hover:bg-retomy-accent/30">
                          {tag}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'preview' && (
              <div>
                <PreviewPane datasetId={id} dataset={dataset} rows={5} />
              </div>
            )}

            {activeTab === 'schema' && (
              <div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-retomy-bg rounded">
                    <span className="text-xs text-retomy-text-secondary">Format</span>
                    <p className="text-sm font-semibold text-retomy-text-bright uppercase">{dataset.FileFormat || 'N/A'}</p>
                  </div>
                  <div className="p-3 bg-retomy-bg rounded">
                    <span className="text-xs text-retomy-text-secondary">Size</span>
                    <p className="text-sm font-semibold text-retomy-text-bright">{formatSize(dataset.FileSize)}</p>
                  </div>
                  <div className="p-3 bg-retomy-bg rounded">
                    <span className="text-xs text-retomy-text-secondary">Rows</span>
                    <p className="text-sm font-semibold text-retomy-text-bright">{dataset.RowCount?.toLocaleString() || 'N/A'}</p>
                  </div>
                  <div className="p-3 bg-retomy-bg rounded">
                    <span className="text-xs text-retomy-text-secondary">Columns</span>
                    <p className="text-sm font-semibold text-retomy-text-bright">{dataset.ColumnCount || 'N/A'}</p>
                  </div>
                </div>
                {dataset.SchemaDefinition && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-retomy-text-bright mb-2">Schema</h3>
                    <pre className="bg-retomy-bg p-4 rounded text-xs text-retomy-text font-mono overflow-x-auto">
                      {JSON.stringify(JSON.parse(dataset.SchemaDefinition), null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'retrieve' && (
              <div>
                <DatasetRetrievalDocs datasetId={id!} dataset={dataset} />
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-6">
                {/* Review Form */}
                {isAuthenticated && (
                  <form onSubmit={handleSubmitReview} className="border-b border-retomy-border/30 pb-6">
                    <h3 className="text-sm font-semibold text-retomy-text-bright mb-3">Write a Review</h3>
                    <div className="flex gap-1 mb-3">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button key={star} type="button" onClick={() => setReviewForm({ ...reviewForm, rating: star })}>
                          <FiStar
                            size={20}
                            className={star <= reviewForm.rating ? 'text-retomy-gold fill-retomy-gold' : 'text-retomy-text-secondary'}
                          />
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={reviewForm.title}
                      onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
                      placeholder="Review title (optional)"
                      className="input-field mb-2 text-sm"
                    />
                    <textarea
                      value={reviewForm.content}
                      onChange={(e) => setReviewForm({ ...reviewForm, content: e.target.value })}
                      placeholder="Share your experience..."
                      className="input-field text-sm min-h-[80px]"
                    />
                    <button type="submit" className="btn-primary mt-3 text-sm">Submit Review</button>
                  </form>
                )}

                {/* Reviews List */}
                {reviews.length === 0 ? (
                  <p className="text-retomy-text-secondary text-center py-6">No reviews yet. Be the first!</p>
                ) : (
                  reviews.map((review: any) => (
                    <div key={review.ReviewId} className="border-b border-retomy-border/20 pb-4 last:border-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(s => (
                            <FiStar key={s} size={12} className={s <= review.Rating ? 'text-retomy-gold fill-retomy-gold' : 'text-retomy-text-secondary'} />
                          ))}
                        </div>
                        <span className="text-sm font-medium text-retomy-text-bright">{review.ReviewerName}</span>
                        {review.IsVerifiedPurchase && <span className="badge-green !text-[10px]"><FiCheck size={8} className="mr-0.5" /> Verified</span>}
                        <span className="text-xs text-retomy-text-secondary">{new Date(review.CreatedAt).toLocaleDateString()}</span>
                      </div>
                      {review.Title && <p className="font-medium text-sm text-retomy-text-bright">{review.Title}</p>}
                      {review.Content && <p className="text-sm text-retomy-text mt-1">{review.Content}</p>}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'license' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <FiShield className="text-retomy-accent" />
                  <span className="font-semibold text-retomy-text-bright">{dataset.LicenseType || 'Standard'} License</span>
                </div>
                <p className="text-sm text-retomy-text">
                  {dataset.LicenseText || 'This dataset is provided under a standard license. By purchasing, you agree to use the data in accordance with the terms. Commercial use permitted. Redistribution prohibited without consent.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Purchase Card */}
          <div className="card p-6 sticky top-20">
            <div className="text-sm font-semibold text-retomy-text-bright mb-1">
              {dataset.Price === 0 || dataset.PricingModel === 'free' ? (
                <span className="text-retomy-accent">Free</span>
              ) : (
                <span className="price-tag">${Number(dataset.Price).toFixed(2)}</span>
              )}
            </div>
            <p className="text-xs text-retomy-text-secondary mb-4 capitalize">{dataset.PricingModel || 'One-Time'} purchase</p>

            {user && dataset.SellerId === user.user_id ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-retomy-accent text-sm">
                  <FiCheck /> Your Dataset
                </div>
                <button onClick={handleDownload} className="btn-success w-full flex items-center justify-center gap-2">
                  <FiDownload size={14} /> Download Data
                </button>
                <Link to={`/dataset/${id}/manage`} className="btn-primary w-full text-center block">
                  Manage Dataset
                </Link>
              </div>
            ) : dataset.HasAccess ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-retomy-green-light text-sm">
                  <FiCheck /> You own this dataset
                </div>
                <button onClick={handleDownload} className="btn-success w-full flex items-center justify-center gap-2">
                  <FiDownload size={14} /> Download Data
                </button>
                <Link to="/dashboard" className="btn-secondary w-full text-center block">
                  Go to Dashboard
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <button onClick={handlePurchase} className="btn-success w-full flex items-center justify-center gap-2">
                  {dataset.Price === 0 || dataset.PricingModel === 'free'
                    ? <><FiDownload size={14} /> Get Free Access</>
                    : <><FiLock size={14} /> Buy Now — ${Number(dataset.Price).toFixed(2)}</>}
                </button>
                <button onClick={handleAddToCart} className="btn-secondary w-full flex items-center justify-center gap-2">
                  <FiShoppingCart size={14} /> Add to Cart
                </button>
                <button onClick={handleWishlist} className="btn-secondary w-full flex items-center justify-center gap-2 !border-transparent !bg-transparent hover:!text-retomy-red">
                  <FiHeart size={14} /> {dataset.IsWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
                </button>
              </div>
            )}

            {/* Quick Facts */}
            <div className="mt-6 pt-6 border-t border-retomy-border/30 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-retomy-text-secondary">Format</span>
                <span className="text-retomy-text-bright uppercase">{dataset.FileFormat || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-retomy-text-secondary">Size</span>
                <span className="text-retomy-text-bright">{formatSize(dataset.FileSize)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-retomy-text-secondary">Rows</span>
                <span className="text-retomy-text-bright">{dataset.RowCount?.toLocaleString() || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-retomy-text-secondary">Version</span>
                <span className="text-retomy-text-bright">{dataset.Version || '1.0.0'}</span>
              </div>
              {dataset.PrivacyScore && (
                <div className="flex justify-between text-sm">
                  <span className="text-retomy-text-secondary">Privacy Score</span>
                  <span className="text-retomy-green-light">{Number(dataset.PrivacyScore).toFixed(0)}/100</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-retomy-text-secondary">License</span>
                <span className="text-retomy-text-bright capitalize">{dataset.LicenseType || 'Standard'}</span>
              </div>
            </div>
          </div>

          {/* Seller Card */}
          <div className="card p-4">
              <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-retomy-bg-hover flex items-center justify-center flex-shrink-0">
                {dataset.SellerAvatarUrl ? (
                  <img src={dataset.SellerAvatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <FiUser className="text-retomy-accent" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-1">

            
                  <span className="font-semibold text-sm text-retomy-text-bright">{formatOwner(dataset.SellerName)}</span>
                  {dataset.IsSellerVerified && <span className="text-retomy-accent text-xs">✓</span>}
                </div>
                <p className="text-xs text-retomy-text-secondary">
                  {dataset.SellerDatasetCount} data · {dataset.SellerFollowers} followers
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
