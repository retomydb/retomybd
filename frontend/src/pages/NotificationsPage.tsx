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
    switch (type?.toLowerCase()) {
      case 'purchase': return <FiShoppingCart className="text-retomy-green-light" />;
      case 'review': return <FiStar className="text-retomy-gold" />;
      case 'dataset': return <FiPackage className="text-retomy-accent" />;
      case 'alert': return <FiAlertCircle className="text-red-400" />;
      default: return <FiInfo className="text-retomy-accent" />;
    }
  };

  if (loading) {
    return (
      <div className="page-container max-w-3xl mx-auto">
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-retomy-bg-hover rounded w-1/4" />
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-retomy-bg-hover rounded" />)}
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.IsRead).length;

  return (
    <div className="page-container max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-retomy-text-bright flex items-center gap-3">
          <FiBell /> Notifications
          {unreadCount > 0 && (
            <span className="bg-retomy-accent/20 text-retomy-accent text-xs px-2 py-0.5 rounded-full">{unreadCount} new</span>
          )}
        </h1>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn-secondary text-xs flex items-center gap-1">
            <FiCheckCircle size={12} /> Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="card p-12 text-center">
          <FiBell className="mx-auto text-retomy-text-secondary mb-3" size={48} />
          <h2 className="text-lg font-semibold text-retomy-text-bright mb-2">No notifications</h2>
          <p className="text-sm text-retomy-text-secondary">You're all caught up!</p>
        </div>
      ) : (
        <div className="card divide-y divide-retomy-border/20">
          {notifications.map((n: any) => (
            <div
              key={n.NotificationId}
              className={`p-4 flex items-start gap-3 transition-colors ${!n.IsRead ? 'bg-retomy-accent/5' : 'hover:bg-retomy-bg-hover/30'}`}
            >
              <div className="w-8 h-8 rounded-full bg-retomy-bg-hover flex items-center justify-center flex-shrink-0 mt-0.5">
                {notificationIcon(n.Type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${!n.IsRead ? 'text-retomy-text-bright font-medium' : 'text-retomy-text'}`}>
                  {n.Title || n.Message}
                </p>
                {n.Message && n.Title && (
                  <p className="text-xs text-retomy-text-secondary mt-0.5">{n.Message}</p>
                )}
                <span className="text-xs text-retomy-text-secondary flex items-center gap-1 mt-1">
                  <FiClock size={10} /> {new Date(n.CreatedAt).toLocaleString()}
                </span>
              </div>
              {!n.IsRead && <div className="w-2 h-2 rounded-full bg-retomy-accent flex-shrink-0 mt-2" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
