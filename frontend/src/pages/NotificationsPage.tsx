import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import {
  FiBell, FiCheck, FiCheckCircle, FiPackage, FiShoppingCart,
  FiStar, FiInfo, FiAlertCircle, FiClock
} from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function NotificationsPage() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const { data } = await dashboardApi.getNotifications();
      setNotifications(data.notifications || []);
    } catch {}
    finally { setLoading(false); }
  };

  const markAllRead = async () => {
    try {
      await dashboardApi.markNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, IsRead: true })));
      toast.success('All marked as read');
    } catch { toast.error('Failed'); }
  };

  const notificationIcon = (type: string) => {
    const iconMap: Record<string, { icon: JSX.Element; bg: string }> = {
      purchase: { icon: <FiShoppingCart size={14} />, bg: 'bg-emerald-500/15 text-emerald-400' },
      review: { icon: <FiStar size={14} />, bg: 'bg-amber-500/15 text-amber-400' },
      dataset: { icon: <FiPackage size={14} />, bg: 'bg-indigo-500/15 text-indigo-400' },
      alert: { icon: <FiAlertCircle size={14} />, bg: 'bg-red-500/15 text-red-400' },
    };
    const match = iconMap[type?.toLowerCase()] || { icon: <FiInfo size={14} />, bg: 'bg-indigo-500/15 text-indigo-400' };
    return (
      <div className={`w-9 h-9 rounded-xl ${match.bg} flex items-center justify-center flex-shrink-0`}>
        {match.icon}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-retomy-surface">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div className="h-20 bg-white/[0.03] rounded-2xl animate-shimmer" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-white/[0.03] border border-white/5 rounded-2xl animate-shimmer" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.IsRead).length;

  return (
    <div className="min-h-screen bg-retomy-surface">
      {/* Header Banner */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-600/8 via-retomy-bg/80 to-orange-600/8" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/3 w-80 h-80 bg-orange-500/5 rounded-full blur-3xl" />

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <FiBell className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Notifications</h1>
                <p className="text-sm text-retomy-text-secondary">
                  {unreadCount > 0
                    ? <span className="text-amber-400">{unreadCount} unread</span>
                    : 'You\'re all caught up'}
                </p>
              </div>
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs text-retomy-text-secondary hover:text-white hover:border-white/20 transition-all">
                <FiCheckCircle size={12} /> Mark all read
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {notifications.length === 0 ? (
          <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-white/10 flex items-center justify-center">
              <FiBell className="text-amber-400" size={28} />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">No notifications</h2>
            <p className="text-sm text-retomy-text-secondary">You're all caught up!</p>
          </div>
        ) : (
          <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5">
            {notifications.map((n: any) => (
              <div
                key={n.NotificationId}
                className={`p-4 flex items-start gap-3 transition-all ${!n.IsRead ? 'bg-amber-500/[0.04] hover:bg-amber-500/[0.06]' : 'hover:bg-white/[0.02]'}`}
              >
                {notificationIcon(n.Type)}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!n.IsRead ? 'text-white font-medium' : 'text-retomy-text'}`}>
                    {n.Title || n.Message}
                  </p>
                  {n.Message && n.Title && (
                    <p className="text-xs text-retomy-text-secondary mt-0.5">{n.Message}</p>
                  )}
                  <span className="text-[11px] text-retomy-text-secondary flex items-center gap-1 mt-1.5">
                    <FiClock size={10} /> {new Date(n.CreatedAt).toLocaleString()}
                  </span>
                </div>
                {!n.IsRead && <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 mt-2 animate-pulse" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
