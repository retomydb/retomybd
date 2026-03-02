import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../services/api';
import { FiDownload, FiStar, FiPackage, FiCreditCard, FiTrendingUp, FiClock } from 'react-icons/fi';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const { data: res } = await dashboardApi.getBuyerDashboard();
      setData(res);
    } catch {
      // handled by global interceptor
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-retomy-bg-hover rounded w-1/4" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-retomy-bg-hover rounded" />)}
          </div>
          <div className="h-64 bg-retomy-bg-hover rounded" />
        </div>
      </div>
    );
  }

  const stats = data?.stats || {};
  const purchases = data?.recent_purchases || [];

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-retomy-text-bright">My Dashboard</h1>
          <p className="text-sm text-retomy-text-secondary mt-1">Overview of your datasets, purchases, and activity</p>
        </div>
        <Link to="/browse" className="btn-primary text-sm">Browse Datasets</Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Purchases', value: stats.TotalPurchases || 0, icon: FiPackage, color: 'text-retomy-accent' },
          { label: 'Total Spent', value: `$${Number(stats.TotalSpent || 0).toFixed(2)}`, icon: FiCreditCard, color: 'text-retomy-green-light' },
          { label: 'Credits Balance', value: `$${Number(stats.Credits || 0).toFixed(2)}`, icon: FiTrendingUp, color: 'text-retomy-gold' },
          { label: 'Reviews Written', value: stats.TotalReviews || 0, icon: FiStar, color: 'text-retomy-purple' },
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

      {/* Recent Purchases */}
      <div className="card">
        <div className="px-6 py-4 border-b border-retomy-border/30 flex items-center justify-between">
          <h2 className="font-semibold text-retomy-text-bright">Recent Purchases</h2>
          <Link to="/browse" className="text-sm text-retomy-accent hover:underline">View All</Link>
        </div>
        {purchases.length === 0 ? (
          <div className="p-12 text-center">
            <FiPackage className="mx-auto text-retomy-text-secondary mb-3" size={36} />
            <p className="text-retomy-text-secondary">No purchases yet.</p>
            <Link to="/browse" className="text-retomy-accent hover:underline text-sm mt-2 inline-block">Browse datasets</Link>
          </div>
        ) : (
          <div className="divide-y divide-retomy-border/20">
            {purchases.map((p: any) => (
              <div key={p.PurchaseId} className="p-4 flex items-center gap-4 hover:bg-retomy-bg-hover/50 transition-colors">
                <div className="w-12 h-12 rounded bg-retomy-bg-hover flex items-center justify-center flex-shrink-0">
                  {p.ThumbnailUrl ? (
                    <img src={p.ThumbnailUrl} alt="" className="w-full h-full rounded object-cover" />
                  ) : (
                    <FiPackage className="text-retomy-accent/50" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link to={`/dataset/${p.DatasetId}`} className="font-medium text-sm text-retomy-text-bright hover:text-retomy-accent truncate block">
                    {p.DatasetTitle}
                  </Link>
                  <div className="flex items-center gap-3 text-xs text-retomy-text-secondary mt-1">
                    <span className="flex items-center gap-1"><FiClock size={10} /> {new Date(p.PurchasedAt).toLocaleDateString()}</span>
                    <span>v{p.Version || '1.0.0'}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-retomy-text-bright">${Number(p.AmountPaid).toFixed(2)}</p>
                </div>
                <Link to={`/dataset/${p.DatasetId}`} className="btn-secondary !py-1 !px-3 text-xs flex items-center gap-1">
                  <FiDownload size={12} /> Access
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
