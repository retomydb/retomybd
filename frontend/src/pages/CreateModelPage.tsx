import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { modelsApi, reposApi, getApiError } from '../services/api';
import toast from 'react-hot-toast';
import {
  HiCube,
  HiUpload,
  HiX,
  HiDocumentText,
  HiCheck,
  HiLockClosed,
  HiGlobeAlt,
  HiArrowLeft,
  HiInformationCircle,
  HiExternalLink,
  HiStar,
  HiCode,
} from 'react-icons/hi';

/* ── GitHub icon (inline SVG) ─────────────────────────────────────────────── */
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

/* ── Constants ────────────────────────────────────────────────────────────── */

const TASK_OPTIONS = [
  { value: 'text-generation', label: 'Text Generation' },
  { value: 'text-classification', label: 'Text Classification' },
  { value: 'token-classification', label: 'Token Classification' },
  { value: 'question-answering', label: 'Question Answering' },
  { value: 'summarization', label: 'Summarization' },
  { value: 'translation', label: 'Translation' },
  { value: 'fill-mask', label: 'Fill Mask' },
  { value: 'image-classification', label: 'Image Classification' },
  { value: 'object-detection', label: 'Object Detection' },
  { value: 'image-segmentation', label: 'Image Segmentation' },
  { value: 'text-to-image', label: 'Text to Image' },
  { value: 'audio-classification', label: 'Audio Classification' },
  { value: 'automatic-speech-recognition', label: 'Automatic Speech Recognition' },
  { value: 'reinforcement-learning', label: 'Reinforcement Learning' },
];

const FRAMEWORK_OPTIONS = [
  { value: 'pytorch', label: 'PyTorch' },
  { value: 'tensorflow', label: 'TensorFlow' },
  { value: 'jax', label: 'JAX' },
  { value: 'onnx', label: 'ONNX' },
  { value: 'safetensors', label: 'Safetensors' },
  { value: 'gguf', label: 'GGUF' },
];

const LIBRARY_OPTIONS = [
  { value: 'transformers', label: 'Transformers' },
  { value: 'diffusers', label: 'Diffusers' },
  { value: 'sentence-transformers', label: 'Sentence Transformers' },
  { value: 'timm', label: 'timm' },
  { value: 'spacy', label: 'spaCy' },
  { value: 'fastai', label: 'fastai' },
  { value: 'stable-baselines3', label: 'Stable Baselines3' },
  { value: 'keras', label: 'Keras' },
  { value: 'sklearn', label: 'scikit-learn' },
];

const LICENSE_OPTIONS = [
  { value: 'mit', label: 'MIT' },
  { value: 'apache-2.0', label: 'Apache 2.0' },
  { value: 'gpl-3.0', label: 'GPL 3.0' },
  { value: 'cc-by-4.0', label: 'CC BY 4.0' },
  { value: 'cc-by-sa-4.0', label: 'CC BY-SA 4.0' },
  { value: 'cc-by-nc-4.0', label: 'CC BY-NC 4.0' },
  { value: 'openrail', label: 'OpenRAIL' },
  { value: 'bigscience-bloom-rail-1.0', label: 'BigScience BLOOM RAIL 1.0' },
  { value: 'llama2', label: 'Llama 2 Community' },
  { value: 'other', label: 'Other' },
];

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: 'Chinese' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ar', label: 'Arabic' },
  { value: 'hi', label: 'Hindi' },
  { value: 'multilingual', label: 'Multilingual' },
];

interface PendingFile {
  file: File;
  path: string;
  id: string;
}

interface GithubPreviewData {
  owner: string;
  repo: string;
  description: string | null;
  stars: number;
  topics: string[];
  language: string | null;
  default_branch: string;
  html_url: string;
}

/* ── Component ────────────────────────────────────────────────────────────── */

