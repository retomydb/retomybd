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
          <div className="h-8 bg-white/[0.06] rounded-xl w-1/3" />
          <div className="h-64 bg-white/[0.06] rounded-2xl" />
          <div className="h-4 bg-white/[0.06] rounded-xl w-2/3" />
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
      <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
        <Link to="/browse" className="hover:text-cyan-400 flex items-center gap-1 transition-colors">
          <FiArrowLeft size={14} /> Store
        </Link>
        <span className="text-white/20">/</span>
        {dataset.CategoryName && <><Link to={`/browse?category_id=${dataset.CategoryId}`} className="hover:text-cyan-400 transition-colors">{dataset.CategoryName}</Link><span className="text-white/20">/</span></>}
        <span className="text-white/70">{dataset.Title}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Hero / Banner */}
          <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
            <div className="h-56 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-cyan-500/10 flex items-center justify-center relative">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.08),transparent_70%)]" />
              <div className="text-center relative">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center mb-3">
                  <FiDatabase className="text-indigo-400" size={28} />
                </div>
                <span className="text-lg text-white/30 uppercase font-bold tracking-wider">
                  {dataset.FileFormat || 'Dataset'}
                </span>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-white">{dataset.Title}</h1>
                  <p className="text-white/50 mt-2">{dataset.ShortDescription}</p>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="flex flex-wrap items-center gap-6 mt-4 text-sm text-white/40">
                {dataset.AverageRating && (
                  <span className="flex items-center gap-1">
                    <FiStar className="text-amber-400" />
                    {Number(dataset.AverageRating).toFixed(1)} ({dataset.TotalReviews} reviews)
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <FiDownload className="text-cyan-400/60" /> {dataset.TotalDownloads || 0} downloads
                </span>
                <span className="flex items-center gap-1">
                  <FiEye className="text-purple-400/60" /> {dataset.TotalViews || 0} views
                </span>
                <span className="flex items-center gap-1">
                  <FiCalendar className="text-indigo-400/60" /> {dataset.PublishedAt ? new Date(dataset.PublishedAt).toLocaleDateString() : 'Draft'}
                </span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-white/10">
            <div className="flex gap-6">
              {['overview', 'preview', 'schema', 'retrieve', 'reviews', 'license'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 text-sm font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? 'text-cyan-400 border-b-2 border-cyan-400'
                      : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            {activeTab === 'overview' && (
              <div className="prose prose-invert max-w-none">
                <div className="text-white/60 whitespace-pre-wrap">
                  {dataset.FullDescription || dataset.ShortDescription}
                </div>
                {dataset.Tags && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-white mb-2">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {JSON.parse(dataset.Tags || '[]').map((tag: string, i: number) => (
                        <Link key={i} to={`/browse?query=${tag}`} className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors cursor-pointer">
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
                  <div className="p-3 bg-white/[0.04] border border-white/10 rounded-xl">
                    <span className="text-xs text-white/40">Format</span>
                    <p className="text-sm font-semibold text-white uppercase">{dataset.FileFormat || 'N/A'}</p>
                  </div>
                  <div className="p-3 bg-white/[0.04] border border-white/10 rounded-xl">
                    <span className="text-xs text-white/40">Size</span>
                    <p className="text-sm font-semibold text-white">{formatSize(dataset.FileSize)}</p>
                  </div>
                  <div className="p-3 bg-white/[0.04] border border-white/10 rounded-xl">
                    <span className="text-xs text-white/40">Rows</span>
                    <p className="text-sm font-semibold text-white">{dataset.RowCount?.toLocaleString() || 'N/A'}</p>
                  </div>
                  <div className="p-3 bg-white/[0.04] border border-white/10 rounded-xl">
                    <span className="text-xs text-white/40">Columns</span>
                    <p className="text-sm font-semibold text-white">{dataset.ColumnCount || 'N/A'}</p>
                  </div>
                </div>
                {dataset.SchemaDefinition && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-white mb-2">Schema</h3>
                    <pre className="bg-white/[0.04] border border-white/10 p-4 rounded-xl text-xs text-white/60 font-mono overflow-x-auto">
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
                  <form onSubmit={handleSubmitReview} className="border-b border-white/10 pb-6">
                    <h3 className="text-sm font-semibold text-white mb-3">Write a Review</h3>
                    <div className="flex gap-1 mb-3">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button key={star} type="button" onClick={() => setReviewForm({ ...reviewForm, rating: star })}>
                          <FiStar
                            size={20}
                            className={star <= reviewForm.rating ? 'text-amber-400 fill-amber-400' : 'text-white/30'}
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
                    <button type="submit" className="mt-3 text-sm px-5 py-2 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-semibold hover:opacity-90 transition-opacity">Submit Review</button>
                  </form>
                )}

                {/* Reviews List */}
                {reviews.length === 0 ? (
                  <p className="text-white/40 text-center py-6">No reviews yet. Be the first!</p>
                ) : (
                  reviews.map((review: any) => (
                    <div key={review.ReviewId} className="border-b border-white/10 pb-4 last:border-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(s => (
                            <FiStar key={s} size={12} className={s <= review.Rating ? 'text-amber-400 fill-amber-400' : 'text-white/20'} />
                          ))}
                        </div>
                        <span className="text-sm font-medium text-white">{review.ReviewerName}</span>
                        {review.IsVerifiedPurchase && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><FiCheck size={8} className="mr-0.5 inline" /> Verified</span>}
                        <span className="text-xs text-white/30">{new Date(review.CreatedAt).toLocaleDateString()}</span>
                      </div>
                      {review.Title && <p className="font-medium text-sm text-white">{review.Title}</p>}
                      {review.Content && <p className="text-sm text-white/50 mt-1">{review.Content}</p>}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'license' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <FiShield className="text-cyan-400" />
                  <span className="font-semibold text-white">{dataset.LicenseType || 'Standard'} License</span>
                </div>
                <p className="text-sm text-white/50">
                  {dataset.LicenseText || 'This dataset is provided under a standard license. By purchasing, you agree to use the data in accordance with the terms. Commercial use permitted. Redistribution prohibited without consent.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Purchase Card */}
          <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-6 sticky top-20">
            <div className="text-sm font-semibold text-white mb-1">
              {dataset.Price === 0 || dataset.PricingModel === 'free' ? (
                <span className="text-lg text-cyan-400 font-bold">Free</span>
              ) : (
                <span className="text-lg bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent font-bold">${Number(dataset.Price).toFixed(2)}</span>
              )}
            </div>
            <p className="text-xs text-white/40 mb-4 capitalize">{dataset.PricingModel || 'One-Time'} purchase</p>

            {user && dataset.SellerId === user.user_id ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-cyan-400 text-sm">
                  <FiCheck /> Your Dataset
                </div>
                <button onClick={handleDownload} className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold hover:opacity-90 transition-opacity">
                  <FiDownload size={14} /> Download Data
                </button>
                <Link to={`/dataset/${id}/manage`} className="w-full text-center block px-5 py-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-semibold hover:opacity-90 transition-opacity">
                  Manage Dataset
                </Link>
              </div>
            ) : dataset.HasAccess ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 text-sm">
                  <FiCheck /> You own this dataset
                </div>
                <button onClick={handleDownload} className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold hover:opacity-90 transition-opacity">
                  <FiDownload size={14} /> Download Data
                </button>
                <Link to="/dashboard" className="w-full text-center block px-5 py-2.5 rounded-full bg-white/[0.06] border border-white/10 text-white/70 font-medium hover:bg-white/[0.1] transition-colors">
                  Go to Dashboard
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <button onClick={handlePurchase} className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold hover:opacity-90 transition-opacity">
                  {dataset.Price === 0 || dataset.PricingModel === 'free'
                    ? <><FiDownload size={14} /> Get Free Access</>
                    : <><FiLock size={14} /> Buy Now — ${Number(dataset.Price).toFixed(2)}</>}
                </button>
                <button onClick={handleAddToCart} className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.06] border border-white/10 text-white/70 font-medium hover:bg-white/[0.1] transition-colors">
                  <FiShoppingCart size={14} /> Add to Cart
                </button>
                <button onClick={handleWishlist} className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-white/40 hover:text-rose-400 transition-colors">
                  <FiHeart size={14} /> {dataset.IsWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
                </button>
              </div>
            )}

            {/* Quick Facts */}
            <div className="mt-6 pt-6 border-t border-white/10 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Format</span>
                <span className="text-white uppercase">{dataset.FileFormat || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Size</span>
                <span className="text-white">{formatSize(dataset.FileSize)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Rows</span>
                <span className="text-white">{dataset.RowCount?.toLocaleString() || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Version</span>
                <span className="text-white">{dataset.Version || '1.0.0'}</span>
              </div>
              {dataset.PrivacyScore && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Privacy Score</span>
                  <span className="text-emerald-400">{Number(dataset.PrivacyScore).toFixed(0)}/100</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-white/40">License</span>
                <span className="text-white capitalize">{dataset.LicenseType || 'Standard'}</span>
              </div>
            </div>
          </div>

          {/* Seller Card */}
          <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-4">
              <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                {dataset.SellerAvatarUrl ? (
                  <img src={dataset.SellerAvatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <FiUser className="text-indigo-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-sm text-white">{formatOwner(dataset.SellerName)}</span>
                  {dataset.IsSellerVerified && <span className="text-cyan-400 text-xs">✓</span>}
                </div>
                <p className="text-xs text-white/40">
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
