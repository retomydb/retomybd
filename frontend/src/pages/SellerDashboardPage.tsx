import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dashboardApi, datasetsApi, paymentsApi, getApiError } from '../services/api';
import { useAuthStore } from '../store/authStore';
import {
  FiBarChart2, FiDollarSign, FiPackage, FiUsers, FiPlus,
  FiEdit2, FiEye, FiDownload, FiStar, FiTrendingUp,
  FiCheck, FiClock, FiXCircle, FiUploadCloud, FiCreditCard
} from 'react-icons/fi';
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

  useEffect(() => {
    loadDashboard();
    loadCategories();
    loadStripeStatus();
  }, []);

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
      <div className="page-container">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-retomy-bg-hover rounded w-1/3" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-retomy-bg-hover rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  const stats = data?.stats || {};
  const datasets = data?.datasets || [];

  const statusIcon = (s: string) => {
    switch (s?.toLowerCase()) {
      case 'published': return <FiCheck className="text-retomy-green-light" />;
      case 'pending': return <FiClock className="text-retomy-gold" />;
      case 'rejected': return <FiXCircle className="text-red-400" />;
      default: return <FiEdit2 className="text-retomy-text-secondary" />;
    }
  };

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-retomy-text-bright">Seller Dashboard</h1>
          <p className="text-sm text-retomy-text-secondary mt-1">Manage your datasets and track performance</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <FiPlus size={14} /> New Dataset
        </button>
      </div>

      {/* Stripe Connect Banner */}
      {stripeStatus && !stripeStatus.onboarded && (
        <div className="card p-4 mb-6 border border-retomy-accent/30 bg-retomy-accent/5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <FiCreditCard className="text-retomy-accent" size={24} />
              <div>
                <p className="font-semibold text-retomy-text-bright text-sm">
                  {stripeStatus.connected ? 'Complete your Stripe setup' : 'Connect Stripe to receive payouts'}
                </p>
                <p className="text-xs text-retomy-text-secondary">
                  Set up Stripe Connect to receive earnings from dataset sales directly to your bank account.
                </p>
              </div>
            </div>
            <button
              onClick={handleStripeOnboard}
              disabled={stripeLoading}
              className="btn-primary text-sm flex items-center gap-2"
            >
              {stripeLoading ? <span className="animate-spin">⟳</span> : <FiCreditCard size={14} />}
              {stripeStatus.connected ? 'Continue Setup' : 'Connect Stripe'}
            </button>
          </div>
        </div>
      )}

      {stripeStatus?.onboarded && (
        <div className="card p-3 mb-6 border border-retomy-green-light/30 bg-retomy-green-light/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiCheck className="text-retomy-green-light" size={16} />
              <span className="text-sm text-retomy-text-bright">Stripe Connected — payouts enabled</span>
            </div>
            <button onClick={handleStripeOnboard} className="text-xs text-retomy-accent hover:underline">
              Open Stripe Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Revenue', value: `$${Number(stats.TotalRevenue || 0).toFixed(2)}`, icon: FiDollarSign, color: 'text-retomy-green-light' },
          { label: 'Total Sales', value: stats.TotalSales || 0, icon: FiBarChart2, color: 'text-retomy-accent' },
          { label: 'Datasets', value: stats.TotalDatasets || 0, icon: FiPackage, color: 'text-retomy-purple' },
          { label: 'Followers', value: stats.TotalFollowers || 0, icon: FiUsers, color: 'text-retomy-gold' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color} bg-retomy-bg-hover`}>
                <s.icon size={18} />
              </div>
              <div>
                <p className="text-xs text-retomy-text-secondary">{s.label}</p>
                <p className="text-lg font-bold text-retomy-text-bright">{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Datasets Table */}
      <div className="card">
        <div className="px-6 py-4 border-b border-retomy-border/30">
          <h2 className="font-semibold text-retomy-text-bright">My Datasets</h2>
        </div>
        {datasets.length === 0 ? (
          <div className="p-12 text-center">
            <FiPackage className="mx-auto text-retomy-text-secondary mb-3" size={36} />
            <p className="text-retomy-text-secondary">You haven't published any datasets yet.</p>
            <button onClick={() => setShowCreate(true)} className="text-retomy-accent hover:underline text-sm mt-2 inline-flex items-center gap-1">
              <FiPlus size={12} /> Create your first dataset
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-retomy-text-secondary uppercase border-b border-retomy-border/20">
                  <th className="text-left px-6 py-3">Dataset</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Price</th>
                  <th className="text-right px-4 py-3">Sales</th>
                  <th className="text-right px-4 py-3">Revenue</th>
                  <th className="text-right px-4 py-3">Rating</th>
                  <th className="text-right px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-retomy-border/20">
                {datasets.map((ds: any) => (
                  <tr key={ds.DatasetId} className="hover:bg-retomy-bg-hover/50 transition-colors">
                    <td className="px-6 py-3">
                      <Link to={`/dataset/${ds.DatasetId}`} className="font-medium text-retomy-text-bright hover:text-retomy-accent">
                        {ds.Title}
                      </Link>
                    </td>
                    <td className="text-center px-4 py-3">
                      <span className="inline-flex items-center gap-1 capitalize text-xs">
                        {statusIcon(ds.Status)} {ds.Status}
                      </span>
                    </td>
                    <td className="text-right px-4 py-3 text-retomy-text-bright">${Number(ds.Price || 0).toFixed(2)}</td>
                    <td className="text-right px-4 py-3">
                      <span className="flex items-center justify-end gap-1"><FiDownload size={10} /> {ds.Sales || 0}</span>
                    </td>
                    <td className="text-right px-4 py-3 text-retomy-green-light">${Number(ds.Revenue || 0).toFixed(2)}</td>
                    <td className="text-right px-4 py-3">
                      <span className="flex items-center justify-end gap-1">
                        <FiStar size={10} className="text-retomy-gold" /> {ds.AverageRating ? Number(ds.AverageRating).toFixed(1) : '—'}
                      </span>
                    </td>
                    <td className="text-right px-6 py-3 flex items-center justify-end gap-3">
                      <Link to={`/dataset/${ds.DatasetId}/manage`} className="text-retomy-gold hover:underline text-xs flex items-center gap-1">
                        <FiUploadCloud size={10} /> Manage
                      </Link>
                      <Link to={`/dataset/${ds.DatasetId}`} className="text-retomy-accent hover:underline text-xs flex items-center gap-1">
                        <FiEye size={10} /> View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-retomy-border/30 flex items-center justify-between">
              <h2 className="font-semibold text-retomy-text-bright">Create New Dataset</h2>
              <button onClick={() => setShowCreate(false)} className="text-retomy-text-secondary hover:text-retomy-text-bright">&times;</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs text-retomy-text-secondary mb-1">Title *</label>
                <input type="text" value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })} required className="input-field text-sm" placeholder="My Awesome Dataset" />
              </div>
              <div>
                <label className="block text-xs text-retomy-text-secondary mb-1">Short Description *</label>
                <input type="text" value={createForm.short_description} onChange={e => setCreateForm({ ...createForm, short_description: e.target.value })} required maxLength={500} className="input-field text-sm" placeholder="Brief description..." />
              </div>
              <div>
                <label className="block text-xs text-retomy-text-secondary mb-1">Full Description</label>
                <textarea value={createForm.full_description} onChange={e => setCreateForm({ ...createForm, full_description: e.target.value })} className="input-field text-sm min-h-[100px]" placeholder="Detailed description with methodology..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-retomy-text-secondary mb-1">Category</label>
                  <select value={createForm.category_id} onChange={e => setCreateForm({ ...createForm, category_id: e.target.value })} className="input-field text-sm">
                    <option value="">Select...</option>
                    {categories.map(c => <option key={c.CategoryId} value={c.CategoryId}>{c.Name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-retomy-text-secondary mb-1">Format</label>
                  <select value={createForm.file_format} onChange={e => setCreateForm({ ...createForm, file_format: e.target.value })} className="input-field text-sm">
                    {['csv', 'json', 'parquet', 'xlsx', 'tsv', 'xml', 'sql', 'zip', 'gz', 'pdf', 'images', 'video', 'geojson', 'other'].map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-retomy-text-secondary mb-1">Price ($)</label>
                  <input type="number" step="0.01" min="0" value={createForm.price} onChange={e => setCreateForm({ ...createForm, price: e.target.value })} className="input-field text-sm" placeholder="0.00 = free" />
                </div>
                <div>
                  <label className="block text-xs text-retomy-text-secondary mb-1">Pricing Model</label>
                  <select value={createForm.pricing_model} onChange={e => setCreateForm({ ...createForm, pricing_model: e.target.value })} className="input-field text-sm">
                    <option value="free">Free</option>
                    <option value="one-time">One-Time</option>
                    <option value="subscription">Subscription</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-retomy-text-secondary mb-1">Tags (comma-separated)</label>
                <input type="text" value={createForm.tags} onChange={e => setCreateForm({ ...createForm, tags: e.target.value })} className="input-field text-sm" placeholder="machine-learning, nlp, time-series" />
              </div>
              <div>
                <label className="block text-xs text-retomy-text-secondary mb-1">License</label>
                <select value={createForm.license_type} onChange={e => setCreateForm({ ...createForm, license_type: e.target.value })} className="input-field text-sm">
                  <option value="standard">Standard</option>
                  <option value="commercial">Commercial</option>
                  <option value="academic">Academic Only</option>
                  <option value="open">Open Data</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">Create Dataset</button>
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
