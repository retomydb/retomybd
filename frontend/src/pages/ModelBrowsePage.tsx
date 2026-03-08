import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  HiSearch, HiCube, HiDownload, HiHeart, HiAdjustments, HiPlus,
  HiClock, HiChevronLeft, HiChevronRight,
} from 'react-icons/hi';
import { useAuthStore } from '../store/authStore';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

interface ModelItem {
  RepoId: string;
  Name: string;
  Slug: string;
  Description: string | null;
  TotalDownloads: number;
  TotalLikes: number;
  Framework: string | null;
  Task: string | null;
  Library: string | null;
  ModelLanguage: string | null;
  PipelineTag: string | null;
  ParameterCount: number | null;
  owner_name: string | null;
  owner_slug: string | null;
  UpdatedAt?: string;
  CreatedAt?: string;
  OriginalModelId?: string | null;
}

const TASK_OPTIONS = [
  'text-generation', 'text-classification', 'token-classification',
  'question-answering', 'summarization', 'translation',
  'fill-mask', 'image-classification', 'object-detection',
  'image-segmentation', 'text-to-image', 'image-text-to-text',
  'audio-classification', 'automatic-speech-recognition',
  'reinforcement-learning',
];

const FRAMEWORK_OPTIONS = [
  'pytorch', 'tensorflow', 'jax', 'onnx', 'safetensors', 'gguf',
];

