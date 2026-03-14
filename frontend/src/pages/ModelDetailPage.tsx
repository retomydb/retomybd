import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { HiCube, HiDownload, HiHeart, HiCode, HiDocumentText, HiChat, HiFolder, HiClock, HiTag, HiClipboardCopy, HiExternalLink, HiLightningBolt } from 'react-icons/hi';
import { FaGithub } from 'react-icons/fa';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ModelPlayground from '../components/ModelPlayground';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

interface ModelData {
  RepoId: string;
  Name: string;
  Slug: string;
  Description: string | null;
  Private: boolean;
  PricingModel: string;
  Price: number;
  LicenseType: string | null;
  TotalDownloads: number;
  TotalLikes: number;
  TotalViews: number;
  CreatedAt: string;
  UpdatedAt: string;
  LastCommitAt: string | null;
  owner_name: string | null;
  owner_slug: string | null;
  AvatarUrl: string | null;
  // Model metadata
  Framework: string | null;
  Task: string | null;
  Library: string | null;
  Architecture: string | null;
  ModelLanguage: string | null;
  BaseModel: string | null;
  ParameterCount: number | null;
  TensorType: string | null;
  PipelineTag: string | null;
  SafeTensors: boolean | null;
  InferenceEnabled: boolean | null;
  OriginalModelId: string | null;
  GithubRepoUrl?: string | null;
  // Rich content
  GithubReadme: string | null;
  UsageGuide: string | null;
  EvalResults: string | null;
  HostingType: string | null;
  tags: string[];
  liked_by_user: boolean;
}

interface RepoFile {
  FileId: string;
  Path: string;
  SizeBytes: number;
  ContentType: string | null;
  Sha256: string | null;
}

// ── Usage Snippets Sub-component ──────────────────────────────────────────────

const SNIPPET_LABELS: Record<string, string> = {
  pipeline: 'Pipeline',
  direct: 'Direct Loading',
  diffusers: 'Diffusers',
  sentence_transformers: 'Sentence Transformers',
  peft: 'PEFT / LoRA',
  gguf: 'GGUF (llama.cpp)',
  generic: 'General',
};

