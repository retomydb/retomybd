import { useEffect, useState } from 'react';
import { dashboardApi } from '../services/api';
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

  if (loading) {
    return (
      <div className="page-container">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-retomy-bg-hover rounded w-1/3" />
          <div className="grid grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => <div key={i} className="h-24 bg-retomy-bg-hover rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  const s = stats?.platform_stats || stats?.stats || {};

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 mb-6">
        <FiShield className="text-retomy-accent" size={24} />
        <div>
          <h1 className="text-2xl font-bold text-retomy-text-bright">Admin Panel</h1>
          <p className="text-sm text-retomy-text-secondary mt-0.5">Platform management and moderation</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {[
            { label: 'Total Users', value: s.TotalUsers || 0, icon: FiUsers, color: 'text-retomy-accent' },
              { label: 'Total Data', value: s.TotalDatasets || 0, icon: FiPackage, color: 'text-retomy-green-light' },
          { label: 'Total Revenue', value: `$${Number(s.TotalRevenue || 0).toFixed(0)}`, icon: FiDollarSign, color: 'text-retomy-gold' },
          { label: 'Commission', value: `$${Number(s.TotalCommission || 0).toFixed(0)}`, icon: FiTrendingUp, color: 'text-retomy-purple' },
          { label: 'Pending', value: pendingDatasets.length, icon: FiAlertCircle, color: 'text-orange-400' },
        ].map(st => (
          <div key={st.label} className="card p-4">
            <div className="flex items-center gap-2">
              <st.icon size={16} className={st.color} />
              <p className="text-xs text-retomy-text-secondary">{st.label}</p>
            </div>
            <p className="text-xl font-bold text-retomy-text-bright mt-1">{st.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-retomy-border/30 mb-6">
        <div className="flex gap-6">
          {['overview', 'moderation', 'users'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium capitalize ${
                activeTab === tab ? 'text-retomy-accent border-b-2 border-retomy-accent' : 'text-retomy-text-secondary hover:text-retomy-text-bright'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="font-semibold text-retomy-text-bright flex items-center gap-2 mb-4"><FiActivity size={14} /> Platform Health</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-retomy-text-secondary">Active Sellers</span>
                <span className="text-retomy-text-bright">{s.TotalSellers || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-retomy-text-secondary">Active Buyers</span>
                <span className="text-retomy-text-bright">{s.TotalBuyers || 0}</span>
              </div>
                <div className="flex justify-between text-sm">
                <span className="text-retomy-text-secondary">Published Data</span>
                <span className="text-retomy-text-bright">{s.PublishedDatasets || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-retomy-text-secondary">Total Purchases</span>
                <span className="text-retomy-text-bright">{s.TotalPurchases || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-retomy-text-secondary">Avg Rating</span>
                <span className="text-retomy-text-bright">{s.AvgRating ? Number(s.AvgRating).toFixed(1) : '—'}</span>
              </div>
            </div>
          </div>
          <div className="card p-6">
            <h3 className="font-semibold text-retomy-text-bright flex items-center gap-2 mb-4"><FiAlertCircle size={14} /> Pending Moderation</h3>
            {pendingDatasets.length === 0 ? (
              <p className="text-sm text-retomy-text-secondary">No data pending review.</p>
            ) : (
              <div className="space-y-2">
                {pendingDatasets.slice(0, 5).map((d: any) => (
                  <div key={d.DatasetId} className="flex items-center justify-between p-2 bg-retomy-bg rounded">
                    <span className="text-sm text-retomy-text-bright truncate flex-1">{d.Title}</span>
                    <div className="flex items-center gap-1 ml-2">
                      <button onClick={() => handleApprove(d.DatasetId)} className="p-1 text-retomy-green-light hover:bg-retomy-bg-hover rounded" title="Approve"><FiCheck size={14} /></button>
                      <button onClick={() => handleReject(d.DatasetId)} className="p-1 text-red-400 hover:bg-retomy-bg-hover rounded" title="Reject"><FiX size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'moderation' && (
        <div className="card">
          <div className="px-6 py-4 border-b border-retomy-border/30">
            <h2 className="font-semibold text-retomy-text-bright">Pending Data</h2>
          </div>
          {pendingDatasets.length === 0 ? (
            <div className="p-12 text-center">
              <FiCheck className="mx-auto text-retomy-green-light mb-3" size={36} />
              <p className="text-retomy-text-secondary">All clear! No data pending review.</p>
            </div>
          ) : (
            <div className="divide-y divide-retomy-border/20">
              {pendingDatasets.map((d: any) => (
                <div key={d.DatasetId} className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-retomy-text-bright">{d.Title}</p>
                    <p className="text-xs text-retomy-text-secondary mt-0.5 truncate">{truncateWords(d.ShortDescription || d.short_description, 20)}</p>
                      <div className="flex items-center gap-3 text-xs text-retomy-text-secondary mt-1">
                      <span>by {formatOwner(d.SellerName)}</span>
                      <span>${Number(d.Price || 0).toFixed(2)}</span>
                      <span>{new Date(d.CreatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={`/dataset/${d.DatasetId}`} target="_blank" rel="noopener" className="btn-secondary !py-1 !px-3 text-xs flex items-center gap-1"><FiEye size={10} /> View</a>
                    <button onClick={() => handleApprove(d.DatasetId)} className="btn-success !py-1 !px-3 text-xs flex items-center gap-1"><FiCheck size={10} /> Approve</button>
                    <button onClick={() => handleReject(d.DatasetId)} className="btn-secondary !py-1 !px-3 text-xs flex items-center gap-1 !border-red-500/30 !text-red-400 hover:!bg-red-500/10"><FiX size={10} /> Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="card">
          <div className="px-6 py-4 border-b border-retomy-border/30">
            <h2 className="font-semibold text-retomy-text-bright">Users</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-retomy-text-secondary uppercase border-b border-retomy-border/20">
                  <th className="text-left px-6 py-3">User</th>
                  <th className="text-center px-4 py-3">Role</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-retomy-border/20">
                {users.map((u: any) => (
                  <tr key={u.UserId} className="hover:bg-retomy-bg-hover/50">
                    <td className="px-6 py-3">
                      <div>
                        <p className="font-medium text-retomy-text-bright">{u.DisplayName || u.Username}</p>
                        <p className="text-xs text-retomy-text-secondary">{u.Email}</p>
                      </div>
                    </td>
                    <td className="text-center px-4 py-3">
                      <span className={`badge ${u.Role === 'admin' ? 'badge-accent' : u.Role === 'seller' ? 'badge-green' : ''} capitalize text-xs`}>
                        {u.Role}
                      </span>
                    </td>
                    <td className="text-center px-4 py-3">
                      <span className={`text-xs ${u.IsActive ? 'text-retomy-green-light' : 'text-red-400'}`}>
                        {u.IsActive ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="text-right px-4 py-3 text-retomy-text-secondary text-xs">
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
  );
}
