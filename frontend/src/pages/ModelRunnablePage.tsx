import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  HiSearch, HiCube, HiDownload, HiHeart, HiAdjustments,
  HiClock, HiChevronLeft, HiChevronRight, HiStar, HiPlay,
  HiLightningBolt, HiChip,
} from 'react-icons/hi';
import { BROWSER_SUPPORTED_TASKS, SUGGESTED_MODELS } from '../services/browserInference';

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

function useDebounce<T>(value: T, delay: number): T {
  const [deb, setDeb] = useState(value);
  useEffect(() => { const t = setTimeout(() => setDeb(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return deb;
}

const taskEmoji: Record<string, string> = {
  'text-generation': '📝', 'text2text-generation': '📝', 'text-classification': '🏷️',
  'token-classification': '🔖', 'question-answering': '❓', 'summarization': '📋',
  'translation': '🌐', 'fill-mask': '🎭', 'image-classification': '🖼️',
  'automatic-speech-recognition': '🎙️', 'feature-extraction': '🧬',
  'sentence-similarity': '🔗', 'zero-shot-classification': '🎯',
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

function isLikelyOnnxCompatible(modelId?: string | null): boolean {
  if (!modelId) return false;
  const id = modelId.toLowerCase();
  return id.startsWith('xenova/') || id.startsWith('onnx-community/');
}

// Flatten all suggested models from browserInference
const allSuggestedModels = Object.entries(SUGGESTED_MODELS).flatMap(([task, models]) =>
  models.map(m => ({ ...m, task }))
);

export default function ModelRunnablePage() {
  const [sp] = useSearchParams();
  const [models, setModels] = useState<ModelItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(sp.get('search') || '');
  const [task, setTask] = useState(sp.get('task') || '');
  const [sort, setSort] = useState(sp.get('sort') || 'trending');
  const [page, setPage] = useState(parseInt(sp.get('page') || '1'));
  const [showFilters, setShowFilters] = useState(false);

  const debouncedSearch = useDebounce(search, 350);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set('runnable', 'true');
      if (debouncedSearch) p.set('search', debouncedSearch);
      if (task) p.set('task', task);
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
  }, [debouncedSearch, task, sort, page]);

  useEffect(() => { fetchModels(); }, [fetchModels]);

  const totalPages = Math.ceil(total / 30);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* ─── Hero Banner ──────────────────────────────────── */}
      <div className="relative mb-6 rounded-2xl overflow-hidden border border-emerald-500/20 bg-gradient-to-br from-emerald-600/10 via-transparent to-cyan-600/10 p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 flex-shrink-0">
            <HiLightningBolt className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Browser-Runnable Models</h2>
            <p className="text-sm text-white/50 mt-1 max-w-2xl">
              These models run <strong className="text-emerald-400">entirely in your browser</strong> using WebAssembly and ONNX Runtime — 
              no API keys, no server costs, no data leaves your device. Click "Try It" on any model to start.
            </p>
            <div className="flex items-center gap-4 mt-3 text-[11px] text-white/30">
              <span className="flex items-center gap-1"><HiChip className="w-3.5 h-3.5 text-emerald-400/60" /> Powered by Transformers.js</span>
              <span>•</span>
              <span>Models cached locally after first download</span>
              <span>•</span>
              <span>{total.toLocaleString()} runnable models found</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Suggested Quick-Start Models ──────────────────── */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
          <HiPlay className="w-4 h-4 text-emerald-400" /> Quick Start — Verified Compatible Models
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {allSuggestedModels.slice(0, 8).map(m => (
            <Link
              key={m.id}
              to={`/models/${m.id.split('/')[0]}/${m.id.split('/')[1]}`}
              className="group bg-emerald-500/[0.06] border border-emerald-500/10 rounded-xl p-3 hover:border-emerald-500/30 hover:bg-emerald-500/10 transition-all"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-emerald-400/80 truncate">{m.id}</span>
                <span className="flex-shrink-0 ml-2 text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                  {m.size}
                </span>
              </div>
              <p className="text-[11px] text-white/40 truncate">{m.label}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-white/25">{taskEmoji[m.task] || '🤖'} {m.task}</span>
                <span className="text-[10px] text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                  Try It →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ─── Search + Controls ───────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-2xl">
          <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search runnable models…"
            className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm transition-all ${
              showFilters || task
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
            }`}
          >
            <HiAdjustments className="w-4 h-4" />
            Task Filter {task && <span className="ml-1 w-5 h-5 rounded-full bg-emerald-500 text-[10px] flex items-center justify-center text-white font-bold">1</span>}
          </button>
          <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}
            className="bg-white/5 border border-white/10 rounded-xl text-sm text-white/60 px-3 py-2.5 focus:outline-none cursor-pointer hover:bg-white/10 transition-all">
            <option value="trending">🔥 Trending</option>
            <option value="downloads">📥 Most Downloads</option>
            <option value="likes">❤️ Most Liked</option>
            <option value="created">🆕 Newest</option>
          </select>
        </div>
      </div>

      {/* ─── Task filter panel ──────────────────────────────── */}
      {showFilters && (
        <div className="mb-5 bg-white/[0.02] border border-white/5 rounded-xl p-4 animate-fade-in">
          <label className="text-xs text-white/40 mb-2 block font-medium">Filter by Inference Task</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setTask(''); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                !task ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
              }`}
            >All Tasks</button>
            {BROWSER_SUPPORTED_TASKS.map(t => (
              <button
                key={t}
                onClick={() => { setTask(t === task ? '' : t); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                  task === t ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
                }`}
              >{taskEmoji[t] || '🤖'} {t}</button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Results count ──────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-white/30">
          {total.toLocaleString()} runnable models
          {task && <span className="text-emerald-400/60 ml-1">• {task}</span>}
        </p>
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
          <p className="text-white/40 text-lg font-medium">No runnable models found</p>
          <p className="text-white/25 text-sm mt-1">Try a different search or check the Quick Start models above</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map(m => {
            const onnxReady = isLikelyOnnxCompatible(m.OriginalModelId);
            return (
              <div key={m.RepoId} className="group relative bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:border-emerald-500/30 hover:bg-white/[0.05] transition-all duration-200">
                {/* Compatibility badge */}
                <div className="absolute top-3 right-3">
                  {onnxReady ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-[9px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                      <HiLightningBolt className="w-3 h-3" /> Ready
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-[9px] text-amber-400/70 font-bold uppercase tracking-wider">
                      May need ONNX
                    </span>
                  )}
                </div>

                <Link to={`/models/${m.owner_slug || m.OwnerId || m.RepoId}/${m.Slug}`} className="block">
                  <h3 className="text-[13px] font-semibold text-white group-hover:text-emerald-300 truncate pr-20 transition-colors">
                    {m.OriginalModelId || `${m.owner_name || 'user'}/${m.Name}`}
                  </h3>
                  {m.Description && (
                    <p className="text-[11px] text-white/30 mt-1 line-clamp-2">{m.Description}</p>
                  )}
                  {m.Task && (
                    <div className="mt-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-[11px] text-emerald-300 font-medium">
                        {taskEmoji[m.Task.toLowerCase()] || '🤖'} {m.Task}
                      </span>
                    </div>
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

                {/* Try It button */}
                <div className="mt-3 pt-3 border-t border-white/5">
                  <Link
                    to={`/models/${m.owner_slug || m.OwnerId || m.RepoId}/${m.Slug}?tab=inference`}
                    className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[12px] font-semibold hover:bg-emerald-500/20 hover:border-emerald-500/30 transition-all"
                  >
                    <HiPlay className="w-3.5 h-3.5" /> Try It in Browser
                  </Link>
                </div>
              </div>
            );
          })}
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
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${page === pn ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300' : 'text-white/40 hover:bg-white/10'}`}>
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
