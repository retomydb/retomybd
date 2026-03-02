import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { usersApi, getApiError } from '../services/api';
import { FiUser, FiMail, FiLock, FiSave, FiCamera, FiGlobe } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function ProfilePage() {
  const { user, isAuthenticated, loadUser, updateUser } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    display_name: '', bio: '', website: '', location: '', company: ''
  });

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (user) {
      setForm({
        display_name: user.display_name || '',
        bio: user.bio || '',
        website: user.website || '',
        location: user.location || '',
        company: user.company || ''
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await usersApi.updateProfile(form);
      await loadUser();
      toast.success('Profile updated');
    } catch (e: any) {
      toast.error(getApiError(e, 'Update failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5MB'); return; }
    try {
      const { data } = await usersApi.uploadAvatar(file);
      // If API returned an avatar_url (SAS or fallback), update local store immediately
      if (data?.avatar_url) {
        updateUser({ avatar_url: data.avatar_url });
      } else {
        await loadUser();
      }
      toast.success('Avatar updated');
    } catch { toast.error('Upload failed'); }
  };

  return (
    <div className="page-container max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-retomy-text-bright mb-6 flex items-center gap-3">
        <FiUser /> Edit Profile
      </h1>

      <div className="card p-6">
        {/* Avatar */}
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-retomy-border/30">
          <label className="relative cursor-pointer group">
            <div className="w-20 h-20 rounded-full bg-retomy-bg-hover flex items-center justify-center overflow-hidden">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <FiUser size={28} className="text-retomy-accent/50" />
              )}
            </div>
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <FiCamera className="text-white" size={18} />
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
          </label>
          <div>
            <p className="font-semibold text-retomy-text-bright">{user?.display_name || user?.email}</p>
            <p className="text-sm text-retomy-text-secondary">{user?.email}</p>
            <p className="text-xs text-retomy-text-secondary capitalize mt-0.5">{user?.role}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-retomy-text-secondary mb-1">Display Name</label>
            <div className="relative">
              <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-retomy-text-secondary" size={14} />
              <input
                type="text"
                value={form.display_name}
                onChange={e => setForm({ ...form, display_name: e.target.value })}
                className="input-field !pl-9 text-sm"
                placeholder="Your display name"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-retomy-text-secondary mb-1">Bio</label>
            <textarea
              value={form.bio}
              onChange={e => setForm({ ...form, bio: e.target.value })}
              className="input-field text-sm min-h-[80px]"
              placeholder="Tell us about yourself..."
              maxLength={500}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-retomy-text-secondary mb-1">Website</label>
              <div className="relative">
                <FiGlobe className="absolute left-3 top-1/2 -translate-y-1/2 text-retomy-text-secondary" size={14} />
                <input
                  type="url"
                  value={form.website}
                  onChange={e => setForm({ ...form, website: e.target.value })}
                  className="input-field !pl-9 text-sm"
                  placeholder="https://..."
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-retomy-text-secondary mb-1">Company</label>
              <input
                type="text"
                value={form.company}
                onChange={e => setForm({ ...form, company: e.target.value })}
                className="input-field text-sm"
                placeholder="Your organization"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-retomy-text-secondary mb-1">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={e => setForm({ ...form, location: e.target.value })}
              className="input-field text-sm"
              placeholder="City, Country"
            />
          </div>

          <div className="pt-4">
            <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
              {loading ? <span className="animate-spin">⟳</span> : <FiSave size={14} />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
