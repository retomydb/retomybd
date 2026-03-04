import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { HiSearch, HiLightningBolt, HiHeart, HiAdjustments, HiPlay } from 'react-icons/hi';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

interface SpaceItem {
  RepoId: string;
  Name: string;
  Slug: string;
  Description: string | null;
  TotalLikes: number;
  TotalViews: number;
  Sdk: string | null;
  Hardware: string | null;
  SpaceStatus: string | null;
  owner_name: string | null;
  owner_slug: string | null;
  CreatedAt?: string;
}

const SDK_OPTIONS = ['gradio', 'streamlit', 'docker', 'static'];

export default function SpacesBrowsePage() {
  const [searchParams] = useSearchParams();
  const [spaces, setSpaces] = useState<SpaceItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [sdk, setSdk] = useState(searchParams.get('sdk') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'trending');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchSpaces();
  }, [search, sdk, sort, page]);

  async function fetchSpaces() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (sdk) params.set('sdk', sdk);
      params.set('sort', sort);
      params.set('page', String(page));
      params.set('page_size', '20');

      const token = localStorage.getItem('retomy_access_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/spaces?${params}`, { headers });
      const data = await res.json();
      setSpaces(data.spaces || []);
      setTotalCount(data.total_count || 0);
    } catch (err) {
      console.error('Failed to fetch spaces', err);
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(totalCount / 20);

  function sdkColor(s: string | null) {
    switch (s) {
      case 'gradio': return 'bg-orange-500/10 border-orange-500/20 text-orange-300';
      case 'streamlit': return 'bg-red-500/10 border-red-500/20 text-red-300';
      case 'docker': return 'bg-blue-500/10 border-blue-500/20 text-blue-300';
      default: return 'bg-white/5 border-white/10 text-white/40';
    }
  }

  function statusDot(s: string | null) {
    if (s === 'running') return 'bg-green-400';
    if (s === 'building') return 'bg-yellow-400 animate-pulse';
    if (s === 'error') return 'bg-red-400';
    return 'bg-white/20';
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/10 via-transparent to-cyan-600/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <HiLightningBolt className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">Spaces</h1>
          </div>
          <p className="text-white/50 text-sm max-w-2xl">
            Discover interactive ML demos and apps built with Gradio, Streamlit, or Docker.
          </p>

          <div className="mt-6 max-w-2xl relative">
            <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search spaces..."
              className="w-full pl-10 pr-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-white/40">{totalCount.toLocaleString()} spaces</p>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white/60 hover:bg-white/10 transition-all">
              <HiAdjustments className="w-4 h-4" /> Filters
            </button>
            <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }} className="bg-white/5 border border-white/10 rounded-lg text-sm text-white/70 px-3 py-1.5 focus:outline-none">
              <option value="trending">Trending</option>
              <option value="likes">Most Likes</option>
              <option value="created">Newest</option>
              <option value="updated">Recently Updated</option>
            </select>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5 mb-6">
            <div className="flex flex-wrap gap-2">
              {SDK_OPTIONS.map(s => (
                <button key={s} onClick={() => { setSdk(sdk === s ? '' : s); setPage(1); }} className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${sdk === s ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'}`}>
                  {s}
                </button>
              ))}
              {sdk && <button onClick={() => setSdk('')} className="text-xs text-white/30 hover:text-white/50 ml-2">Clear</button>}
            </div>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 animate-pulse h-48" />
            ))}
          </div>
        ) : spaces.length === 0 ? (
          <div className="text-center py-20">
            <HiLightningBolt className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <p className="text-white/40 text-lg mb-2">No spaces found</p>
            <p className="text-white/25 text-sm">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {spaces.map(space => (
              <Link
                key={space.RepoId}
                to={`/spaces/${space.owner_slug || space.RepoId}/${space.Slug}`}
                className="block bg-white/[0.03] border border-white/5 rounded-2xl p-5 hover:border-emerald-500/30 hover:bg-white/[0.05] transition-all group"
              >
                {/* Preview placeholder */}
                <div className="w-full h-32 bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl mb-4 flex items-center justify-center">
                  <HiPlay className="w-8 h-8 text-white/10 group-hover:text-emerald-400/30 transition-colors" />
                </div>

                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-white/30 text-xs">{space.owner_name || 'user'}</span>
                  <span className="text-white/15">/</span>
                  <span className="text-white font-semibold text-sm group-hover:text-emerald-300 transition-colors truncate">{space.Name}</span>
                </div>

                {space.Description && (
                  <p className="text-white/30 text-xs line-clamp-2 mb-3">{space.Description}</p>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {space.Sdk && <span className={`px-2 py-0.5 rounded border text-xs ${sdkColor(space.Sdk)}`}>{space.Sdk}</span>}
                    <span className={`w-2 h-2 rounded-full ${statusDot(space.SpaceStatus)}`} />
                  </div>
                  <span className="flex items-center gap-1 text-white/20 text-xs"><HiHeart className="w-3 h-3" />{space.TotalLikes}</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white/60 hover:bg-white/10 disabled:opacity-30 transition-all">Prev</button>
            <span className="px-3 py-1.5 text-sm text-white/40">Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white/60 hover:bg-white/10 disabled:opacity-30 transition-all">Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
