import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  HiCollection, HiCube, HiDownload, HiHeart, HiStar, HiSparkles,
  HiLightningBolt, HiChip, HiPhotograph, HiChat, HiTranslate,
} from 'react-icons/hi';

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
  ParameterCount: number | null;
  OriginalModelId: string | null;
  GithubStars: number | null;
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

function fmtParams(n: number | null) {
  if (!n) return null;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
  return null;
}

interface Collection {
  id: string;
  title: string;
  description: string;
  icon: any;
  gradient: string;
  query: string;
}

const CURATED: Collection[] = [
  {
    id: 'text-gen-top', title: 'Top Text Generation', description: 'Best LLMs and text generation models',
    icon: HiChat, gradient: 'from-violet-500 to-purple-600',
    query: 'task=text-generation&sort=downloads&page_size=12',
  },
  {
    id: 'image-gen', title: 'Image Generation', description: 'Text-to-image and image synthesis models',
    icon: HiPhotograph, gradient: 'from-pink-500 to-rose-600',
    query: 'task=text-to-image&sort=downloads&page_size=12',
  },
  {
    id: 'speech', title: 'Speech & Audio', description: 'ASR, TTS, and audio classification models',
    icon: HiSparkles, gradient: 'from-cyan-500 to-blue-600',
    query: 'task=automatic-speech-recognition&sort=downloads&page_size=12',
  },
  {
    id: 'vision', title: 'Computer Vision', description: 'Image classification, detection, and segmentation',
    icon: HiPhotograph, gradient: 'from-amber-500 to-orange-600',
    query: 'task=image-classification&sort=downloads&page_size=12',
  },
  {
    id: 'translation', title: 'Translation Models', description: 'Neural machine translation across languages',
    icon: HiTranslate, gradient: 'from-green-500 to-emerald-600',
    query: 'task=translation&sort=downloads&page_size=12',
  },
  {
    id: 'transformers', title: 'Transformers Library', description: 'Most popular HuggingFace Transformers models',
    icon: HiLightningBolt, gradient: 'from-indigo-500 to-blue-600',
    query: 'library=transformers&sort=downloads&page_size=12',
  },
  {
    id: 'largest', title: 'Largest Models', description: 'The biggest parameter count models in the index',
    icon: HiChip, gradient: 'from-red-500 to-pink-600',
    query: 'sort=downloads&page_size=12', // Will use leaderboard endpoint with params metric
  },
  {
    id: 'trending', title: 'Trending Now', description: 'Currently hot and trending models',
    icon: HiLightningBolt, gradient: 'from-yellow-500 to-amber-600',
    query: 'sort=trending&page_size=12',
  },
];

function ModelMiniCard({ model }: { model: ModelItem }) {
  return (
    <Link
      to={`/models/${model.owner_slug || model.RepoId}/${model.Slug}`}
      className="group bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 hover:border-violet-500/30 hover:bg-white/[0.05] transition-all"
    >
      <h4 className="text-xs font-medium text-white group-hover:text-violet-300 truncate transition-colors">
        {model.OriginalModelId || model.Name}
      </h4>
      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-white/25">
        {model.Task && <span className="text-violet-400/60">{model.Task}</span>}
        {model.ParameterCount != null && fmtParams(model.ParameterCount) && (
          <span>{fmtParams(model.ParameterCount)}</span>
        )}
        <span className="inline-flex items-center gap-0.5"><HiDownload className="w-2.5 h-2.5" />{fmt(model.TotalDownloads)}</span>
      </div>
    </Link>
  );
}

function CollectionSection({ collection }: { collection: Collection }) {
  const [models, setModels] = useState<ModelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const Icon = collection.icon;

  useEffect(() => {
    fetch(`${API}/models?${collection.query}`)
      .then(r => r.json())
      .then(d => { setModels(d.models || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [collection.query]);

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${collection.gradient} flex items-center justify-center`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">{collection.title}</h3>
          <p className="text-[11px] text-white/30">{collection.description}</p>
        </div>
        <Link to={`/models?${collection.query}`}
          className="ml-auto text-xs text-violet-400 hover:text-violet-300 transition-colors">
          View all →
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-white/[0.03] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {models.slice(0, 12).map(m => <ModelMiniCard key={m.RepoId} model={m} />)}
        </div>
      )}
    </div>
  );
}

export default function ModelCollectionsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center gap-2 mb-6">
        <HiCollection className="w-5 h-5 text-violet-400" />
        <h2 className="text-lg font-semibold text-white">Curated Collections</h2>
        <span className="text-xs text-white/20 ml-2">Handpicked model categories across 970k+ models</span>
      </div>

      {CURATED.map(c => <CollectionSection key={c.id} collection={c} />)}
    </div>
  );
}
