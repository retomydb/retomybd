import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../services/api';
import { FiDownload, FiStar, FiPackage, FiCreditCard, FiTrendingUp, FiClock, FiArrowRight, FiGrid } from 'react-icons/fi';

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
      <div className="min-h-screen bg-retomy-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <div className="h-20 bg-white/[0.03] rounded-2xl animate-shimmer" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-28 bg-white/[0.03] border border-white/5 rounded-2xl animate-shimmer" style={{ animationDelay: `${i * 100}ms` }} />
              ))}
            </div>
            <div className="h-72 bg-white/[0.03] border border-white/5 rounded-2xl animate-shimmer" />
          </div>
        </div>
      </div>
    );
  }

  const stats = data?.stats || {};
  const purchases = data?.recent_purchases || [];

  return (
    <div className="min-h-screen bg-retomy-surface">
      {/* Header Banner */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/8 via-retomy-bg/80 to-cyan-600/8" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/3 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-600 flex items-center justify-center">
                <FiGrid className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">My Dashboard</h1>
                <p className="text-sm text-retomy-text-secondary">Overview of your data, purchases, and activity</p>
              </div>
            </div>
            <Link to="/browse" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-indigo-500/20 transition-all hover:scale-105">
              Browse Data <FiArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Purchases', value: stats.TotalPurchases || 0, icon: FiPackage, gradient: 'from-indigo-500 to-blue-600', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
            { label: 'Total Spent', value: `$${Number(stats.TotalSpent || 0).toFixed(2)}`, icon: FiCreditCard, gradient: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
            { label: 'Credits Balance', value: `$${Number(stats.Credits || 0).toFixed(2)}`, icon: FiTrendingUp, gradient: 'from-amber-500 to-orange-600', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
            { label: 'Reviews Written', value: stats.TotalReviews || 0, icon: FiStar, gradient: 'from-purple-500 to-pink-600', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
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
              {/* Subtle corner glow */}
              <div className={`absolute -top-8 -right-8 w-24 h-24 ${s.bg} rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity`} />
            </div>
          ))}
        </div>

        {/* Recent Purchases */}
        <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <FiPackage className="text-indigo-400" size={16} /> Recent Purchases
            </h2>
            <Link to="/browse" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">View All &rarr;</Link>
          </div>
          {purchases.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/10 flex items-center justify-center">
                <FiPackage className="text-indigo-400" size={28} />
              </div>
              <p className="text-retomy-text-secondary mb-2">No purchases yet.</p>
              <Link to="/browse" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">Browse data &rarr;</Link>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {purchases.map((p: any) => (
                <div key={p.PurchaseId} className="p-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors group">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/5 flex items-center justify-center flex-shrink-0">
                    {p.ThumbnailUrl ? (
                      <img src={p.ThumbnailUrl} alt="" className="w-full h-full rounded-xl object-cover" />
                    ) : (
                      <FiPackage className="text-indigo-400/50" size={18} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link to={`/dataset/${p.DatasetId}`} className="font-medium text-sm text-white hover:text-indigo-400 truncate block transition-colors">
                      {p.Title || p.DatasetTitle}
                    </Link>
                    <div className="flex items-center gap-3 text-xs text-retomy-text-secondary mt-1">
                      <span className="flex items-center gap-1"><FiClock size={10} /> {p.CompletedAt ? new Date(p.CompletedAt).toLocaleDateString() : ''}</span>
                      {(p.FileFormat) && (
                        <span className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] uppercase font-mono">{p.FileFormat}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right mr-2">
                    <span className={`text-sm font-semibold px-2.5 py-1 rounded-full ${Number(p.Amount || 0) === 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-indigo-500/15 text-indigo-400'}`}>
                      {Number(p.Amount || 0) === 0 ? 'Free' : `$${Number(p.Amount).toFixed(2)}`}
                    </span>
                  </div>
                  <Link to={`/dataset/${p.DatasetId}`} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-retomy-text-secondary hover:text-white hover:border-indigo-500/30 transition-all">
                    <FiDownload size={12} /> Access
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
