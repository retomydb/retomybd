import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  HiSearch, HiCube, HiDownload, HiHeart, HiAdjustments, HiPlus,
  HiClock, HiChevronLeft, HiChevronRight, HiStar, HiX,
} from 'react-icons/hi';
import { useAuthStore } from '../store/authStore';

const API = import.meta.env.VITE_API_BASE_URL || '/api/v1';

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
  PipelineTag: string | null;
  ParameterCount: number | null;
  OriginalModelId?: string | null;
  GithubStars?: number;
  HostingType?: string;
  owner_name: string | null;
  owner_slug: string | null;
  UpdatedAt?: string;
  OwnerId?: string;
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [deb, setDeb] = useState(value);
  useEffect(() => { const t = setTimeout(() => setDeb(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return deb;
}

const TASKS = [
  'text-generation', 'text-classification', 'token-classification',
  'question-answering', 'summarization', 'translation', 'fill-mask',
  'image-classification', 'object-detection', 'image-segmentation',
  'text-to-image', 'image-text-to-text', 'audio-classification',
  'automatic-speech-recognition', 'reinforcement-learning',
  'feature-extraction', 'sentence-similarity', 'zero-shot-classification',
];
const FRAMEWORKS = ['pytorch', 'tensorflow', 'jax', 'onnx', 'safetensors', 'gguf'];
const LIBRARIES = ['transformers', 'diffusers', 'timm', 'spacy', 'sentence-transformers', 'peft', 'adapter-transformers'];

const taskEmoji: Record<string, string> = {
  'text-generation': '📝', 'text-classification': '🏷️', 'token-classification': '🔖',
  'question-answering': '❓', 'summarization': '📋', 'translation': '🌐', 'fill-mask': '🎭',
  'image-classification': '🖼️', 'object-detection': '🔍', 'image-segmentation': '✂️',
  'text-to-image': '🎨', 'image-text-to-text': '👁️', 'audio-classification': '🔊',
  'automatic-speech-recognition': '🎙️', 'reinforcement-learning': '🎮',
  'feature-extraction': '🧬', 'sentence-similarity': '🔗', 'zero-shot-classification': '🎯',
};

function fmt(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}
function fmtParams(n: number | null) {
  if (!n) return null;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}
function timeAgo(d?: string) {
  if (!d) return '';
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dd = Math.floor(h / 24);
  if (dd < 30) return `${dd}d ago`;
  return `${Math.floor(dd / 30)}mo ago`;
}

export default function ModelSearchPage() {
  const [sp] = useSearchParams();
  const { isAuthenticated } = useAuthStore();
  const [models, setModels] = useState<ModelItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(sp.get('search') || '');
  const [task, setTask] = useState(sp.get('task') || '');
  const [framework, setFw] = useState(sp.get('framework') || '');
  const [library, setLib] = useState(sp.get('library') || '');
  const [sort, setSort] = useState(sp.get('sort') || 'trending');
  const [page, setPage] = useState(parseInt(sp.get('page') || '1'));
  const [showFilters, setShowFilters] = useState(false);
  const [compareList, setCompareList] = useState<string[]>([]);

  const debouncedSearch = useDebounce(search, 350);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (debouncedSearch) p.set('search', debouncedSearch);
      if (task) p.set('task', task);
      if (framework) p.set('framework', framework);
      if (library) p.set('library', library);
      p.set('sort', sort);
      p.set('page', String(page));
      p.set('page_size', '30');
      const token = localStorage.getItem('retomy_access_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API}/models?${p}`, { headers });
      const data = await res.json();
      setModels(data.models || []);
      setTotal(data.total_count || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [debouncedSearch, task, framework, library, sort, page]);

  useEffect(() => { fetchModels(); }, [fetchModels]);

  const totalPages = Math.ceil(total / 30);
  const activeFilters = [task, framework, library].filter(Boolean).length;

  const toggleCompare = (id: string) => {
    setCompareList(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 6 ? [...prev, id] : prev
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* ─── Search + Controls ───────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-2xl">
          <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search 900k+ models by name, task, or description…"
            className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm transition-all ${
              showFilters || activeFilters > 0
                ? 'bg-violet-500/10 border-violet-500/30 text-violet-300'
                : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
            }`}
          >
            <HiAdjustments className="w-4 h-4" />
            Filters {activeFilters > 0 && <span className="ml-1 w-5 h-5 rounded-full bg-violet-500 text-[10px] flex items-center justify-center text-white font-bold">{activeFilters}</span>}
          </button>
          <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}
            className="bg-white/5 border border-white/10 rounded-xl text-sm text-white/60 px-3 py-2.5 focus:outline-none cursor-pointer hover:bg-white/10 transition-all">
            <option value="trending">🔥 Trending</option>
            <option value="downloads">📥 Most Downloads</option>
            <option value="likes">❤️ Most Liked</option>
            <option value="created">🆕 Newest</option>
            <option value="updated">🔄 Recently Updated</option>
          </select>
          {isAuthenticated && (
            <Link to="/models/new"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-medium hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-violet-500/20 transition-all">
              <HiPlus className="w-4 h-4" /> New
            </Link>
          )}
        </div>
      </div>

      {/* Compare floating bar */}
      {compareList.length >= 2 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-violet-600/95 backdrop-blur-lg text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4">
          <span className="text-sm font-medium">{compareList.length} models selected</span>
          <Link to={`/models/compare?ids=${compareList.join(',')}`}
            className="px-4 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-sm font-semibold transition-colors">
            Compare →
          </Link>
          <button onClick={() => setCompareList([])} className="text-white/60 hover:text-white transition-colors">
            <HiX className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─── Filters panel ──────────────────────────────────── */}
      {showFilters && (
        <div className="mb-5 bg-white/[0.02] border border-white/5 rounded-xl p-4 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-white/40 mb-1.5 block font-medium">Task / Pipeline</label>
              <select value={task} onChange={e => { setTask(e.target.value); setPage(1); }}
                className="w-full bg-white/5 border border-white/10 rounded-lg text-sm text-white/70 px-3 py-2 focus:outline-none appearance-none cursor-pointer">
                <option value="">All Tasks</option>
                {TASKS.map(t => <option key={t} value={t}>{taskEmoji[t] || '🤖'} {t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block font-medium">Framework</label>
              <select value={framework} onChange={e => { setFw(e.target.value); setPage(1); }}
                className="w-full bg-white/5 border border-white/10 rounded-lg text-sm text-white/70 px-3 py-2 focus:outline-none appearance-none cursor-pointer">
                <option value="">All Frameworks</option>
                {FRAMEWORKS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block font-medium">Library</label>
              <select value={library} onChange={e => { setLib(e.target.value); setPage(1); }}
                className="w-full bg-white/5 border border-white/10 rounded-lg text-sm text-white/70 px-3 py-2 focus:outline-none appearance-none cursor-pointer">
                <option value="">All Libraries</option>
                {LIBRARIES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button onClick={() => { setTask(''); setFw(''); setLib(''); setSearch(''); setPage(1); }}
              className="text-xs text-violet-400 hover:text-violet-300 transition-colors">Clear all</button>
            <span className="text-xs text-white/20">{total.toLocaleString()} results</span>
          </div>
        </div>
      )}

      {/* ─── Results count ──────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-white/30">{total.toLocaleString()} models</p>
      </div>

      {/* ─── Grid ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 animate-pulse">
              <div className="h-4 w-3/4 bg-white/10 rounded mb-3" />
              <div className="h-3 w-1/2 bg-white/5 rounded mb-4" />
              <div className="flex gap-3"><div className="h-3 w-16 bg-white/5 rounded" /><div className="h-3 w-16 bg-white/5 rounded" /></div>
            </div>
          ))}
        </div>
      ) : models.length === 0 ? (
        <div className="text-center py-24">
          <HiCube className="w-12 h-12 text-white/10 mx-auto mb-3" />
          <p className="text-white/40 text-lg font-medium">No models found</p>
          <p className="text-white/25 text-sm mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map(m => (
            <div key={m.RepoId} className="group relative bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:border-violet-500/30 hover:bg-white/[0.05] transition-all duration-200">
              {/* Checkbox for compare */}
              <button
                onClick={(e) => { e.preventDefault(); toggleCompare(m.RepoId); }}
                className={`absolute top-3 right-3 w-5 h-5 rounded border text-[10px] flex items-center justify-center transition-all ${
                  compareList.includes(m.RepoId) ? 'bg-violet-500 border-violet-500 text-white' : 'border-white/10 text-transparent hover:border-violet-500/40'
                }`}
              >✓</button>

              <Link to={`/models/${m.owner_slug || m.OwnerId || m.RepoId}/${m.Slug}`} className="block">
                <h3 className="text-[13px] font-semibold text-white group-hover:text-violet-300 truncate pr-6 transition-colors">
                  {m.OriginalModelId || `${m.owner_name || 'user'}/${m.Name}`}
                </h3>
                {m.Description && (
                  <p className="text-[11px] text-white/30 mt-1 line-clamp-2">{m.Description}</p>
                )}
                {m.Task && (
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-500/10 text-[11px] text-violet-300 font-medium">
                      {taskEmoji[m.Task.toLowerCase()] || '🤖'} {m.Task}
                    </span>
                  </div>
                )}

                {/* Hosting badge */}
                {m.HostingType && (
                  <span className={`inline-flex items-center mt-1.5 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${
                    m.HostingType === 'huggingface' ? 'bg-yellow-500/10 text-yellow-400/70' :
                    m.HostingType === 'github' ? 'bg-gray-500/10 text-gray-400/70' :
                    'bg-blue-500/10 text-blue-400/70'
                  }`}>
                    {m.HostingType}
                  </span>
                )}

                <div className="flex items-center gap-3 text-[11px] text-white/30 mt-2 flex-wrap">
                  {m.ParameterCount != null && m.ParameterCount > 0 && (
                    <span className="font-medium text-white/40">{fmtParams(m.ParameterCount)} params</span>
                  )}
                  <span className="inline-flex items-center gap-0.5"><HiDownload className="w-3 h-3" />{fmt(m.TotalDownloads)}</span>
                  <span className="inline-flex items-center gap-0.5"><HiHeart className="w-3 h-3" />{fmt(m.TotalLikes)}</span>
                  {m.GithubStars != null && m.GithubStars > 0 && (
                    <span className="inline-flex items-center gap-0.5"><HiStar className="w-3 h-3" />{fmt(m.GithubStars)}</span>
                  )}
                  {m.UpdatedAt && (
                    <span className="inline-flex items-center gap-0.5"><HiClock className="w-3 h-3" />{timeAgo(m.UpdatedAt)}</span>
                  )}
                </div>
                {(m.Framework || m.Library) && (
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {m.Framework && <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-[10px] text-cyan-400/70 font-medium">{m.Framework}</span>}
                    {m.Library && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-[10px] text-amber-400/70 font-medium">{m.Library}</span>}
                  </div>
                )}
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* ─── Pagination ─────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white/50 hover:bg-white/10 disabled:opacity-30 transition-all">
            <HiChevronLeft className="w-4 h-4" /> Prev
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pn: number;
              if (totalPages <= 7) pn = i + 1;
              else if (page <= 4) pn = i + 1;
              else if (page >= totalPages - 3) pn = totalPages - 6 + i;
              else pn = page - 3 + i;
              return (
                <button key={pn} onClick={() => setPage(pn)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${page === pn ? 'bg-violet-500/20 border border-violet-500/40 text-violet-300' : 'text-white/40 hover:bg-white/10'}`}>
                  {pn}
                </button>
              );
            })}
          </div>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white/50 hover:bg-white/10 disabled:opacity-30 transition-all">
            Next <HiChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
