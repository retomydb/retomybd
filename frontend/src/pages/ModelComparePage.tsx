import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { HiScale, HiSearch, HiPlus, HiX, HiCheck, HiMinus } from 'react-icons/hi';

const API = import.meta.env.VITE_API_BASE_URL || '/api/v1';

interface CompareModel {
  RepoId: string;
  Name: string;
  Slug: string;
  Description: string | null;
  TotalDownloads: number;
  TotalLikes: number;
  TotalViews: number;
  Trending: number;
  LicenseType: string | null;
  CreatedAt: string;
  UpdatedAt: string;
  Framework: string | null;
  Task: string | null;
  Library: string | null;
  Architecture: string | null;
  ModelLanguage: string | null;
  BaseModel: string | null;
  ParameterCount: number | null;
  TensorType: string | null;
  PipelineTag: string | null;
  HostingType: string | null;
  OriginalModelId: string | null;
  GithubStars: number | null;
  SafeTensors: boolean | null;
  InferenceEnabled: boolean | null;
  owner_name: string | null;
  owner_slug: string | null;
}

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}

const FIELDS: { key: keyof CompareModel; label: string; format?: (v: any) => string }[] = [
  { key: 'Task', label: 'Task' },
  { key: 'Framework', label: 'Framework' },
  { key: 'Library', label: 'Library' },
  { key: 'Architecture', label: 'Architecture' },
  { key: 'ParameterCount', label: 'Parameters', format: fmt },
  { key: 'TotalDownloads', label: 'Downloads', format: fmt },
  { key: 'TotalLikes', label: 'Likes', format: fmt },
  { key: 'TotalViews', label: 'Views', format: fmt },
  { key: 'GithubStars', label: 'GitHub Stars', format: fmt },
  { key: 'Trending', label: 'Trending Score', format: (v: number) => v?.toFixed(1) || '—' },
  { key: 'LicenseType', label: 'License' },
  { key: 'HostingType', label: 'Source' },
  { key: 'BaseModel', label: 'Base Model' },
  { key: 'TensorType', label: 'Tensor Type' },
  { key: 'SafeTensors', label: 'SafeTensors', format: (v: boolean | null) => v == null ? '—' : v ? '✅' : '❌' },
  { key: 'InferenceEnabled', label: 'Inference API', format: (v: boolean | null) => v == null ? '—' : v ? '✅' : '❌' },
  { key: 'ModelLanguage', label: 'Language' },
  { key: 'CreatedAt', label: 'Created', format: (v: string) => v ? new Date(v).toLocaleDateString() : '—' },
];

export default function ModelComparePage() {
  const [sp] = useSearchParams();
  const [models, setModels] = useState<CompareModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    sp.get('ids')?.split(',').filter(Boolean) || []
  );

  // Fetch comparison data when IDs change
  useEffect(() => {
    if (selectedIds.length < 2) { setModels([]); return; }
    setLoading(true);
    fetch(`${API}/models/analytics/compare?ids=${selectedIds.join(',')}`)
      .then(r => r.json())
      .then(d => { setModels(d.models || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedIds]);

  // Search for models to add
  useEffect(() => {
    if (!searchQ.trim()) { setSearchResults([]); return; }
    const t = setTimeout(() => {
      setSearching(true);
      fetch(`${API}/models?search=${encodeURIComponent(searchQ)}&page_size=8`)
        .then(r => r.json())
        .then(d => { setSearchResults(d.models || []); setSearching(false); })
        .catch(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  const addModel = (id: string) => {
    if (selectedIds.length >= 6 || selectedIds.includes(id)) return;
    setSelectedIds([...selectedIds, id]);
    setSearchQ('');
    setSearchResults([]);
  };

  const removeModel = (id: string) => {
    setSelectedIds(selectedIds.filter(x => x !== id));
  };

  // Determine best value for highlighting
  function bestInRow(key: keyof CompareModel): string | null {
    const numericKeys = ['TotalDownloads', 'TotalLikes', 'TotalViews', 'Trending', 'GithubStars', 'ParameterCount'];
    if (!numericKeys.includes(key as string)) return null;
    let best = -Infinity, bestId = '';
    for (const m of models) {
      const v = (m[key] as number) || 0;
      if (v > best) { best = v; bestId = m.RepoId; }
    }
    return best > 0 ? bestId : null;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Search to add models */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <HiScale className="w-5 h-5 text-violet-400" />
          <h2 className="text-lg font-semibold text-white">Compare Models Side by Side</h2>
          <span className="text-xs text-white/30">{selectedIds.length}/6 selected</span>
        </div>

        <div className="relative max-w-md">
          <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text" value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Search to add models for comparison…"
            className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 transition-all"
          />
          {/* Dropdown results */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#1b2838] border border-white/10 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto">
              {searchResults.map((r: any) => (
                <button key={r.RepoId}
                  onClick={() => addModel(r.RepoId)}
                  disabled={selectedIds.includes(r.RepoId) || selectedIds.length >= 6}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors disabled:opacity-30">
                  <HiPlus className="w-4 h-4 text-violet-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{r.OriginalModelId || r.Name}</p>
                    <p className="text-[10px] text-white/30">{r.Task || 'No task'} · {r.Framework || 'No framework'}</p>
                  </div>
                  {selectedIds.includes(r.RepoId) && <HiCheck className="w-4 h-4 text-green-400 ml-auto" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected chips */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {models.map(m => (
              <span key={m.RepoId} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300">
                {m.OriginalModelId || m.Name}
                <button onClick={() => removeModel(m.RepoId)} className="text-violet-400/60 hover:text-white transition-colors">
                  <HiX className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Comparison table */}
      {loading ? (
        <div className="h-96 bg-white/[0.03] rounded-2xl animate-pulse" />
      ) : models.length < 2 ? (
        <div className="text-center py-24 bg-white/[0.02] border border-white/5 rounded-2xl">
          <HiScale className="w-12 h-12 text-white/10 mx-auto mb-3" />
          <p className="text-white/40 text-lg font-medium">Select at least 2 models to compare</p>
          <p className="text-white/25 text-sm mt-1">Use the search above or select from the Search tab</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-4 text-xs text-white/30 font-semibold uppercase w-40">Field</th>
                {models.map(m => (
                  <th key={m.RepoId} className="text-left py-3 px-4 min-w-[180px]">
                    <Link to={`/models/${m.owner_slug || m.RepoId}/${m.Slug}`}
                      className="text-violet-300 hover:text-violet-200 font-semibold text-xs transition-colors">
                      {m.OriginalModelId || m.Name}
                    </Link>
                    <p className="text-[10px] text-white/25 mt-0.5">{m.owner_name || 'unknown'}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FIELDS.map(f => {
                const winner = bestInRow(f.key);
                return (
                  <tr key={f.key} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 px-4 text-xs text-white/40 font-medium">{f.label}</td>
                    {models.map(m => {
                      const val = m[f.key];
                      const display = f.format ? f.format(val) : (val ?? '—');
                      const isWinner = winner === m.RepoId;
                      return (
                        <td key={m.RepoId}
                          className={`py-2.5 px-4 text-xs ${isWinner ? 'text-green-400 font-semibold' : 'text-white/60'}`}>
                          {display}
                          {isWinner && <span className="ml-1 text-[10px]">👑</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
