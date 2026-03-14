import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Treemap,
} from 'recharts';
import { HiTrendingUp, HiDatabase, HiDownload, HiEye, HiHeart } from 'react-icons/hi';

const API = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const COLORS = [
  '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#14b8a6', '#22c55e',
  '#eab308', '#f97316', '#ef4444', '#ec4899', '#a855f7', '#64748b',
];

function fmt(n: number | null | undefined) {
  if (n == null) return '0';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}

interface TrendsData {
  frameworks: { name: string; count: number }[];
  tasks: { name: string; count: number }[];
  libraries: { name: string; count: number }[];
  sources: { name: string; count: number }[];
  size_distribution: { bucket: string; count: number }[];
  licenses: { name: string; count: number }[];
  stats: {
    total_models: number;
    total_downloads: number;
    total_likes: number;
    total_views: number;
    unique_frameworks: number;
    unique_tasks: number;
    unique_libraries: number;
  };
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-white/40 font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-white/60 mb-4 uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1b2838] border border-white/10 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-white/60">{label || payload[0]?.name}</p>
      <p className="text-sm text-white font-semibold">{fmt(payload[0]?.value)}</p>
    </div>
  );
};

export default function ModelTrendsPage() {
  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/models/analytics/trends`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => {
        if (!d.frameworks || !d.tasks) throw new Error('Invalid response');
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-white/[0.03] rounded-xl animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => <div key={i} className="h-72 bg-white/[0.03] rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!data) return <div className="text-center py-24 text-white/30">Failed to load analytics</div>;

  const { stats } = data;
  const topFrameworks = data.frameworks.filter(f => f.name !== 'Unknown').slice(0, 12);
  const topTasks = data.tasks.filter(t => t.name !== 'Unknown').slice(0, 15);
  const topLibraries = data.libraries.filter(l => l.name !== 'Unknown').slice(0, 12);

  // Size distribution — order properly
  const sizeOrder = ['<1M', '1M-100M', '100M-1B', '1B-10B', '10B-100B', '100B+', 'Unknown'];
  const sortedSizes = [...data.size_distribution].sort(
    (a, b) => sizeOrder.indexOf(a.bucket) - sizeOrder.indexOf(b.bucket)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* ─── Summary Stats ────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={HiDatabase} label="Total Models" value={fmt(stats.total_models)} color="text-violet-400" />
        <StatCard icon={HiDownload} label="Total Downloads" value={fmt(stats.total_downloads)} color="text-blue-400" />
        <StatCard icon={HiHeart} label="Total Likes" value={fmt(stats.total_likes)} color="text-pink-400" />
        <StatCard icon={HiEye} label="Total Views" value={fmt(stats.total_views)} color="text-cyan-400" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-violet-400">{stats.unique_frameworks}</p>
          <p className="text-xs text-white/30 mt-1">Frameworks</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-cyan-400">{stats.unique_tasks}</p>
          <p className="text-xs text-white/30 mt-1">Task Types</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-amber-400">{stats.unique_libraries}</p>
          <p className="text-xs text-white/30 mt-1">Libraries</p>
        </div>
      </div>

      {/* ─── Charts Grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Framework Distribution */}
        <ChartCard title="Framework Distribution">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topFrameworks} layout="vertical" margin={{ left: 80 }}>
              <XAxis type="number" tick={{ fill: '#ffffff40', fontSize: 11 }} tickFormatter={fmt} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#ffffff60', fontSize: 11 }} width={75} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {topFrameworks.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Task Distribution */}
        <ChartCard title="Task Distribution">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topTasks} layout="vertical" margin={{ left: 140 }}>
              <XAxis type="number" tick={{ fill: '#ffffff40', fontSize: 11 }} tickFormatter={fmt} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#ffffff60', fontSize: 10 }} width={135} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {topTasks.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Source Distribution (Pie) */}
        <ChartCard title="Model Sources">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={data.sources} dataKey="count" nameKey="name" cx="50%" cy="50%"
                outerRadius={100} innerRadius={60} paddingAngle={2} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {data.sources.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Parameter Size Distribution */}
        <ChartCard title="Parameter Size Distribution">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sortedSizes} margin={{ left: 10 }}>
              <XAxis dataKey="bucket" tick={{ fill: '#ffffff50', fontSize: 11 }} />
              <YAxis tick={{ fill: '#ffffff40', fontSize: 11 }} tickFormatter={fmt} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {sortedSizes.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Library Distribution */}
        <ChartCard title="Library Distribution">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topLibraries} layout="vertical" margin={{ left: 120 }}>
              <XAxis type="number" tick={{ fill: '#ffffff40', fontSize: 11 }} tickFormatter={fmt} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#ffffff60', fontSize: 11 }} width={115} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {topLibraries.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* License Distribution */}
        <ChartCard title="License Distribution">
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
            {data.licenses.filter(l => l.name !== 'Unknown').slice(0, 15).map((l, i) => {
              const maxCount = data.licenses[0]?.count || 1;
              const pct = (l.count / maxCount) * 100;
              return (
                <div key={l.name} className="flex items-center gap-3">
                  <span className="text-xs text-white/50 w-36 truncate flex-shrink-0">{l.name}</span>
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                  </div>
                  <span className="text-xs text-white/30 w-14 text-right">{fmt(l.count)}</span>
                </div>
              );
            })}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