function UsageSnippets({ snippets }: { snippets: Record<string, string> }) {
  const entries = Object.entries(snippets);
  const [activeSnippet, setActiveSnippet] = useState(entries[0]?.[0] || '');

  if (entries.length === 0) return null;

  return (
    <div>
      {entries.length > 1 && (
        <div className="flex gap-1 mb-3 flex-wrap">
          {entries.map(([key]) => (
            <button
              key={key}
              onClick={() => setActiveSnippet(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                activeSnippet === key
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                  : 'bg-white/5 text-white/40 border border-transparent hover:bg-white/10 hover:text-white/60'
              }`}
            >
              {SNIPPET_LABELS[key] || key}
            </button>
          ))}
        </div>
      )}
      {entries.map(([key, code]) => (
        <div key={key} className={activeSnippet === key ? 'block' : 'hidden'}>
          <div className="relative group">
            <SyntaxHighlighter
              language="python"
              style={oneDark}
              customStyle={{
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '0.75rem',
                border: '1px solid rgba(255,255,255,0.05)',
                fontSize: '0.8rem',
                padding: '1rem',
              }}
            >
              {code}
            </SyntaxHighlighter>
            <button
              onClick={() => { navigator.clipboard.writeText(code); toast.success('Copied!'); }}
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/10 text-white/40 hover:text-white/80 opacity-0 group-hover:opacity-100 transition-all"
            >
              <HiClipboardCopy className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ModelDetailPage() {
  const { owner, slug } = useParams<{ owner: string; slug: string }>();
  const [model, setModel] = useState<ModelData | null>(null);
  const [files, setFiles] = useState<RepoFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'card' | 'inference' | 'files' | 'community'>('card');
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (owner && slug) fetchModel();
  }, [owner, slug]);

  // Display OriginalModelId when available, otherwise fallback to owner/name
  function displayOriginalId(orig?: string | null, ownerName?: string | null, name?: string) {
    return orig || `${ownerName || owner}/${name}`;
  }

  async function fetchModel() {
    setLoading(true);
    try {
      const token = localStorage.getItem('retomy_access_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/models/${owner}/${slug}`, { headers });
      if (!res.ok) throw new Error('Model not found');
      const data = await res.json();
      // normalize missing fields to avoid render crashes
      const normalized = {
        tags: [],
        TotalDownloads: 0,
        TotalLikes: 0,
        TotalViews: 0,
        ParameterCount: null,
        ...data,
      } as any;
      setModel(normalized);
      setLiked(Boolean(normalized.liked_by_user));

      // Fetch files
      const filesRes = await fetch(`${API_BASE}/repos/${data.RepoId}/tree?branch=main`, { headers });
      if (filesRes.ok) {
        const filesData = await filesRes.json();
        setFiles(filesData.files || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load model');
    } finally {
      setLoading(false);
    }
  }

  async function toggleLike() {
    if (!model) return;
    const token = localStorage.getItem('retomy_access_token');
    if (!token) { toast.error('Please log in to like models'); return; }
    try {
      const res = await fetch(`${API_BASE}/repos/${model.RepoId}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      setLiked(data.liked);
      setModel(prev => prev ? { ...prev, TotalLikes: prev.TotalLikes + (data.liked ? 1 : -1) } : prev);
    } catch { toast.error('Failed'); }
  }

  function formatSize(bytes: number) {
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
    if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
    return `${bytes} B`;
  }

  function formatNumber(n: number) {
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
    return String(n);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!model) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <HiCube className="w-16 h-16 text-white/10 mx-auto mb-4" />
          <p className="text-white/40 text-lg">Model not found</p>
          <Link to="/models" className="text-violet-400 text-sm mt-2 inline-block hover:underline">Browse models</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 via-transparent to-purple-600/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-white/30 mb-4">
            <Link to="/models" className="hover:text-white/60 transition-colors">Models</Link>
            <span>/</span>
            <span className="text-white/50">{displayOriginalId(model.OriginalModelId, model.owner_name, model.Name).split('/')[0]}</span>
            <span>/</span>
            <span className="text-white/70">{displayOriginalId(model.OriginalModelId, model.owner_name, model.Name).split('/')[1] || model.Name}</span>
          </div>

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <HiCube className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  {model.HostingType === 'huggingface' ? (
                    <a href={model.OriginalModelId ? `https://huggingface.co/${model.OriginalModelId}` : undefined} target="_blank" rel="noopener noreferrer">
                      <img src="https://huggingface.co/front/assets/huggingface_logo.svg" alt="Hugging Face" className="w-4 h-4 inline-block" />
                    </a>
                  ) : (
                    <a href={model.GithubRepoUrl || (model.OriginalModelId ? `https://github.com/${model.OriginalModelId}` : `https://github.com/${model.owner_slug || model.owner_name}/${model.Name}`)} target="_blank" rel="noopener noreferrer">
                      <FaGithub className="w-4 h-4 inline-block" />
                    </a>
                  )}
                  <span>{displayOriginalId(model.OriginalModelId, model.owner_name, model.Name)}</span>
                </h1>
                {model.Description && <p className="text-white/40 text-sm mt-1 max-w-2xl">{model.Description}</p>}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button onClick={toggleLike} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${liked ? 'bg-pink-500/20 border-pink-500/30 text-pink-300' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'}`}>
                <HiHeart className="w-4 h-4" /> {formatNumber(model.TotalLikes)}
              </button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-6 mt-4 text-sm text-white/30">
            <span className="flex items-center gap-1.5"><HiDownload className="w-4 h-4" />{formatNumber(model.TotalDownloads)} downloads</span>
            <span className="flex items-center gap-1.5"><HiClock className="w-4 h-4" />Updated {model.UpdatedAt ? new Date(model.UpdatedAt).toLocaleDateString() : '—'}</span>
            {model.LicenseType && <span className="flex items-center gap-1.5"><HiDocumentText className="w-4 h-4" />{model.LicenseType}</span>}
            {model.Private && <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-xs">Private</span>}
          </div>

          {/* Tags */}
          {(((model.tags && model.tags.length) || 0) > 0 || model.Task || model.Framework) && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {model.Task && <span className="px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs">{model.Task}</span>}
              {model.Framework && <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs">{model.Framework}</span>}
              {model.PipelineTag && <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">{model.PipelineTag}</span>}
              {(model.tags || []).map((tag: string) => (
                <span key={tag} className="px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            {(['card', 'inference', 'files', 'community'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium transition-all relative ${activeTab === tab ? 'text-violet-300' : 'text-white/40 hover:text-white/60'}`}
              >
                <span className="flex items-center gap-1.5">
                  {tab === 'card' && <HiDocumentText className="w-4 h-4" />}
                  {tab === 'inference' && <HiLightningBolt className="w-4 h-4" />}
                  {tab === 'files' && <HiFolder className="w-4 h-4" />}
                  {tab === 'community' && <HiChat className="w-4 h-4" />}
                  {tab === 'card' ? 'Model Card' : tab === 'inference' ? 'Try It' : tab === 'files' ? `Files (${files.length})` : 'Community'}
                </span>
                {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 to-purple-500" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main content */}
          <div className="lg:col-span-3">
            {activeTab === 'card' && (
              <div className="space-y-6">
                {/* Model Card / README */}
                <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                  <h2 className="text-lg font-semibold text-white mb-4">Model Card</h2>
                  <div className="prose prose-invert prose-sm max-w-none
                    prose-headings:text-white/90 prose-p:text-white/60 prose-a:text-violet-400
                    prose-strong:text-white/80 prose-code:text-violet-300 prose-code:bg-white/5
                    prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
                    prose-pre:bg-transparent prose-pre:p-0
                    prose-li:text-white/60 prose-blockquote:border-violet-500/30
                    prose-blockquote:text-white/50 prose-hr:border-white/10
                    prose-table:text-white/60 prose-th:text-white/80
                    prose-img:rounded-lg prose-img:max-w-full">
                    {model.GithubReadme ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({ className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || '');
                            const inline = !match && !className;
                            return !inline ? (
                              <SyntaxHighlighter
                                style={oneDark}
                                language={match ? match[1] : 'text'}
                                PreTag="div"
                                customStyle={{
                                  background: 'rgba(0,0,0,0.3)',
                                  borderRadius: '0.75rem',
                                  border: '1px solid rgba(255,255,255,0.05)',
                                  fontSize: '0.8rem',
                                }}
                              >
                                {String(children).replace(/\n$/, '')}
                              </SyntaxHighlighter>
                            ) : (
                              <code className={className} {...props}>{children}</code>
                            );
                          },
                          img({ src, alt, ...props }) {
                            let resolved = src || '';
                            // if image src is relative, resolve to raw.githubusercontent using repo info
                            const isRelative = resolved && !/^https?:\/\//i.test(resolved) && !resolved.startsWith('data:');
                            if (isRelative) {
                              const owner = model.GithubOwner || (model.OriginalModelId ? model.OriginalModelId.split('/')[0] : model.owner_slug);
                              const repo = model.GithubRepoName || (model.OriginalModelId ? model.OriginalModelId.split('/')[1] : model.Name);
                              const branch = model.GithubBranch || 'main';
                              if (owner && repo) {
                                const path = resolved.replace(/^\//, '');
                                resolved = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
                              }
                            }
                            return (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={resolved} alt={alt as string} className="max-w-full rounded-lg mx-auto my-4" {...props} />
                            );
                          },
                          p({ children }) {
                            return <p className="mb-4">{children}</p>;
                          },
                          a({ href, children, ...props }) {
                            const isExternal = href && /^https?:\/\//i.test(href as string);
                            return (
                              <a href={href} target={isExternal ? '_blank' : undefined} rel={isExternal ? 'noopener noreferrer' : undefined} {...props}>
                                {children}
                              </a>
                            );
                          }
                        }}
                      >
                        {model.GithubReadme}
                      </ReactMarkdown>
                    ) : (
                      <>
                        <p className="text-white/50">
                          {model.Description || 'No model card provided yet. The author can add a README.md to describe this model.'}
                        </p>
                        {model.Architecture && (
                          <div className="mt-4">
                            <h3 className="text-white/70 text-sm font-medium">Architecture</h3>
                            <p className="text-white/40 text-sm">{model.Architecture}</p>
                          </div>
                        )}
                        {model.BaseModel && (
                          <div className="mt-4">
                            <h3 className="text-white/70 text-sm font-medium">Base Model</h3>
                            <p className="text-white/40 text-sm">{model.BaseModel}</p>
                          </div>
                        )}
                        {model.ParameterCount && (
                          <div className="mt-4">
                            <h3 className="text-white/70 text-sm font-medium">Parameters</h3>
                            <p className="text-white/40 text-sm">{formatNumber(model.ParameterCount)}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Usage Snippets */}
                {model.UsageGuide && (() => {
                  try {
                    const snippets = JSON.parse(model.UsageGuide) as Record<string, string>;
                    const entries = Object.entries(snippets);
                    if (entries.length === 0) return null;
                    return (
                      <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                          <HiCode className="w-5 h-5 text-violet-400" /> Usage Examples
                        </h2>
                        <UsageSnippets snippets={snippets} />
                      </div>
                    );
                  } catch { return null; }
                })()}
              </div>
            )}

            {activeTab === 'inference' && (
              <ModelPlayground
                owner={owner || ''}
                slug={slug || ''}
                task={model.Task}
                pipelineTag={model.PipelineTag}
                originalModelId={model.OriginalModelId}
                hostingType={model.HostingType}
              />
            )}

            {activeTab === 'files' && (
              <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <span className="text-sm text-white/60">{files.length} files</span>
                </div>
                {files.length === 0 ? (
                  <div className="py-12 text-center">
                    <HiFolder className="w-10 h-10 text-white/10 mx-auto mb-2" />
                    <p className="text-white/30 text-sm">No files uploaded yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {files.map(f => (
                      <div key={f.FileId} className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <HiDocumentText className="w-4 h-4 text-white/20 shrink-0" />
                          <span className="text-sm text-white/70 truncate">{f.Path}</span>
                        </div>
                        <span className="text-xs text-white/30 shrink-0 ml-4">{formatSize(f.SizeBytes)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'community' && (
              <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-6 text-center">
                <HiChat className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-white/40 text-sm">Community discussions coming soon</p>
                <p className="text-white/25 text-xs mt-1">Share feedback, ask questions, and contribute</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Use this model */}
            <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <HiCode className="w-4 h-4 text-violet-400" /> Use this model
              </h3>
              {model.UsageGuide ? (() => {
                try {
                  const snippets = JSON.parse(model.UsageGuide) as Record<string, string>;
                  const first = snippets['pipeline'] || snippets['direct'] || Object.values(snippets)[0];
                  if (!first) return null;
                  return (
                    <div className="relative group">
                      <div className="bg-black/40 rounded-lg p-3 mb-3 overflow-x-auto">
                        <pre className="text-xs text-green-300 whitespace-pre font-mono">{first}</pre>
                      </div>
                      <button
                        onClick={() => { navigator.clipboard.writeText(first); toast.success('Copied!'); }}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/10 text-white/40 hover:text-white/80 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <HiClipboardCopy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                } catch { return null; }
              })() : model.Library ? (
                <div className="bg-black/30 rounded-lg p-3 mb-3">
                  <code className="text-xs text-green-300">
                    {model.Library === 'transformers'
                      ? 'from transformers import AutoModel\nmodel = AutoModel.from_pretrained("' + (model.OriginalModelId || (model.owner_slug || owner) + '/' + model.Slug) + '")'
                      : '# Install: pip install ' + model.Library + '\n# Load: ' + model.Library + '.load("' + (model.OriginalModelId || (model.owner_slug || owner) + '/' + model.Slug) + '")'}
                  </code>
                </div>
              ) : null}
              {model.HostingType === 'huggingface' && model.OriginalModelId ? (
                <a
                  href={`https://huggingface.co/${model.OriginalModelId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 mb-3 transition-colors"
                >
                  <HiExternalLink className="w-3.5 h-3.5" /> View on Hugging Face
                </a>
              ) : model.HostingType === 'github' ? (
                <a
                  href={model.GithubRepoUrl || (model.OriginalModelId ? `https://github.com/${model.OriginalModelId}` : `https://github.com/${model.owner_slug || model.owner_name}/${model.Name}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white/90 mb-3 transition-colors"
                >
                  <FaGithub className="w-3.5 h-3.5" /> View on GitHub
                </a>
              ) : null}
              {model.PricingModel === 'one_time' && model.Price > 0 ? (
                <button className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity">
                  Purchase — ${model.Price.toFixed(2)}
                </button>
              ) : (
                <button className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity">
                  Download Model
                </button>
              )}
              {model.HostingType === 'huggingface' && (
                <button
                  onClick={() => setActiveTab('inference')}
                  className="w-full mt-2 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <HiLightningBolt className="w-4 h-4" /> Try this Model
                </button>
              )}
            </div>

            {/* Model info */}
            <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Model Info</h3>
              <dl className="space-y-2.5 text-sm">
                {model.Task && <div className="flex justify-between"><dt className="text-white/40">Task</dt><dd className="text-white/70">{model.Task}</dd></div>}
                {model.Framework && <div className="flex justify-between"><dt className="text-white/40">Framework</dt><dd className="text-white/70">{model.Framework}</dd></div>}
                {model.Library && <div className="flex justify-between"><dt className="text-white/40">Library</dt><dd className="text-white/70">{model.Library}</dd></div>}
                {model.Architecture && <div className="flex justify-between"><dt className="text-white/40">Architecture</dt><dd className="text-white/70 text-right max-w-[160px] truncate" title={model.Architecture}>{model.Architecture}</dd></div>}
                {model.ModelLanguage && <div className="flex justify-between"><dt className="text-white/40">Language</dt><dd className="text-white/70">{model.ModelLanguage}</dd></div>}
                {model.BaseModel && <div className="flex justify-between"><dt className="text-white/40">Base Model</dt><dd className="text-white/70 text-right max-w-[160px] truncate" title={model.BaseModel}>{model.BaseModel}</dd></div>}
                {model.ParameterCount && <div className="flex justify-between"><dt className="text-white/40">Parameters</dt><dd className="text-white/70">{formatNumber(model.ParameterCount)}</dd></div>}
                {model.TensorType && <div className="flex justify-between"><dt className="text-white/40">Tensor Type</dt><dd className="text-white/70">{model.TensorType}</dd></div>}
                {model.SafeTensors && <div className="flex justify-between"><dt className="text-white/40">SafeTensors</dt><dd className="text-green-400 text-xs px-2 py-0.5 bg-green-500/10 rounded-full">Yes</dd></div>}
                {model.InferenceEnabled && <div className="flex justify-between"><dt className="text-white/40">Inference API</dt><dd className="text-cyan-400 text-xs px-2 py-0.5 bg-cyan-500/10 rounded-full">Enabled</dd></div>}
                <div className="flex justify-between"><dt className="text-white/40">Downloads</dt><dd className="text-white/70">{formatNumber(model.TotalDownloads)}</dd></div>
                <div className="flex justify-between"><dt className="text-white/40">Views</dt><dd className="text-white/70">{formatNumber(model.TotalViews)}</dd></div>
                {model.HostingType && <div className="flex justify-between"><dt className="text-white/40">Source</dt><dd className="text-white/70 capitalize">{model.HostingType}</dd></div>}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
