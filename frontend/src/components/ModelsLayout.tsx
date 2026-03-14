import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  HiSearch, HiChartBar, HiScale, HiTrendingUp,
  HiCollection, HiCode, HiShieldCheck, HiCube, HiLightningBolt,
} from 'react-icons/hi';

const tabs = [
  { to: '/models',              label: 'Search',       icon: HiSearch,      exact: true },
  { to: '/models/runnable',     label: 'Runnable',     icon: HiLightningBolt },
  { to: '/models/leaderboards', label: 'Leaderboards', icon: HiChartBar },
  { to: '/models/compare',      label: 'Compare',      icon: HiScale },
  { to: '/models/trends',       label: 'Trends',       icon: HiTrendingUp },
  { to: '/models/collections',  label: 'Collections',  icon: HiCollection },
  { to: '/models/api',          label: 'API',          icon: HiCode },
  { to: '/models/quality',      label: 'Quality',      icon: HiShieldCheck },
];

export default function ModelsLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen">
      {/* ─── Hub Header ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 via-transparent to-cyan-600/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-0">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <HiCube className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Models Hub</h1>
              <p className="text-xs text-white/40 mt-0.5">Search, compare, and analyze ML models across platforms</p>
            </div>
          </div>

          {/* ─── Tab Navigation ─────────────────────────────────────── */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none -mb-px">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = tab.exact
                ? location.pathname === tab.to
                : location.pathname.startsWith(tab.to);
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end={tab.exact}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                    isActive
                      ? 'border-violet-500 text-violet-300 bg-violet-500/5'
                      : 'border-transparent text-white/40 hover:text-white/70 hover:border-white/10'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </NavLink>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Page Content (nested route) ─────────────────────────────── */}
      <Outlet />
    </div>
  );
}
