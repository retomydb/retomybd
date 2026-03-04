import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { HiLightningBolt, HiHeart, HiCode, HiDocumentText, HiChat, HiFolder, HiClock, HiPlay, HiExternalLink } from 'react-icons/hi';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

interface SpaceData {
  RepoId: string;
  Name: string;
  Slug: string;
  Description: string | null;
  Private: boolean;
  TotalLikes: number;
  TotalViews: number;
  CreatedAt: string;
  UpdatedAt: string;
  owner_name: string | null;
  owner_slug: string | null;
  AvatarUrl: string | null;
  Sdk: string | null;
  SdkVersion: string | null;
  Hardware: string | null;
  AppPort: number | null;
  EmbedUrl: string | null;
  SpaceStatus: string | null;
  LinkedModels: string | null;
  LinkedDatasets: string | null;
  liked_by_user: boolean;
}

export default function SpaceDetailPage() {
  const { owner, slug } = useParams<{ owner: string; slug: string }>();
  const [space, setSpace] = useState<SpaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'app' | 'files' | 'community'>('app');
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (owner && slug) fetchSpace();
  }, [owner, slug]);

  async function fetchSpace() {
    setLoading(true);
    try {
      const token = localStorage.getItem('retomy_access_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/spaces/${owner}/${slug}`, { headers });
      if (!res.ok) throw new Error('Space not found');
      const data = await res.json();
      setSpace(data);
      setLiked(data.liked_by_user || false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load space');
    } finally {
      setLoading(false);
    }
  }

  async function toggleLike() {
    if (!space) return;
    const token = localStorage.getItem('retomy_access_token');
    if (!token) { toast.error('Please log in'); return; }
    try {
      const res = await fetch(`${API_BASE}/repos/${space.RepoId}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      setLiked(data.liked);
      setSpace(prev => prev ? { ...prev, TotalLikes: prev.TotalLikes + (data.liked ? 1 : -1) } : prev);
    } catch { toast.error('Failed'); }
  }

  function sdkBadgeClass(s: string | null) {
    switch (s) {
      case 'gradio': return 'bg-orange-500/10 border-orange-500/20 text-orange-300';
      case 'streamlit': return 'bg-red-500/10 border-red-500/20 text-red-300';
      case 'docker': return 'bg-blue-500/10 border-blue-500/20 text-blue-300';
      default: return 'bg-white/5 border-white/10 text-white/40';
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!space) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <HiLightningBolt className="w-16 h-16 text-white/10 mx-auto mb-4" />
          <p className="text-white/40 text-lg">Space not found</p>
          <Link to="/spaces" className="text-emerald-400 text-sm mt-2 inline-block hover:underline">Browse spaces</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/10 via-transparent to-teal-600/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
          <div className="flex items-center gap-2 text-sm text-white/30 mb-4">
            <Link to="/spaces" className="hover:text-white/60 transition-colors">Spaces</Link>
            <span>/</span>
            <span className="text-white/50">{space.owner_name || owner}</span>
            <span>/</span>
            <span className="text-white/70">{space.Name}</span>
          </div>

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <HiLightningBolt className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {space.owner_name || owner} <span className="text-white/30">/</span> {space.Name}
                </h1>
                {space.Description && <p className="text-white/40 text-sm mt-1 max-w-2xl">{space.Description}</p>}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button onClick={toggleLike} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${liked ? 'bg-pink-500/20 border-pink-500/30 text-pink-300' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'}`}>
                <HiHeart className="w-4 h-4" /> {space.TotalLikes}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4 text-sm text-white/30">
            {space.Sdk && <span className={`px-2.5 py-1 rounded border text-xs ${sdkBadgeClass(space.Sdk)}`}>{space.Sdk}{space.SdkVersion ? ` ${space.SdkVersion}` : ''}</span>}
            <span className="flex items-center gap-1.5"><HiClock className="w-4 h-4" />{new Date(space.CreatedAt).toLocaleDateString()}</span>
            {space.Hardware && <span className="text-white/25">{space.Hardware}</span>}
            {space.Private && <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-xs">Private</span>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            {(['app', 'files', 'community'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium transition-all relative ${activeTab === tab ? 'text-emerald-300' : 'text-white/40 hover:text-white/60'}`}
              >
                <span className="flex items-center gap-1.5">
                  {tab === 'app' && <HiPlay className="w-4 h-4" />}
                  {tab === 'files' && <HiFolder className="w-4 h-4" />}
                  {tab === 'community' && <HiChat className="w-4 h-4" />}
                  {tab === 'app' ? 'App' : tab === 'files' ? 'Files' : 'Community'}
                </span>
                {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'app' && (
          <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
            {space.EmbedUrl ? (
              <iframe
                src={space.EmbedUrl}
                className="w-full h-[600px] border-0"
                title={space.Name}
                allow="accelerometer; camera; microphone"
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-24">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mb-4">
                  <HiPlay className="w-10 h-10 text-emerald-400/40" />
                </div>
                <p className="text-white/40 text-lg mb-2">Space preview not available</p>
                <p className="text-white/25 text-sm">The app will appear here once it's deployed and running</p>
                {space.SpaceStatus && (
                  <span className="mt-3 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/40 text-xs">
                    Status: {space.SpaceStatus}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'files' && (
          <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-6 text-center">
            <HiFolder className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-white/40 text-sm">File browser coming soon</p>
          </div>
        )}

        {activeTab === 'community' && (
          <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-6 text-center">
            <HiChat className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-white/40 text-sm">Community discussions coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}
