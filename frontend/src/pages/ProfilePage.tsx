import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { usersApi, getApiError } from '../services/api';
import { FiUser, FiMail, FiLock, FiSave, FiCamera, FiGlobe, FiMapPin, FiBriefcase } from 'react-icons/fi';
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
      if (data?.avatar_url) {
        updateUser({ avatar_url: data.avatar_url });
      } else {
        await loadUser();
      }
      toast.success('Avatar updated');
    } catch { toast.error('Upload failed'); }
  };

  return (
    <div className="min-h-screen bg-retomy-surface">
      {/* Header Banner */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/8 via-retomy-bg/80 to-purple-600/8" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/3 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl" />

        <div className="relative max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <FiUser className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Edit Profile</h1>
              <p className="text-sm text-retomy-text-secondary">Manage your personal information</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          {/* Avatar */}
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
            <label className="relative cursor-pointer group">
              <div className="w-20 h-20 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center overflow-hidden">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <FiUser size={28} className="text-indigo-400/50" />
                )}
              </div>
              <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <FiCamera className="text-white" size={18} />
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
            </label>
            <div>
              <p className="font-semibold text-white">{user?.display_name || user?.email}</p>
              <p className="text-sm text-retomy-text-secondary">{user?.email}</p>
              <span className="inline-flex mt-1 px-2.5 py-0.5 rounded-lg text-[11px] font-medium capitalize bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                {user?.role}
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs text-retomy-text-secondary mb-1.5 font-medium">Display Name</label>
              <div className="relative">
                <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-retomy-text-secondary" size={14} />
                <input
                  type="text"
                  value={form.display_name}
                  onChange={e => setForm({ ...form, display_name: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-white placeholder-retomy-text-secondary/50 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                  placeholder="Your display name"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-retomy-text-secondary mb-1.5 font-medium">Bio</label>
              <textarea
                value={form.bio}
                onChange={e => setForm({ ...form, bio: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-white placeholder-retomy-text-secondary/50 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all min-h-[80px] resize-none"
                placeholder="Tell us about yourself..."
                maxLength={500}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-retomy-text-secondary mb-1.5 font-medium">Website</label>
                <div className="relative">
                  <FiGlobe className="absolute left-3.5 top-1/2 -translate-y-1/2 text-retomy-text-secondary" size={14} />
                  <input
                    type="url"
                    value={form.website}
                    onChange={e => setForm({ ...form, website: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-white placeholder-retomy-text-secondary/50 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-retomy-text-secondary mb-1.5 font-medium">Company</label>
                <div className="relative">
                  <FiBriefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 text-retomy-text-secondary" size={14} />
                  <input
                    type="text"
                    value={form.company}
                    onChange={e => setForm({ ...form, company: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-white placeholder-retomy-text-secondary/50 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                    placeholder="Your organization"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs text-retomy-text-secondary mb-1.5 font-medium">Location</label>
              <div className="relative">
                <FiMapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-retomy-text-secondary" size={14} />
                <input
                  type="text"
                  value={form.location}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-white placeholder-retomy-text-secondary/50 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                  placeholder="City, Country"
                />
              </div>
            </div>

            <div className="pt-2">
              <button type="submit" disabled={loading} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-indigo-500/20 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? <span className="animate-spin">⟳</span> : <FiSave size={14} />}
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
