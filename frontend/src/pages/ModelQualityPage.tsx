import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  HiShieldCheck, HiDownload, HiHeart, HiStar,
} from 'react-icons/hi';

const API = import.meta.env.VITE_API_BASE_URL || '/api/v1';

interface QualityModel {
  RepoId: string;
  Name: string;
  Slug: string;
  Description: string | null;
  TotalDownloads: number;
  TotalLikes: number;
  LicenseType: string | null;
  Framework: string | null;
  Task: string | null;
  Library: string | null;
  Architecture: string | null;
  ParameterCount: number | null;
  PipelineTag: string | null;
  OriginalModelId: string | null;
  GithubStars: number | null;
  quality_score: number;
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

function scoreColor(s: number): string {
  if (s >= 80) return 'text-green-400';
  if (s >= 50) return 'text-amber-400';
  if (s >= 25) return 'text-orange-400';
  return 'text-red-400';
}

function scoreBg(s: number): string {
  if (s >= 80) return 'bg-green-500';
  if (s >= 50) return 'bg-amber-500';
  if (s >= 25) return 'bg-orange-500';
  return 'bg-red-500';
}

function scoreLabel(s: number): string {
  if (s >= 80) return 'Excellent';
  if (s >= 50) return 'Good';
  if (s >= 25) return 'Fair';
  return 'Poor';
}

// Quality criteria checklist
function ScoreBreakdown({ model }: { model: QualityModel }) {
  const checks = [
    { label: 'Has Description', met: !!model.Description && model.Description.length > 10, pts: 15 },
    { label: 'Has README', met: true, pts: 20 }, // We don't have this in list view, show as unknown
    { label: 'Task Defined', met: !!model.Task, pts: 10 },
    { label: 'Framework Set', met: !!model.Framework, pts: 10 },
    { label: 'License Specified', met: !!model.LicenseType && model.LicenseType !== '', pts: 15 },
    { label: 'Parameter Count', met: !!model.ParameterCount && model.ParameterCount > 0, pts: 10 },
    { label: 'Architecture', met: !!model.Architecture, pts: 10 },
  ];
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {checks.map(c => (
        <span key={c.label}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${
            c.met ? 'bg-green-500/10 text-green-400/70' : 'bg-red-500/10 text-red-400/50'
          }`}>
          {c.met ? '✓' : '✗'} {c.label}
        </span>
      ))}
    </div>
  );
}

export default function ModelQualityPage() {
  const [models, setModels] = useState<QualityModel[]>([]);
  const [distribution, setDistribution] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('score_desc');
  const [minScore, setMinScore] = useState(0);
  const [task, setTask] = useState('');

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ sort, min_score: String(minScore), limit: '100' });
    if (task) p.set('task', task);
    fetch(`${API}/models/analytics/quality-scores?${p}`)
      .then(r => r.json())
      .then(d => {
        setModels(d.models || []);
        setDistribution(d.distribution || {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sort, minScore, task]);

  const total = Object.values(distribution).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <HiShieldCheck className="w-5 h-5 text-violet-400" />
        <div>
          <h2 className="text-lg font-semibold text-white">Documentation Quality Scores</h2>
          <p className="text-xs text-white/30">How well-documented are models? Score based on description, README, license, metadata completeness</p>
        </div>
      </div>

      {/* Distribution overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { key: 'excellent', label: 'Excellent (80-100)', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
          { key: 'good', label: 'Good (50-79)', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
          { key: 'fair', label: 'Fair (25-49)', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
          { key: 'poor', label: 'Poor (0-24)', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
        ].map(b => (
          <button key={b.key}
            onClick={() => setMinScore(b.key === 'excellent' ? 80 : b.key === 'good' ? 50 : b.key === 'fair' ? 25 : 0)}
            className={`${b.bg} border rounded-xl p-4 text-left hover:scale-[1.02] transition-all`}>
            <p className={`text-2xl font-bold ${b.color}`}>{distribution[b.key] || 0}</p>
            <p className="text-[10px] text-white/30 mt-1">{b.label}</p>
            <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${scoreBg(b.key === 'excellent' ? 80 : b.key === 'good' ? 50 : b.key === 'fair' ? 25 : 0)}`}
                style={{ width: `${((distribution[b.key] || 0) / total) * 100}%` }} />
            </div>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select value={sort} onChange={e => setSort(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl text-sm text-white/60 px-3 py-2 cursor-pointer">
          <option value="score_desc">Highest Score First</option>
          <option value="score_asc">Lowest Score First</option>
          <option value="downloads">Most Downloads</option>
          <option value="name">By Name</option>
        </select>
        <select value={String(minScore)} onChange={e => setMinScore(Number(e.target.value))}
          className="bg-white/5 border border-white/10 rounded-xl text-sm text-white/60 px-3 py-2 cursor-pointer">
          <option value="0">All Scores</option>
          <option value="25">Score ≥ 25</option>
          <option value="50">Score ≥ 50</option>
          <option value="80">Score ≥ 80</option>
        </select>
        <select value={task} onChange={e => setTask(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl text-sm text-white/60 px-3 py-2 cursor-pointer">
          <option value="">All Tasks</option>
          <option value="text-generation">text-generation</option>
          <option value="text-classification">text-classification</option>
          <option value="image-classification">image-classification</option>
          <option value="text-to-image">text-to-image</option>
          <option value="question-answering">question-answering</option>
        </select>
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => <div key={i} className="h-20 bg-white/[0.03] rounded-xl animate-pulse" />)}
        </div>
      ) : models.length === 0 ? (
        <div className="text-center py-16">
          <HiShieldCheck className="w-12 h-12 text-white/10 mx-auto mb-3" />
          <p className="text-white/40">No models match the current filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          {models.map((m, idx) => (
            <Link key={m.RepoId}
              to={`/models/${m.owner_slug || m.RepoId}/${m.Slug}`}
              className="flex items-start gap-4 bg-white/[0.02] border border-white/5 rounded-xl p-4 hover:border-violet-500/20 hover:bg-white/[0.04] transition-all">
              {/* Score badge */}
              <div className="flex-shrink-0 text-center">
                <div className={`w-12 h-12 rounded-xl ${scoreBg(m.quality_score)}/15 border border-${scoreColor(m.quality_score).replace('text-', '')}/20 flex items-center justify-center`}>
                  <span className={`text-lg font-bold ${scoreColor(m.quality_score)}`}>{m.quality_score}</span>
                </div>
                <span className={`text-[9px] font-medium ${scoreColor(m.quality_score)} mt-0.5 block`}>{scoreLabel(m.quality_score)}</span>
              </div>

              {/* Model info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-white truncate">{m.OriginalModelId || m.Name}</h3>
                  {m.Task && (
                    <span className="inline-flex px-2 py-0.5 rounded-md bg-violet-500/10 text-[10px] text-violet-300 font-medium flex-shrink-0">
                      {m.Task}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-white/30 mt-0.5">{m.owner_name || 'unknown'}</p>
                <ScoreBreakdown model={m} />
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-xs text-white/30 flex-shrink-0">
                <span className="inline-flex items-center gap-1"><HiDownload className="w-3 h-3" />{fmt(m.TotalDownloads)}</span>
                <span className="inline-flex items-center gap-1"><HiHeart className="w-3 h-3" />{fmt(m.TotalLikes)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