export default function ModelBrowsePage() {
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [models, setModels] = useState<ModelItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [task, setTask] = useState(searchParams.get('task') || '');
  const [framework, setFramework] = useState(searchParams.get('framework') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'trending');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'));
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => { fetchModels(); }, [search, task, framework, sort, page]);

  async function fetchModels() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (task) params.set('task', task);
      if (framework) params.set('framework', framework);
      params.set('sort', sort);
      params.set('page', String(page));
      params.set('page_size', '30');

      const token = localStorage.getItem('retomy_access_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/models?${params}`, { headers });
      const data = await res.json();
      setModels(data.models || []);
      setTotalCount(data.total_count || 0);
    } catch (err) {
      console.error('Failed to fetch models', err);
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(totalCount / 30);

  function formatNumber(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
  }

  function formatParamCount(n: number | null) {
    if (!n) return null;
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(0)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return String(n);
  }

  function timeAgo(dateStr?: string) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
  }

  // Display OriginalModelId when available, otherwise fallback to owner/name
  function displayOriginalId(orig?: string | null, ownerName?: string | null, name?: string) {
    return orig || `${ownerName || 'user'}/${name}`;
  }

  // Task → emoji mapping for visual flair (HF-style)
  function taskIcon(t: string | null) {
    if (!t) return null;
    const map: Record<string, string> = {
      'text-generation': '📝',
      'text-classification': '🏷️',
      'token-classification': '🔖',
      'question-answering': '❓',
      'summarization': '📋',
      'translation': '🌐',
      'fill-mask': '🎭',
      'image-classification': '🖼️',
      'object-detection': '🔍',
      'image-segmentation': '✂️',
      'text-to-image': '🎨',
      'image-text-to-text': '👁️',
      'audio-classification': '🔊',
      'automatic-speech-recognition': '🎙️',
      'reinforcement-learning': '🎮',
    };
    return map[t.toLowerCase()] || '🤖';
  }

  return (
    <div className="min-h-screen">
      {/* ─── Header ────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 via-transparent to-cyan-600/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <HiCube className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Models</h1>
                <p className="text-xs text-white/40 mt-0.5">
                  {totalCount.toLocaleString()} models available
                </p>
              </div>
            </div>
            {isAuthenticated && (
              <button
                onClick={() => navigate('/models/new')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-medium hover:from-violet-500 hover:to-purple-500 transition-all shadow-lg shadow-violet-500/20"
              >
                <HiPlus className="w-4 h-4" /> New Model
              </button>
            )}
          </div>

          {/* Search + Sort row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-xl">
              <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search models..."
                className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-all ${
                  showFilters || task || framework
                    ? 'bg-violet-500/10 border-violet-500/30 text-violet-300'
                    : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                }`}
              >
                <HiAdjustments className="w-4 h-4" />
                Filters
                {(task || framework) && (
                  <span className="ml-1 w-4 h-4 rounded-full bg-violet-500 text-[10px] flex items-center justify-center text-white font-bold">
                    {(task ? 1 : 0) + (framework ? 1 : 0)}
                  </span>
                )}
              </button>
              <select
                value={sort}
                onChange={e => { setSort(e.target.value); setPage(1); }}
                className="bg-white/5 border border-white/10 rounded-lg text-sm text-white/60 px-3 py-2 focus:outline-none cursor-pointer hover:bg-white/10 transition-all"
              >
                <option value="trending">Trending</option>
                <option value="downloads">Most Downloads</option>
                <option value="likes">Most Liked</option>
                <option value="created">Newest</option>
                <option value="updated">Recently Updated</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Filters panel ─────────────────────────────────────────────── */}
      {showFilters && (
        <div className="border-b border-white/5 bg-white/[0.02]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block font-medium">Task</label>
                <select
                  value={task}
                  onChange={e => { setTask(e.target.value); setPage(1); }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg text-sm text-white/70 px-3 py-2 focus:outline-none appearance-none cursor-pointer"
                >
                  <option value="">All Tasks</option>
                  {TASK_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block font-medium">Framework</label>
                <select
                  value={framework}
                  onChange={e => { setFramework(e.target.value); setPage(1); }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg text-sm text-white/70 px-3 py-2 focus:outline-none appearance-none cursor-pointer"
                >
                  <option value="">All Frameworks</option>
                  {FRAMEWORK_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => { setTask(''); setFramework(''); setSearch(''); setPage(1); }}
                  className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Model card grid ──────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 animate-pulse">
                <div className="h-4 w-3/4 bg-white/10 rounded mb-3" />
                <div className="h-3 w-1/2 bg-white/5 rounded mb-4" />
                <div className="flex gap-3">
                  <div className="h-3 w-16 bg-white/5 rounded" />
                  <div className="h-3 w-16 bg-white/5 rounded" />
                  <div className="h-3 w-16 bg-white/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : models.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-white/10 flex items-center justify-center mx-auto mb-4">
              <HiCube className="w-7 h-7 text-white/20" />
            </div>
            <p className="text-white/40 text-lg font-medium mb-1">No models found</p>
            <p className="text-white/25 text-sm">Try adjusting your filters or search query</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {models.map(model => (
              <Link
                key={model.RepoId}
                to={`/models/${model.owner_slug || model.RepoId}/${model.Slug}`}
                className="group relative bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:border-violet-500/30 hover:bg-white/[0.05] transition-all duration-200"
              >
                {/* Model name */}
                <div className="flex items-start gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[13px] font-semibold text-white group-hover:text-violet-300 transition-colors truncate flex items-center gap-2">
                      <span className="truncate">
                        {displayOriginalId(model.OriginalModelId, model.owner_name, model.Name)}
                      </span>
                    </h3>
                  </div>
                </div>

                {/* Task tag */}
                {model.Task && (
                  <div className="mb-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-500/10 text-[11px] text-violet-300 font-medium">
                      <span>{taskIcon(model.Task)}</span>
                      {model.Task}
                    </span>
                  </div>
                )}

                {/* Meta row: size · updated · downloads · likes */}
                <div className="flex items-center gap-3 text-[11px] text-white/30 flex-wrap">
                  {model.ParameterCount != null && model.ParameterCount > 0 && (
                    <span className="inline-flex items-center gap-0.5">
                      {formatParamCount(model.ParameterCount)}
                    </span>
                  )}

                  {model.UpdatedAt && (
                    <span className="inline-flex items-center gap-0.5">
                      <HiClock className="w-3 h-3" />
                      Updated {timeAgo(model.UpdatedAt)}
                    </span>
                  )}

                  <span className="inline-flex items-center gap-0.5">
                    <HiDownload className="w-3 h-3" />
                    {formatNumber(model.TotalDownloads)}
                  </span>

                  <span className="inline-flex items-center gap-0.5">
                    <HiHeart className="w-3 h-3" />
                    {formatNumber(model.TotalLikes)}
                  </span>
                </div>

                {/* Framework / Library chips */}
                {(model.Framework || model.Library) && (
                  <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                    {model.Framework && (
                      <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-[10px] text-cyan-400/70 font-medium">
                        {model.Framework}
                      </span>
                    )}
                    {model.Library && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-[10px] text-amber-400/70 font-medium">
                        {model.Library}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* ─── Pagination ──────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white/50 hover:bg-white/10 disabled:opacity-30 transition-all"
            >
              <HiChevronLeft className="w-4 h-4" /> Previous
            </button>

            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (page <= 4) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = page - 3 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                      page === pageNum
                        ? 'bg-violet-500/20 border border-violet-500/40 text-violet-300'
                        : 'text-white/40 hover:bg-white/10'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white/50 hover:bg-white/10 disabled:opacity-30 transition-all"
            >
              Next <HiChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
