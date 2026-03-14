import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  HiChartBar, HiDownload, HiHeart, HiStar, HiTrendingUp, HiCube,
} from 'react-icons/hi';

const API = import.meta.env.VITE_API_BASE_URL || '/api/v1';

interface LeaderModel {
  rank: number;
  RepoId: string;
  Name: string;
  Slug: string;
  Description: string | null;
  TotalDownloads: number;
  TotalLikes: number;
  TotalViews: number;
  Trending: number;
  Framework: string | null;
  Task: string | null;
  Library: string | null;
  ParameterCount: number | null;
  OriginalModelId: string | null;
  GithubStars: number | null;
  owner_name: string | null;
  owner_slug: string | null;
}

const METRICS = [
  { key: 'downloads', label: 'Downloads', icon: HiDownload, color: 'text-blue-400' },
  { key: 'likes',     label: 'Likes',     icon: HiHeart, color: 'text-pink-400' },
  { key: 'trending',  label: 'Trending',  icon: HiTrendingUp, color: 'text-amber-400' },
  { key: 'stars',     label: 'Stars',     icon: HiStar, color: 'text-yellow-400' },
  { key: 'params',    label: 'Largest',   icon: HiCube, color: 'text-violet-400' },
];

const TASKS = [
  '', 'text-generation', 'text-classification', 'image-classification',
  'object-detection', 'text-to-image', 'question-answering', 'summarization',
  'automatic-speech-recognition', 'reinforcement-learning',
];

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}

export default function ModelLeaderboardsPage() {
  const [metric, setMetric] = useState('downloads');
  const [task, setTask] = useState('');
  const [models, setModels] = useState<LeaderModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ metric, limit: '50' });
    if (task) p.set('task', task);
    fetch(`${API}/models/analytics/leaderboards?${p}`)
      .then(r => r.json())
      .then(d => { setModels(d.leaderboard || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [metric, task]);

  const metricConfig = METRICS.find(m => m.key === metric) || METRICS[0];
  const MetricIcon = metricConfig.icon;

  function metricValue(m: LeaderModel) {
    switch (metric) {
      case 'downloads': return m.TotalDownloads;
      case 'likes': return m.TotalLikes;
      case 'trending': return m.Trending;
      case 'stars': return m.GithubStars || 0;
      case 'params': return m.ParameterCount || 0;
      default: return m.TotalDownloads;
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          {METRICS.map(m => {
            const Icon = m.icon;
            return (
              <button key={m.key} onClick={() => setMetric(m.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  metric === m.key
                    ? 'bg-violet-500/15 border border-violet-500/30 text-violet-300'
                    : 'bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10'
                }`}>
                <Icon className="w-4 h-4" /> {m.label}
              </button>
            );
          })}
        </div>
        <select value={task} onChange={e => setTask(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl text-sm text-white/60 px-3 py-2 focus:outline-none cursor-pointer">
          <option value="">All Tasks</option>
          {TASKS.filter(Boolean).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Leaderboard table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-14 bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs text-white/30 font-semibold uppercase tracking-wider border-b border-white/5">
            <span className="col-span-1">#</span>
            <span className="col-span-5">Model</span>
            <span className="col-span-2">Task</span>
            <span className="col-span-1 text-right">Params</span>
            <span className="col-span-1 text-right">
              <MetricIcon className={`w-3.5 h-3.5 inline ${metricConfig.color}`} />
            </span>
            <span className="col-span-2 text-right">{metricConfig.label}</span>
          </div>

          {models.map((m, idx) => {
            const val = metricValue(m);
            const maxVal = metricValue(models[0]) || 1;
            const barWidth = Math.max((val / maxVal) * 100, 2);
            return (
              <Link key={m.RepoId}
                to={`/models/${m.owner_slug || m.RepoId}/${m.Slug}`}
                className={`grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-white/[0.04] transition-colors border-b border-white/[0.03] ${
                  idx < 3 ? 'bg-gradient-to-r from-amber-500/[0.03] to-transparent' : ''
                }`}>
                {/* Rank */}
                <span className="col-span-1">
                  {idx < 3 ? (
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? 'bg-amber-500/20 text-amber-400' :
                      idx === 1 ? 'bg-gray-400/20 text-gray-300' :
                      'bg-orange-600/20 text-orange-400'
                    }`}>{m.rank}</span>
                  ) : (
                    <span className="text-sm text-white/25 font-mono">{m.rank}</span>
                  )}
                </span>

                {/* Model name */}
                <div className="col-span-5 min-w-0">
                  <p className="text-sm text-white font-medium truncate">
                    {m.OriginalModelId || m.Name}
                  </p>
                  <p className="text-[10px] text-white/25 truncate">{m.owner_name || 'unknown'}</p>
                </div>

                {/* Task */}
                <div className="col-span-2">
                  {m.Task && (
                    <span className="inline-flex px-2 py-0.5 rounded-md bg-violet-500/10 text-[10px] text-violet-300 font-medium truncate">
                      {m.Task}
                    </span>
                  )}
                </div>

                {/* Params */}
                <span className="col-span-1 text-right text-xs text-white/30">
                  {m.ParameterCount ? fmt(m.ParameterCount) : '—'}
                </span>

                {/* Bar */}
                <div className="col-span-1">
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500`}
                      style={{ width: `${barWidth}%` }} />
                  </div>
                </div>

                {/* Value */}
                <span className={`col-span-2 text-right text-sm font-semibold ${metricConfig.color}`}>
                  {fmt(val)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
