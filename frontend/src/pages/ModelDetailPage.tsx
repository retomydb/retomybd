import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { HiCube, HiDownload, HiHeart, HiCode, HiDocumentText, HiChat, HiFolder, HiClock, HiTag } from 'react-icons/hi';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

interface ModelData {
  RepoId: string;
  Name: string;
  Slug: string;
  Description: string | null;
  Private: boolean;
  PricingModel: string;
  Price: number;
  LicenseType: string | null;
  TotalDownloads: number;
  TotalLikes: number;
  TotalViews: number;
  CreatedAt: string;
  UpdatedAt: string;
  LastCommitAt: string | null;
  owner_name: string | null;
  owner_slug: string | null;
  AvatarUrl: string | null;
  // Model metadata
  Framework: string | null;
  Task: string | null;
  Library: string | null;
  Architecture: string | null;
  ModelLanguage: string | null;
  BaseModel: string | null;
  ParameterCount: number | null;
  TensorType: string | null;
  PipelineTag: string | null;
  tags: string[];
  liked_by_user: boolean;
}

interface RepoFile {
  FileId: string;
  Path: string;
  SizeBytes: number;
  ContentType: string | null;
  Sha256: string | null;
}

export default function ModelDetailPage() {
  const { owner, slug } = useParams<{ owner: string; slug: string }>();
  const [model, setModel] = useState<ModelData | null>(null);
  const [files, setFiles] = useState<RepoFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'card' | 'files' | 'community'>('card');
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (owner && slug) fetchModel();
  }, [owner, slug]);

  async function fetchModel() {
    setLoading(true);
    try {
      const token = localStorage.getItem('retomy_access_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/models/${owner}/${slug}`, { headers });
      if (!res.ok) throw new Error('Model not found');
      const data = await res.json();
      setModel(data);
      setLiked(data.liked_by_user || false);

      // Fetch files
      const filesRes = await fetch(`${API_BASE}/repos/${data.RepoId}/tree?branch=main`, { headers });
      if (filesRes.ok) {
        const filesData = await filesRes.json();
        setFiles(filesData.files || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load model');
    } finally {
      setLoading(false);
    }
  }

  async function toggleLike() {
    if (!model) return;
    const token = localStorage.getItem('retomy_access_token');
    if (!token) { toast.error('Please log in to like models'); return; }
    try {
      const res = await fetch(`${API_BASE}/repos/${model.RepoId}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      setLiked(data.liked);
      setModel(prev => prev ? { ...prev, TotalLikes: prev.TotalLikes + (data.liked ? 1 : -1) } : prev);
    } catch { toast.error('Failed'); }
  }

  function formatSize(bytes: number) {
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
    if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
    return `${bytes} B`;
  }

  function formatNumber(n: number) {
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
    return String(n);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!model) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <HiCube className="w-16 h-16 text-white/10 mx-auto mb-4" />
          <p className="text-white/40 text-lg">Model not found</p>
          <Link to="/models" className="text-violet-400 text-sm mt-2 inline-block hover:underline">Browse models</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 via-transparent to-purple-600/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-white/30 mb-4">
            <Link to="/models" className="hover:text-white/60 transition-colors">Models</Link>
            <span>/</span>
            <span className="text-white/50">{model.owner_name || owner}</span>
            <span>/</span>
            <span className="text-white/70">{model.Name}</span>
          </div>

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <HiCube className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{model.owner_name || owner} <span className="text-white/30">/</span> {model.Name}</h1>
                {model.Description && <p className="text-white/40 text-sm mt-1 max-w-2xl">{model.Description}</p>}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button onClick={toggleLike} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${liked ? 'bg-pink-500/20 border-pink-500/30 text-pink-300' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'}`}>
                <HiHeart className="w-4 h-4" /> {formatNumber(model.TotalLikes)}
              </button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-6 mt-4 text-sm text-white/30">
            <span className="flex items-center gap-1.5"><HiDownload className="w-4 h-4" />{formatNumber(model.TotalDownloads)} downloads</span>
            <span className="flex items-center gap-1.5"><HiClock className="w-4 h-4" />Updated {model.UpdatedAt ? new Date(model.UpdatedAt).toLocaleDateString() : '—'}</span>
            {model.LicenseType && <span className="flex items-center gap-1.5"><HiDocumentText className="w-4 h-4" />{model.LicenseType}</span>}
            {model.Private && <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-xs">Private</span>}
          </div>

          {/* Tags */}
          {(model.tags.length > 0 || model.Task || model.Framework) && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {model.Task && <span className="px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs">{model.Task}</span>}
              {model.Framework && <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs">{model.Framework}</span>}
              {model.PipelineTag && <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">{model.PipelineTag}</span>}
              {model.tags.map(tag => (
                <span key={tag} className="px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            {(['card', 'files', 'community'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium transition-all relative ${activeTab === tab ? 'text-violet-300' : 'text-white/40 hover:text-white/60'}`}
              >
                <span className="flex items-center gap-1.5">
                  {tab === 'card' && <HiDocumentText className="w-4 h-4" />}
                  {tab === 'files' && <HiFolder className="w-4 h-4" />}
                  {tab === 'community' && <HiChat className="w-4 h-4" />}
                  {tab === 'card' ? 'Model Card' : tab === 'files' ? `Files (${files.length})` : 'Community'}
                </span>
                {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 to-purple-500" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main content */}
          <div className="lg:col-span-3">
            {activeTab === 'card' && (
              <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Model Card</h2>
                <div className="prose prose-invert prose-sm max-w-none">
                  <p className="text-white/50">
                    {model.Description || 'No model card provided yet. The author can add a README.md to describe this model.'}
                  </p>
                  {model.Architecture && (
                    <div className="mt-4">
                      <h3 className="text-white/70 text-sm font-medium">Architecture</h3>
                      <p className="text-white/40 text-sm">{model.Architecture}</p>
                    </div>
                  )}
                  {model.BaseModel && (
                    <div className="mt-4">
                      <h3 className="text-white/70 text-sm font-medium">Base Model</h3>
                      <p className="text-white/40 text-sm">{model.BaseModel}</p>
                    </div>
                  )}
                  {model.ParameterCount && (
                    <div className="mt-4">
                      <h3 className="text-white/70 text-sm font-medium">Parameters</h3>
                      <p className="text-white/40 text-sm">{formatNumber(model.ParameterCount)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'files' && (
              <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <span className="text-sm text-white/60">{files.length} files</span>
                </div>
                {files.length === 0 ? (
                  <div className="py-12 text-center">
                    <HiFolder className="w-10 h-10 text-white/10 mx-auto mb-2" />
                    <p className="text-white/30 text-sm">No files uploaded yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {files.map(f => (
                      <div key={f.FileId} className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <HiDocumentText className="w-4 h-4 text-white/20 shrink-0" />
                          <span className="text-sm text-white/70 truncate">{f.Path}</span>
                        </div>
                        <span className="text-xs text-white/30 shrink-0 ml-4">{formatSize(f.SizeBytes)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'community' && (
              <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-6 text-center">
                <HiChat className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-white/40 text-sm">Community discussions coming soon</p>
                <p className="text-white/25 text-xs mt-1">Share feedback, ask questions, and contribute</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Use this model */}
            <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Use this model</h3>
              {model.Library && (
                <div className="bg-black/30 rounded-lg p-3 mb-3">
                  <code className="text-xs text-green-300">
                    {model.Library === 'transformers'
                      ? `from transformers import AutoModel\nmodel = AutoModel.from_pretrained("${owner}/${model.Slug}")`
                      : `# Install: pip install ${model.Library}\n# Load: ${model.Library}.load("${owner}/${model.Slug}")`}
                  </code>
                </div>
              )}
              {model.PricingModel === 'one_time' && model.Price > 0 ? (
                <button className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity">
                  Purchase — ${model.Price.toFixed(2)}
                </button>
              ) : (
                <button className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity">
                  Download Model
                </button>
              )}
            </div>

            {/* Model info */}
            <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Model Info</h3>
              <dl className="space-y-2.5 text-sm">
                {model.Task && <div className="flex justify-between"><dt className="text-white/40">Task</dt><dd className="text-white/70">{model.Task}</dd></div>}
                {model.Framework && <div className="flex justify-between"><dt className="text-white/40">Framework</dt><dd className="text-white/70">{model.Framework}</dd></div>}
                {model.Library && <div className="flex justify-between"><dt className="text-white/40">Library</dt><dd className="text-white/70">{model.Library}</dd></div>}
                {model.ModelLanguage && <div className="flex justify-between"><dt className="text-white/40">Language</dt><dd className="text-white/70">{model.ModelLanguage}</dd></div>}
                {model.TensorType && <div className="flex justify-between"><dt className="text-white/40">Tensor Type</dt><dd className="text-white/70">{model.TensorType}</dd></div>}
                <div className="flex justify-between"><dt className="text-white/40">Downloads</dt><dd className="text-white/70">{formatNumber(model.TotalDownloads)}</dd></div>
                <div className="flex justify-between"><dt className="text-white/40">Views</dt><dd className="text-white/70">{formatNumber(model.TotalViews)}</dd></div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
