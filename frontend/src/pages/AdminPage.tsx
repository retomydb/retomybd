import { useEffect, useState } from 'react';
import { dashboardApi, getApiError } from '../services/api';
import {
  FiUsers, FiPackage, FiDollarSign, FiTrendingUp, FiShield,
  FiCheck, FiX, FiEye, FiAlertCircle, FiActivity
} from 'react-icons/fi';
import { formatOwner } from '../utils/name';
import { truncateWords } from '../utils/text';
import toast from 'react-hot-toast';

export default function AdminPage() {
  const [stats, setStats] = useState<any>(null);
  const [pendingDatasets, setPendingDatasets] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [suspendModal, setSuspendModal] = useState<{ userId: string; displayName: string } | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [suspending, setSuspending] = useState(false);

  useEffect(() => {
    loadAdmin();
  }, []);

  const loadAdmin = async () => {
    try {
      const [statsRes, usersRes, pendingRes] = await Promise.all([
        dashboardApi.getAdminDashboard(),
        dashboardApi.getAdminUsers(),
        dashboardApi.getPendingDatasets(),
      ]);
  
      setStats(statsRes.data);
      setUsers(usersRes.data.users || []);
      setPendingDatasets(pendingRes.data.datasets || []);
    } catch { }
    finally { setLoading(false); }
  };

  const handleApprove = async (id: string) => {
    try {
      await dashboardApi.approveDataset(id);
      toast.success('Dataset approved');
      loadAdmin();
    } catch { toast.error('Failed'); }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    try {
      await dashboardApi.rejectDataset(id, reason);
      toast.success('Dataset rejected');
      loadAdmin();
    } catch { toast.error('Failed'); }
  };

  const SUSPEND_REASONS = [
    'Violation of Terms of Service',
    'Fraudulent activity',
    'Spam or misleading content',
    'Copyright infringement',
    'Abusive behavior',
    'Suspicious account activity',
    'Other',
  ];

  const openSuspendModal = (userId: string, displayName: string) => {
    setSuspendModal({ userId, displayName });
    setSuspendReason('');
    setCustomReason('');
  };

  const closeSuspendModal = () => {
    setSuspendModal(null);
    setSuspendReason('');
    setCustomReason('');
  };

  const confirmSuspend = async () => {
    if (!suspendModal) return;
    const reason = suspendReason === 'Other' ? customReason.trim() : suspendReason;
    if (!reason) { toast.error('Please select or enter a reason'); return; }
    setSuspending(true);
    try {
      await dashboardApi.suspendUser(suspendModal.userId, true, reason);
      toast.success('User suspended');
      closeSuspendModal();
      loadAdmin();
    } catch (e: any) { toast.error(getApiError(e, 'Failed to suspend')); }
    finally { setSuspending(false); }
  };

  const handleUnsuspend = async (userId: string) => {
    if (!confirm('Unsuspend this user? They will be able to log in again.')) return;
    try {
      await dashboardApi.suspendUser(userId, false);
      toast.success('User unsuspended');
      loadAdmin();
    } catch (e: any) { toast.error(getApiError(e, 'Failed to unsuspend')); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-retomy-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <div className="h-20 bg-white/[0.03] rounded-2xl animate-shimmer" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-28 bg-white/[0.03] border border-white/5 rounded-2xl animate-shimmer" style={{ animationDelay: `${i * 100}ms` }} />
              ))}
            </div>
            <div className="h-48 bg-white/[0.03] border border-white/5 rounded-2xl animate-shimmer" />
          </div>
        </div>
      </div>
    );
  }

  const s = stats?.platform_stats || stats?.stats || {};

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FiActivity },
    { id: 'moderation', label: 'Moderation', icon: FiAlertCircle, count: pendingDatasets.length },
    { id: 'users', label: 'Users', icon: FiUsers },
  ];

  return (
    <div className="min-h-screen bg-retomy-surface">
      {/* Header Banner */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-red-600/8 via-retomy-bg/80 to-amber-600/8" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/3 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
              <FiShield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
              <p className="text-sm text-retomy-text-secondary">Platform management and moderation</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Total Users', value: s.TotalUsers || 0, icon: FiUsers, gradient: 'from-indigo-500 to-blue-600', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
            { label: 'Total Data', value: s.TotalDatasets || 0, icon: FiPackage, gradient: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
            { label: 'Total Revenue', value: `$${Number(s.TotalRevenue || 0).toFixed(0)}`, icon: FiDollarSign, gradient: 'from-amber-500 to-orange-600', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
            { label: 'Commission', value: `$${Number(s.TotalCommission || 0).toFixed(0)}`, icon: FiTrendingUp, gradient: 'from-purple-500 to-pink-600', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
            { label: 'Pending', value: pendingDatasets.length, icon: FiAlertCircle, gradient: 'from-orange-500 to-red-600', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
          ].map(st => (
            <div key={st.label} className={`relative overflow-hidden bg-white/[0.03] backdrop-blur-sm border ${st.border} rounded-2xl p-5 transition-all hover:bg-white/[0.05] group`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${st.gradient} flex items-center justify-center shadow-lg`}>
                  <st.icon size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-[11px] text-retomy-text-secondary font-medium">{st.label}</p>
                  <p className="text-lg font-bold text-white mt-0.5">{st.value}</p>
                </div>
              </div>
              <div className={`absolute -top-8 -right-8 w-20 h-20 ${st.bg} rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity`} />
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex gap-1 bg-white/[0.03] border border-white/10 rounded-xl p-1 w-fit">
            {tabs.map(tab => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white border border-indigo-500/30'
                      : 'text-retomy-text-secondary hover:text-white'
                  }`}
                >
                  <TabIcon size={14} />
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="ml-0.5 w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] flex items-center justify-center font-bold">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-6">
              <h3 className="font-semibold text-white flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center">
                  <FiActivity size={14} className="text-indigo-400" />
                </div>
                Platform Health
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Active Sellers', value: s.TotalSellers || 0 },
                  { label: 'Active Buyers', value: s.TotalBuyers || 0 },
                  { label: 'Published Data', value: s.PublishedDatasets || 0 },
                  { label: 'Total Purchases', value: s.TotalPurchases || 0 },
                  { label: 'Avg Rating', value: s.AvgRating ? Number(s.AvgRating).toFixed(1) : '—' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center text-sm py-2 border-b border-white/5 last:border-0">
                    <span className="text-retomy-text-secondary">{row.label}</span>
                    <span className="text-white font-medium">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-6">
              <h3 className="font-semibold text-white flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-lg bg-orange-500/15 flex items-center justify-center">
                  <FiAlertCircle size={14} className="text-orange-400" />
                </div>
                Pending Moderation
              </h3>
              {pendingDatasets.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <FiCheck className="text-emerald-400" size={20} />
                  </div>
                  <p className="text-sm text-retomy-text-secondary">No data pending review.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingDatasets.slice(0, 5).map((d: any) => (
                    <div key={d.DatasetId} className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/5 rounded-xl">
                      <span className="text-sm text-white truncate flex-1">{d.Title}</span>
                      <div className="flex items-center gap-1.5 ml-3">
                        <button onClick={() => handleApprove(d.DatasetId)} className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/20 transition-colors" title="Approve"><FiCheck size={14} /></button>
                        <button onClick={() => handleReject(d.DatasetId)} className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors" title="Reject"><FiX size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'moderation' && (
          <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 flex items-center gap-2">
              <FiAlertCircle className="text-orange-400" size={16} />
              <h2 className="font-semibold text-white">Pending Data</h2>
              {pendingDatasets.length > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-orange-500/15 text-orange-400 text-xs rounded-full font-medium">{pendingDatasets.length}</span>
              )}
            </div>
            {pendingDatasets.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/10 border border-white/10 flex items-center justify-center">
                  <FiCheck className="text-emerald-400" size={28} />
                </div>
                <p className="text-retomy-text-secondary">All clear! No data pending review.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {pendingDatasets.map((d: any) => (
                  <div key={d.DatasetId} className="p-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-white">{d.Title}</p>
                      <p className="text-xs text-retomy-text-secondary mt-0.5 truncate">{truncateWords(d.ShortDescription || d.short_description, 20)}</p>
                      <div className="flex items-center gap-3 text-xs text-retomy-text-secondary mt-1.5">
                        <span className="text-indigo-400/70">by {formatOwner(d.SellerName)}</span>
                        <span className={`px-2 py-0.5 rounded-full ${d.Price > 0 ? 'bg-indigo-500/15 text-indigo-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                          {d.Price > 0 ? `$${Number(d.Price).toFixed(2)}` : 'Free'}
                        </span>
                        <span>{new Date(d.CreatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={`/dataset/${d.DatasetId}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-retomy-text-secondary hover:text-white hover:border-white/20 transition-all">
                        <FiEye size={10} /> View
                      </a>
                      <button onClick={() => handleApprove(d.DatasetId)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 hover:bg-emerald-500/20 transition-all">
                        <FiCheck size={10} /> Approve
                      </button>
                      <button onClick={() => handleReject(d.DatasetId)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 hover:bg-red-500/20 transition-all">
                        <FiX size={10} /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 flex items-center gap-2">
              <FiUsers className="text-indigo-400" size={16} />
              <h2 className="font-semibold text-white">Users</h2>
              <span className="ml-1 px-2 py-0.5 bg-indigo-500/15 text-indigo-400 text-xs rounded-full font-medium">{users.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] text-retomy-text-secondary uppercase tracking-wider border-b border-white/5">
                    <th className="text-left px-6 py-3">User</th>
                    <th className="text-center px-4 py-3">Role</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-center px-4 py-3">Action</th>
                    <th className="text-right px-6 py-3">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((u: any) => (
                    <tr key={u.UserId} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-3.5">
                        <div>
                          <p className="font-medium text-white text-sm">{u.DisplayName || u.Username}</p>
                          <p className="text-xs text-retomy-text-secondary">{u.Email}</p>
                        </div>
                      </td>
                      <td className="text-center px-4 py-3.5">
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-medium capitalize ${
                          u.Role === 'admin' || u.Role === 'superadmin'
                            ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                            : u.Role === 'seller'
                            ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
                            : 'bg-white/5 text-retomy-text-secondary border border-white/10'
                        }`}>
                          {u.Role}
                        </span>
                      </td>
                      <td className="text-center px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs ${!u.IsSuspended ? 'text-emerald-400' : 'text-red-400'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${!u.IsSuspended ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          {!u.IsSuspended ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="text-center px-4 py-3.5">
                        <button
                          onClick={() => u.IsSuspended ? handleUnsuspend(u.UserId) : openSuspendModal(u.UserId, u.DisplayName || u.Email)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                            u.IsSuspended
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                          }`}
                        >
                          {u.IsSuspended ? <><FiCheck size={11} /> Unsuspend</> : <><FiX size={11} /> Suspend</>}
                        </button>
                      </td>
                      <td className="text-right px-6 py-3.5 text-retomy-text-secondary text-xs">
                        {new Date(u.CreatedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Suspend User Modal */}
      {suspendModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-retomy-bg-secondary/95 backdrop-blur-xl border border-white/10 rounded-2xl max-w-md w-full shadow-2xl">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
                  <FiAlertCircle className="text-white" size={14} />
                </div>
                Suspend User
              </h2>
              <button onClick={closeSuspendModal} className="text-retomy-text-secondary hover:text-white transition-colors text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-retomy-text-secondary">
                Suspending <span className="text-white font-medium">{suspendModal.displayName}</span> will prevent them from logging in.
              </p>

              <div>
                <label className="block text-xs text-retomy-text-secondary font-medium mb-2">Select a reason</label>
                <div className="space-y-2">
                  {SUSPEND_REASONS.map(r => (
                    <label
                      key={r}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${
                        suspendReason === r
                          ? 'bg-red-500/10 border-red-500/30 text-white'
                          : 'bg-white/[0.03] border-white/10 text-retomy-text-secondary hover:bg-white/[0.05] hover:border-white/15'
                      }`}
                    >
                      <input
                        type="radio"
                        name="suspendReason"
                        value={r}
                        checked={suspendReason === r}
                        onChange={() => setSuspendReason(r)}
                        className="sr-only"
                      />
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        suspendReason === r ? 'border-red-400' : 'border-white/20'
                      }`}>
                        {suspendReason === r && <span className="w-2 h-2 rounded-full bg-red-400" />}
                      </span>
                      <span className="text-sm">{r}</span>
                    </label>
                  ))}
                </div>
              </div>

              {suspendReason === 'Other' && (
                <div>
                  <label className="block text-xs text-retomy-text-secondary font-medium mb-1.5">Enter reason</label>
                  <textarea
                    value={customReason}
                    onChange={e => setCustomReason(e.target.value)}
                    placeholder="Describe the reason for suspension..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-retomy-text-secondary focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all min-h-[80px]"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={confirmSuspend}
                  disabled={suspending || !suspendReason || (suspendReason === 'Other' && !customReason.trim())}
                  className="flex-1 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-orange-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-red-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {suspending ? 'Suspending...' : 'Suspend User'}
                </button>
                <button
                  onClick={closeSuspendModal}
                  className="flex-1 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-retomy-text-secondary text-sm font-medium hover:text-white hover:border-white/20 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