export default function CreateModelPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Step 0 – hosting choice */
  const [hostingType, setHostingType] = useState<'github' | 'hosted' | null>(null);

  /* Step 1 – basic info */
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [licenseType, setLicenseType] = useState('');
  const [modelCategory, setModelCategory] = useState('');
  const [availableModelCategories, setAvailableModelCategories] = useState<string[]>([]);

  /* Step 2 – model metadata */
  const [framework, setFramework] = useState('');
  const [task, setTask] = useState('');
  const [library, setLibrary] = useState('');
  const [language, setLanguage] = useState('');

  /* Step 3 – GitHub URL or files */
  const [githubUrl, setGithubUrl] = useState('');
  const [ghPreview, setGhPreview] = useState<GithubPreviewData | null>(null);
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

  /* Step 4 – usage guide */
  const [usageGuide, setUsageGuide] = useState('');

  /* UI */
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, 'pending' | 'uploading' | 'done' | 'error'>>({});

  /* ── GitHub preview fetch ──────────────────────────────────────────────── */

  async function fetchGhPreview() {
    if (!githubUrl.trim()) return;
    setFetchingPreview(true);
    try {
      const { data } = await modelsApi.githubPreview(githubUrl.trim());
      setGhPreview(data);
      if (!description && data.description) setDescription(data.description);
    } catch (err: any) {
      toast.error(getApiError(err, 'Could not fetch GitHub repo info'));
      setGhPreview(null);
    } finally {
      setFetchingPreview(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const { data } = await modelsApi.filterOptions();
        const cats = data.categories || data.options?.categories || [];
        if (Array.isArray(cats) && cats.length > 0) {
          setAvailableModelCategories(cats.map((c: any) => c.name || c.display_name || c.id || String(c)));
        }
      } catch {
        // ignore errors
      }
    })();
  }, []);

  /* ── File handling ─────────────────────────────────────────────────────── */

  const handleFilesSelected = useCallback((files: FileList | null) => {
    if (!files) return;
    const newFiles: PendingFile[] = Array.from(files).map((f) => ({
      file: f,
      path: f.name,
      id: crypto.randomUUID(),
    }));
    setPendingFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFilesSelected(e.dataTransfer.files);
    },
    [handleFilesSelected],
  );

  /* ── Validation ────────────────────────────────────────────────────────── */

  const step1Valid = name.trim().length >= 2;
  const step3Valid = hostingType === 'github' ? githubUrl.trim().length > 0 : true;

  /* ── Submit ────────────────────────────────────────────────────────────── */

  async function handleSubmit() {
    if (!step1Valid) {
      toast.error('Model name must be at least 2 characters');
      setStep(1);
      return;
    }

    setSubmitting(true);
    try {
      const params: Record<string, any> = {
        name: name.trim(),
        hosting_type: hostingType || 'hosted',
      };
      if (modelCategory) params.category = modelCategory;
      if (description.trim()) params.description = description.trim();
      if (isPrivate) params.private = true;
      if (licenseType) params.license_type = licenseType;
      if (framework) params.framework = framework;
      if (task) params.task = task;
      if (library) params.library = library;
      if (language) params.language = language;
      if (hostingType === 'github' && githubUrl.trim()) params.github_url = githubUrl.trim();
      if (usageGuide.trim()) params.usage_guide = usageGuide.trim();

      const { data } = await modelsApi.create(params);
      const repoId = data.repo_id;
      const slug = data.slug;

      toast.success('Model repository created!');

      /* upload files (hosted only) */
      if (hostingType === 'hosted' && pendingFiles.length > 0) {
        const progressMap: Record<string, 'pending' | 'uploading' | 'done' | 'error'> = {};
        pendingFiles.forEach((f) => (progressMap[f.id] = 'pending'));
        setUploadProgress({ ...progressMap });

        for (const pf of pendingFiles) {
          try {
            progressMap[pf.id] = 'uploading';
            setUploadProgress({ ...progressMap });
            await reposApi.uploadFile(repoId, pf.file, pf.path, `Add ${pf.path}`);
            progressMap[pf.id] = 'done';
            setUploadProgress({ ...progressMap });
          } catch {
            progressMap[pf.id] = 'error';
            setUploadProgress({ ...progressMap });
            toast.error(`Failed to upload ${pf.path}`);
          }
        }
        const uploaded = Object.values(progressMap).filter((s) => s === 'done').length;
        if (uploaded > 0) toast.success(`${uploaded} file${uploaded > 1 ? 's' : ''} uploaded`);
      }

      const ownerSlug = user?.slug || user?.user_id || '';
      navigate(`/models/${ownerSlug}/${slug}`);
    } catch (err: any) {
      toast.error(getApiError(err, 'Failed to create model'));
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Helpers ───────────────────────────────────────────────────────────── */

  function fmtSize(bytes: number) {
    if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
    if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  }

  const stepLabels = hostingType
    ? [
        { n: 1, label: 'Basic Info' },
        { n: 2, label: 'Metadata' },
        { n: 3, label: hostingType === 'github' ? 'GitHub Repo' : 'Files' },
        { n: 4, label: 'Usage Guide' },
      ]
    : [];

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 via-transparent to-cyan-600/5" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-6">
          <button
            onClick={() => (step === 0 ? navigate('/models') : setStep(step > 1 ? step - 1 : 0))}
            className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors mb-4"
          >
            <HiArrowLeft className="w-4 h-4" /> {step === 0 ? 'Back to Models' : 'Back'}
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <HiCube className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Create a Model</h1>
          </div>
          <p className="text-white/40 text-sm">
            {step === 0
              ? 'Choose how you want to host your model.'
              : 'Create a new model repository to share your ML model with the community.'}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">

        {/* ═══════════ STEP 0 — Hosting Choice ═══════════════════════════ */}
        {step === 0 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white/80 text-center mb-2">
              How would you like to host your model?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* GitHub card */}
              <button
                onClick={() => { setHostingType('github'); setStep(1); }}
                className="group relative text-left p-6 rounded-2xl border-2 border-white/10 bg-white/[0.03] hover:border-violet-500/30 hover:bg-white/[0.05] transition-all hover:scale-[1.02]"
              >
                <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/20">
                  <span className="text-xs font-bold text-emerald-400">FREE</span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 group-hover:border-violet-500/30 transition-colors">
                  <GitHubIcon className="w-6 h-6 text-white/70" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1.5">Link from GitHub</h3>
                <p className="text-sm text-white/40 leading-relaxed">
                  Connect an existing GitHub repository. We'll pull the README, stars, and topics automatically. Your code stays on GitHub.
                </p>
                <ul className="mt-4 space-y-1.5 text-xs text-white/35">
                  <li className="flex items-center gap-2"><HiCheck className="w-3.5 h-3.5 text-emerald-400/70" /> Auto-sync README &amp; stars</li>
                  <li className="flex items-center gap-2"><HiCheck className="w-3.5 h-3.5 text-emerald-400/70" /> No storage limits</li>
                  <li className="flex items-center gap-2"><HiCheck className="w-3.5 h-3.5 text-emerald-400/70" /> Links directly to your repo</li>
                </ul>
              </button>

              {/* Hosted card */}
              <button
                onClick={() => { setHostingType('hosted'); setStep(1); }}
                className="group relative text-left p-6 rounded-2xl border-2 border-white/10 bg-white/[0.03] hover:border-violet-500/30 hover:bg-white/[0.05] transition-all hover:scale-[1.02]"
              >
                <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-violet-500/15 border border-violet-500/20">
                  <span className="text-xs font-bold text-violet-400">$10/mo</span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 group-hover:border-violet-500/30 transition-colors">
                  <HiCube className="w-6 h-6 text-violet-400/70" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1.5">Host on retomY</h3>
                <p className="text-sm text-white/40 leading-relaxed">
                  Upload model weights, configs, and files directly to retomY. Full version control with commit history and branching.
                </p>
                <ul className="mt-4 space-y-1.5 text-xs text-white/35">
                  <li className="flex items-center gap-2"><HiCheck className="w-3.5 h-3.5 text-violet-400/70" /> Git-based version control</li>
                  <li className="flex items-center gap-2"><HiCheck className="w-3.5 h-3.5 text-violet-400/70" /> Direct file uploads</li>
                  <li className="flex items-center gap-2"><HiCheck className="w-3.5 h-3.5 text-violet-400/70" /> Full commit history</li>
                </ul>
              </button>
            </div>
          </div>
        )}

        {/* Step indicator bar (Steps 1-4) */}
        {step >= 1 && (
          <div className="flex items-center gap-2 mb-8">
            {stepLabels.map(({ n, label }) => (
              <button
                key={n}
                onClick={() => setStep(n)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  step === n
                    ? 'bg-violet-500/20 border border-violet-500/40 text-violet-300'
                    : n < step
                    ? 'bg-white/5 border border-white/10 text-emerald-400'
                    : 'bg-white/[0.03] border border-white/5 text-white/30'
                }`}
              >
                {n < step ? (
                  <HiCheck className="w-4 h-4" />
                ) : (
                  <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-xs">{n}</span>
                )}
                {label}
              </button>
            ))}
          </div>
        )}

        {/* ═══════════ STEP 1 — Basic Info ═══════════════════════════════ */}
        {step === 1 && (
          <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Model Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. my-text-classifier"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
              />
              <p className="text-xs text-white/30 mt-1.5">
                This will appear as{' '}
                <span className="text-white/50">
                  {user?.slug || user?.display_name || 'you'}/
                  {name ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : '...'}
                </span>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe what this model does, its architecture, and how it was trained..."
                rows={4}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all resize-none"
              />
            </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Model Category</label>
                  <input
                    list="model-categories"
                    value={modelCategory}
                    onChange={(e) => setModelCategory(e.target.value)}
                    placeholder="Select or type a category"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
                  />
                  <datalist id="model-categories">
                    {availableModelCategories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">License</label>
              <select
                value={licenseType}
                onChange={(e) => setLicenseType(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white/70 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
              >
                <option value="">Select a license (optional)</option>
                {LICENSE_OPTIONS.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Visibility</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsPrivate(false)}
                  className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                    !isPrivate
                      ? 'bg-violet-500/10 border-violet-500/40 text-violet-300'
                      : 'bg-white/[0.03] border-white/10 text-white/40 hover:border-white/20'
                  }`}
                >
                  <HiGlobeAlt className="w-5 h-5" />
                  <div className="text-left">
                    <div className="text-sm font-medium">Public</div>
                    <div className="text-xs opacity-60">Anyone can see this model</div>
                  </div>
                </button>
                <button
                  onClick={() => setIsPrivate(true)}
                  className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                    isPrivate
                      ? 'bg-violet-500/10 border-violet-500/40 text-violet-300'
                      : 'bg-white/[0.03] border-white/10 text-white/40 hover:border-white/20'
                  }`}
                >
                  <HiLockClosed className="w-5 h-5" />
                  <div className="text-left">
                    <div className="text-sm font-medium">Private</div>
                    <div className="text-xs opacity-60">Only you can access</div>
                  </div>
                </button>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(0)} className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-all">
                Back
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!step1Valid}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-medium hover:from-violet-500 hover:to-purple-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Next: Metadata
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP 2 — Metadata ═════════════════════════════════ */}
        {step === 2 && (
          <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-6 space-y-6">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-violet-500/5 border border-violet-500/10">
              <HiInformationCircle className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
              <p className="text-xs text-violet-300/80">
                All metadata fields are optional. You can set them now or update later from the model page.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Task</label>
                <select value={task} onChange={(e) => setTask(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white/70 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all">
                  <option value="">Select task type</option>
                  {TASK_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Framework</label>
                <select value={framework} onChange={(e) => setFramework(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white/70 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all">
                  <option value="">Select framework</option>
                  {FRAMEWORK_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Library</label>
                <select value={library} onChange={(e) => setLibrary(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white/70 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all">
                  <option value="">Select library</option>
                  {LIBRARY_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Language</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white/70 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all">
                  <option value="">Select language</option>
                  {LANGUAGE_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(1)} className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-all">Back</button>
              <button onClick={() => setStep(3)} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-medium hover:from-violet-500 hover:to-purple-500 transition-all">
                Next: {hostingType === 'github' ? 'GitHub Repo' : 'Upload Files'}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP 3a — GitHub URL ══════════════════════════════ */}
        {step === 3 && hostingType === 'github' && (
          <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-6 space-y-6">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-violet-500/5 border border-violet-500/10">
              <GitHubIcon className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
              <p className="text-xs text-violet-300/80">
                Paste the URL to your GitHub repository. We'll auto-fetch the README, description, stars, and topics.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                GitHub Repository URL <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
                />
                <button
                  onClick={fetchGhPreview}
                  disabled={!githubUrl.trim() || fetchingPreview}
                  className="px-4 py-3 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-medium hover:bg-violet-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                >
                  {fetchingPreview ? (
                    <div className="w-4 h-4 border-2 border-violet-400/40 border-t-violet-400 rounded-full animate-spin" />
                  ) : (
                    'Fetch Info'
                  )}
                </button>
              </div>
            </div>

            {/* Preview card */}
            {ghPreview && (
              <div className="bg-white/[0.02] border border-white/10 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitHubIcon className="w-5 h-5 text-white/50" />
                    <a href={ghPreview.html_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-violet-300 hover:text-violet-200 flex items-center gap-1">
                      {ghPreview.owner}/{ghPreview.repo} <HiExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <div className="flex items-center gap-1 text-yellow-400/80 text-sm">
                    <HiStar className="w-4 h-4" /> {ghPreview.stars.toLocaleString()}
                  </div>
                </div>
                {ghPreview.description && <p className="text-sm text-white/50">{ghPreview.description}</p>}
                {ghPreview.topics.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {ghPreview.topics.map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">{t}</span>
                    ))}
                  </div>
                )}
                {ghPreview.language && (
                  <p className="text-xs text-white/30">Primary language: <span className="text-white/50">{ghPreview.language}</span></p>
                )}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(2)} className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-all">Back</button>
              <button
                onClick={() => setStep(4)}
                disabled={!step3Valid}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-medium hover:from-violet-500 hover:to-purple-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Next: Usage Guide
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP 3b — File Upload (hosted) ═══════════════════ */}
        {step === 3 && hostingType === 'hosted' && (
          <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-6 space-y-6">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-violet-500/5 border border-violet-500/10">
              <HiInformationCircle className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
              <p className="text-xs text-violet-300/80">
                Upload your model files — weights, config, tokenizer, README, etc. You can also upload files
                later from the model detail page.
              </p>
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/10 hover:border-violet-500/30 rounded-2xl p-10 text-center cursor-pointer transition-all hover:bg-white/[0.02] group"
            >
              <HiUpload className="w-10 h-10 text-white/15 mx-auto mb-3 group-hover:text-violet-400/40 transition-colors" />
              <p className="text-sm text-white/40 group-hover:text-white/60 transition-colors">
                Drag &amp; drop files here, or <span className="text-violet-400">browse</span>
              </p>
              <p className="text-xs text-white/20 mt-1">Model weights, config files, tokenizer, README — any file type</p>
              <input ref={fileInputRef} type="file" multiple onChange={(e) => handleFilesSelected(e.target.files)} className="hidden" />
            </div>

            {pendingFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-white/40 font-medium">{pendingFiles.length} file{pendingFiles.length > 1 ? 's' : ''} selected</p>
                {pendingFiles.map((pf) => {
                  const st = uploadProgress[pf.id];
                  return (
                    <div key={pf.id} className="flex items-center gap-3 px-4 py-2.5 bg-white/[0.03] border border-white/5 rounded-xl">
                      <HiDocumentText className="w-4 h-4 text-white/25 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/70 truncate">{pf.path}</p>
                        <p className="text-xs text-white/25">{fmtSize(pf.file.size)}</p>
                      </div>
                      {st === 'uploading' && <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />}
                      {st === 'done' && <HiCheck className="w-4 h-4 text-emerald-400" />}
                      {st === 'error' && <span className="text-xs text-red-400">Failed</span>}
                      {!st && (
                        <button onClick={(e) => { e.stopPropagation(); removeFile(pf.id); }} className="text-white/20 hover:text-red-400 transition-colors">
                          <HiX className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(2)} className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-all">Back</button>
              <button onClick={() => setStep(4)} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-medium hover:from-violet-500 hover:to-purple-500 transition-all">
                Next: Usage Guide
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP 4 — Usage Guide ═════════════════════════════ */}
        {step === 4 && (
          <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-6 space-y-6">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-violet-500/5 border border-violet-500/10">
              <HiCode className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
              <p className="text-xs text-violet-300/80">
                Write a usage guide in Markdown to help users understand how to use your model. This is optional and can be updated later.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Usage Guide <span className="text-white/30">(optional, Markdown)</span>
              </label>
              <textarea
                value={usageGuide}
                onChange={(e) => setUsageGuide(e.target.value)}
                placeholder={'## Installation\n\npip install transformers\n\n## Quick Start\n\n```python\nfrom transformers import AutoModel\nmodel = AutoModel.from_pretrained("your-model")\n```'}
                rows={14}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all resize-none font-mono"
              />
            </div>

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(3)} className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-all">Back</button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !step1Valid}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-medium hover:from-violet-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {submitting ? (
                  <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Creating...</>
                ) : (
                  <><HiCube className="w-4 h-4" /> Create Model</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Summary bar */}
        {step >= 1 && (
          <div className="mt-6 bg-white/[0.02] border border-white/5 rounded-xl p-4">
            <h3 className="text-xs font-medium text-white/30 uppercase tracking-wider mb-3">Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-white/30">Name</span>
                <p className="text-white/70 truncate">{name || '—'}</p>
              </div>
              <div>
                <span className="text-white/30">Hosting</span>
                <p className="text-white/70 flex items-center gap-1.5">
                  {hostingType === 'github' ? <><GitHubIcon className="w-3.5 h-3.5" /> GitHub</> : <><HiCube className="w-3.5 h-3.5" /> Hosted</>}
                </p>
              </div>
              <div>
                <span className="text-white/30">Visibility</span>
                <p className="text-white/70">{isPrivate ? 'Private' : 'Public'}</p>
              </div>
              <div>
                <span className="text-white/30">{hostingType === 'github' ? 'Repo' : 'Files'}</span>
                <p className="text-white/70">
                  {hostingType === 'github'
                    ? ghPreview ? `${ghPreview.owner}/${ghPreview.repo}` : githubUrl ? 'Pending...' : '—'
                    : `${pendingFiles.length} selected`}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
