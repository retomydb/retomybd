import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dashboardApi, datasetsApi, paymentsApi, purchasesApi, getApiError, modelsApi, reposApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import {
  FiBarChart2, FiDollarSign, FiPackage, FiUsers, FiPlus,
  FiEdit2, FiEye, FiDownload, FiStar, FiTrendingUp,
  FiCheck, FiClock, FiXCircle, FiUploadCloud, FiCreditCard
} from 'react-icons/fi';
import DatasetCard from '../components/DatasetCard';
import { formatOwner } from '../utils/name';
import { truncateWords } from '../utils/text';
import toast from 'react-hot-toast';

export default function SellerDashboardPage() {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '', short_description: '', full_description: '',
    category_id: '', price: '', pricing_model: 'one-time',
    file_format: 'csv', license_type: 'standard', tags: ''
  });
  const [categories, setCategories] = useState<any[]>([]);
  const [stripeStatus, setStripeStatus] = useState<any>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [models, setModels] = useState<any[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

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

  useEffect(() => {
    loadDashboard();
    loadModels();
    loadCategories();
    loadStripeStatus();
  }, []);

  const loadModels = async () => {
    setModelsLoading(true);
    try {
      const { data: res } = await modelsApi.browse({ page_size: 100 });
      const all = res.models || [];
      // Filter to models owned by current user (by slug or OwnerId)
      const userSlug = user?.slug;
      const userId = user?.user_id;
      const mine = all.filter((m: any) => {
        if (userSlug && (m.owner_slug === userSlug)) return true;
        if (userId && (String(m.OwnerId || m.owner_id) === String(userId))) return true;
        return false;
      });
      setModels(mine);
    } catch (e) {
      console.error('Failed to load models', e);
    } finally {
      setModelsLoading(false);
    }
  };

  const loadDashboard = async () => {
    try {
      const { data: res } = await dashboardApi.getSellerDashboard();
      setData(res);
    } catch { }
    finally { setLoading(false); }
  };

  const loadCategories = async () => {
    try {
      const { data: res } = await datasetsApi.getCategories();
      setCategories(res.categories || []);
    } catch { }
  };

  const loadStripeStatus = async () => {
    try {
      const { data: res } = await paymentsApi.getConnectStatus();
      setStripeStatus(res);
    } catch { }
  };

  const handleStripeOnboard = async () => {
    setStripeLoading(true);
    try {
      const { data: res } = await paymentsApi.startOnboarding();
      if (res.onboarding_url) {
        window.location.href = res.onboarding_url;
      } else if (res.dashboard_url) {
        window.open(res.dashboard_url, '_blank');
      }
    } catch (e: any) {
      toast.error(getApiError(e, 'Failed to start Stripe onboarding'));
    } finally {
      setStripeLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    // Guard: ensure we have an access token before attempting create
    const token = localStorage.getItem('retomy_access_token');
    if (!token) {
      toast.error('Please sign in before creating a dataset');
      navigate('/login');
      return;
    }
    try {
      const tagsList = createForm.tags ? createForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
      const payload = {
        ...createForm,
        price: parseFloat(createForm.price || '0'),
        category_id: createForm.category_id ? parseInt(createForm.category_id) : undefined,
        tags: tagsList.length > 0 ? JSON.stringify(tagsList) : undefined,
      };
      const { data: res } = await datasetsApi.create(payload);
      const datasetId = res.dataset?.DatasetId || res.dataset_id;
      if (!datasetId) {
        console.error('Create response missing DatasetId:', res);
        toast.error('Dataset was created but ID is missing. Please check your dashboard.');
        setShowCreate(false);
        return;
      }
      toast.success('Dataset created! Now upload your data files.');
      setShowCreate(false);
      console.log('[SellerDashboard] navigating to:', `/dataset/${datasetId}/manage`);
      navigate(`/dataset/${datasetId}/manage`, { state: { justCreated: true } });
    } catch (e: any) {
      console.error('[SellerDashboard] create FAILED:', e?.response?.status, e?.response?.data, e?.message);
      toast.error(getApiError(e, 'Failed to create dataset'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-retomy-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <div className="h-20 bg-white/[0.03] rounded-2xl animate-shimmer" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-28 bg-white/[0.03] border border-white/5 rounded-2xl animate-shimmer" style={{ animationDelay: `${i * 100}ms` }} />
              ))}
            </div>
            <div className="h-48 bg-white/[0.03] border border-white/5 rounded-2xl animate-shimmer" />
          </div>
        </div>
      </div>
    );
  }

  const stats = data?.stats || {};
  const datasets = data?.dataset_performance || [];

  const handleAddToCart = async (id: string) => {
    if (!isAuthenticated) { toast.error('Sign in to add to cart'); return; }
    try {
      await purchasesApi.addToCart(id);
      toast.success('Added to cart');
    } catch (e: any) {
      toast.error(getApiError(e, 'Failed to add'));
    }
  };

  const statusIcon = (s: string) => {
    switch (s?.toLowerCase()) {
      case 'published': return <FiCheck className="text-retomy-green-light" />;
      case 'pending': return <FiClock className="text-retomy-gold" />;
      case 'rejected': return <FiXCircle className="text-red-400" />;
      default: return <FiEdit2 className="text-retomy-text-secondary" />;
    }
  };

  return (
    <div className="min-h-screen bg-retomy-surface">
      {/* Header Banner */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/8 via-retomy-bg/80 to-emerald-600/8" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <FiBarChart2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">My Account</h1>
                <p className="text-sm text-retomy-text-secondary">Manage your data and track performance</p>
              </div>
            </div>
            <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-purple-500/20 transition-all hover:scale-105">
              <FiPlus size={14} /> New Data
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stripe Connect Banner */}
        {stripeStatus && !stripeStatus.onboarded && (
          <div className="mb-6 bg-white/[0.03] backdrop-blur-sm border border-indigo-500/20 rounded-2xl p-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
                  <FiCreditCard className="text-white" size={20} />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">
                    {stripeStatus.connected ? 'Complete your Stripe setup' : 'Connect Stripe to receive payouts'}
                  </p>
                  <p className="text-xs text-retomy-text-secondary mt-0.5">
                    Set up Stripe Connect to receive earnings from data sales directly to your bank account.
                  </p>
                </div>
              </div>
              <button
                onClick={handleStripeOnboard}
                disabled={stripeLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-blue-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-indigo-500/20 transition-all hover:scale-105"
              >
                {stripeLoading ? <span className="animate-spin">⟳</span> : <FiCreditCard size={14} />}
                {stripeStatus.connected ? 'Continue Setup' : 'Connect Stripe'}
              </button>
            </div>
          </div>
        )}

        {stripeStatus?.onboarded && (
          <div className="mb-6 bg-white/[0.03] backdrop-blur-sm border border-emerald-500/20 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                  <FiCheck className="text-emerald-400" size={16} />
                </div>
                <span className="text-sm text-white">Stripe Connected — payouts enabled</span>
              </div>
              <button onClick={handleStripeOnboard} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                Open Stripe Dashboard &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Revenue', value: `$${Number(stats.TotalRevenue || 0).toFixed(2)}`, icon: FiDollarSign, gradient: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
            { label: 'Total Sales', value: stats.TotalSales || 0, icon: FiBarChart2, gradient: 'from-indigo-500 to-blue-600', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
            { label: 'Data', value: stats.TotalDatasets || 0, icon: FiPackage, gradient: 'from-purple-500 to-pink-600', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
            { label: 'Followers', value: stats.TotalFollowers || 0, icon: FiUsers, gradient: 'from-amber-500 to-orange-600', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
          ].map(s => (
            <div key={s.label} className={`relative overflow-hidden bg-white/[0.03] backdrop-blur-sm border ${s.border} rounded-2xl p-5 transition-all hover:bg-white/[0.05] group`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center shadow-lg`}>
                  <s.icon size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-xs text-retomy-text-secondary font-medium">{s.label}</p>
                  <p className="text-xl font-bold text-white mt-0.5">{s.value}</p>
                </div>
              </div>
              <div className={`absolute -top-8 -right-8 w-24 h-24 ${s.bg} rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity`} />
            </div>
          ))}
        </div>

        {/* My Data */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FiPackage className="text-purple-400" size={18} /> My Data
            </h2>
          </div>
          {datasets.length === 0 ? (
            <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-16 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-white/10 flex items-center justify-center">
                <FiPackage className="text-purple-400" size={28} />
              </div>
              <p className="text-retomy-text-secondary mb-2">You haven't published any data yet.</p>
              <button onClick={() => setShowCreate(true)} className="text-sm text-purple-400 hover:text-purple-300 transition-colors inline-flex items-center gap-1">
                <FiPlus size={12} /> Create your first data
              </button>
            </div>
          ) : (
              <div className="bg-retomy-bg-card/60 backdrop-blur-sm rounded-2xl border border-white/5 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 browse-grid">
                  {datasets.map((d: any) => {
                    const id = d.DatasetId || d.dataset_id;
                    return (
                      <div key={id} className="min-w-0">
                        <DatasetCard dataset={d} showSeller={false} showCart={false} pricePosition="corner" />

                        <div className="flex items-center justify-between mt-2 text-xs px-1">
                          <div className="flex gap-2">
                            <Link to={`/dataset/${id}/manage`} className="text-amber-400 hover:text-amber-300 transition-colors">Manage</Link>
                            <Link to={`/dataset/${id}`} className="text-indigo-400 hover:text-indigo-300 transition-colors">View</Link>
                          </div>
                          <button
                            onClick={async () => {
                              if (!confirm('Delete this dataset? This cannot be undone.')) return;
                              try {
                                await datasetsApi.delete(id);
                                toast.success('Dataset deleted');
                                loadDashboard();
                              } catch (e: any) { toast.error(getApiError(e, 'Failed to delete')); }
                            }}
                            className="text-red-400 hover:text-red-300 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
          )}
        </div>
        {/* My Models */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FiTrendingUp className="text-amber-400" size={18} /> My Models
            </h2>
          </div>
          {modelsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 animate-pulse" />
              ))}
            </div>
          ) : models.length === 0 ? (
            <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-16 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-white/10 flex items-center justify-center">
                <FiTrendingUp className="text-amber-400" size={28} />
              </div>
              <p className="text-retomy-text-secondary mb-2">You haven't published any models yet.</p>
              <Link to="/models/new" className="text-sm text-amber-400 hover:text-amber-300 transition-colors inline-flex items-center gap-1">
                <FiPlus size={12} /> Create your first model
              </Link>
            </div>
          ) : (
              <div className="bg-retomy-bg-card/60 backdrop-blur-sm rounded-2xl border border-white/5 p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {models.map((m: any) => (
                  <div key={m.RepoId} className="min-w-0">
                    <Link to={`/models/${m.owner_slug || m.OwnerId || m.RepoId}/${m.Slug}`} className="group block relative bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 hover:border-violet-500/30 hover:bg-white/[0.05] transition-all duration-200">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h3 className="text-[13px] font-semibold text-white group-hover:text-violet-300 transition-colors truncate flex-1">
                          <span className="text-white/40 font-normal">{m.owner_name || 'you'} / </span>
                          {m.Name}
                        </h3>
                        <span className="shrink-0 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-500/10 text-indigo-300">Model</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-white/30 flex-wrap">
                        {m.ParameterCount != null && m.ParameterCount > 0 && (
                          <span className="inline-flex items-center gap-0.5">{formatNumber(m.ParameterCount)}</span>
                        )}
                        {m.UpdatedAt && (
                          <span className="inline-flex items-center gap-0.5"><FiClock className="w-3 h-3" />{timeAgo(m.UpdatedAt)}</span>
                        )}
                        <span className="inline-flex items-center gap-0.5"><FiDownload className="w-3 h-3" />{formatNumber(m.TotalDownloads || 0)}</span>
                        <span className="inline-flex items-center gap-0.5"><FiStar className="w-3 h-3 text-amber-400/60" />{formatNumber(m.TotalLikes || 0)}</span>
                      </div>
                    </Link>
                    <div className="flex items-center justify-between mt-2 text-xs px-1">
                      <div className="flex gap-2">
                        <Link to={`/models/${m.owner_slug || m.OwnerId || m.RepoId}/${m.Slug}`} className="text-indigo-400 hover:text-indigo-300 transition-colors">View</Link>
                        <Link to={`/models/${m.owner_slug || m.OwnerId || m.RepoId}/${m.Slug}`} className="text-amber-400 hover:text-amber-300 transition-colors">Manage</Link>
                      </div>
                      <button
                        onClick={async () => {
                          if (!confirm('Delete this model? This cannot be undone.')) return;
                          try {
                            await reposApi.delete(m.RepoId);
                            toast.success('Model deleted');
                            loadModels();
                            loadDashboard();
                          } catch (e: any) {
                            toast.error(getApiError(e, 'Failed to delete model'));
                          }
                        }}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-retomy-bg-secondary/95 backdrop-blur-xl border border-white/10 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                  <FiPlus className="text-white" size={14} />
                </div>
                Create New Data
              </h2>
              <button onClick={() => setShowCreate(false)} className="text-retomy-text-secondary hover:text-white transition-colors text-xl">&times;</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs text-retomy-text-secondary font-medium mb-1.5">Title *</label>
                <input type="text" value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })} required className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-retomy-text-secondary focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all" placeholder="My Awesome Data" />
              </div>
              <div>
                <label className="block text-xs text-retomy-text-secondary font-medium mb-1.5">Short Description *</label>
                <input type="text" value={createForm.short_description} onChange={e => setCreateForm({ ...createForm, short_description: e.target.value })} required maxLength={500} className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-retomy-text-secondary focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all" placeholder="Brief description..." />
              </div>
              <div>
                <label className="block text-xs text-retomy-text-secondary font-medium mb-1.5">Full Description</label>
                <textarea value={createForm.full_description} onChange={e => setCreateForm({ ...createForm, full_description: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-retomy-text-secondary focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all min-h-[100px]" placeholder="Detailed description with methodology..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-retomy-text-secondary font-medium mb-1.5">Category</label>
                  <select value={createForm.category_id} onChange={e => setCreateForm({ ...createForm, category_id: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white appearance-none focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all cursor-pointer">
                    <option value="">Select...</option>
                    {categories.map(c => <option key={c.CategoryId} value={c.CategoryId}>{c.Name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-retomy-text-secondary font-medium mb-1.5">Format</label>
                  <select value={createForm.file_format} onChange={e => setCreateForm({ ...createForm, file_format: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white appearance-none focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all cursor-pointer">
                    {['csv', 'json', 'parquet', 'xlsx', 'tsv', 'xml', 'sql', 'zip', 'gz', 'pdf', 'images', 'video', 'geojson', 'other'].map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-retomy-text-secondary font-medium mb-1.5">Price ($)</label>
                  <input type="number" step="0.01" min="0" value={createForm.price} onChange={e => setCreateForm({ ...createForm, price: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-retomy-text-secondary focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all" placeholder="0.00 = free" />
                </div>
                <div>
                  <label className="block text-xs text-retomy-text-secondary font-medium mb-1.5">Pricing Model</label>
                  <select value={createForm.pricing_model} onChange={e => setCreateForm({ ...createForm, pricing_model: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white appearance-none focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all cursor-pointer">
                    <option value="free">Free</option>
                    <option value="one-time">One-Time</option>
                    <option value="subscription">Subscription</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-retomy-text-secondary font-medium mb-1.5">Tags (comma-separated)</label>
                <input type="text" value={createForm.tags} onChange={e => setCreateForm({ ...createForm, tags: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-retomy-text-secondary focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all" placeholder="machine-learning, nlp, time-series" />
              </div>
              <div>
                <label className="block text-xs text-retomy-text-secondary font-medium mb-1.5">License</label>
                <select value={createForm.license_type} onChange={e => setCreateForm({ ...createForm, license_type: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white appearance-none focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all cursor-pointer">
                  <option value="standard">Standard</option>
                  <option value="commercial">Commercial</option>
                  <option value="academic">Academic Only</option>
                  <option value="open">Open Data</option>
                </select>
              </div>
              <div className="flex gap-3 pt-3">
                <button type="submit" className="flex-1 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-purple-500/20 transition-all">Create Data</button>
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-retomy-text-secondary text-sm font-medium hover:text-white hover:border-white/20 transition-all">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
