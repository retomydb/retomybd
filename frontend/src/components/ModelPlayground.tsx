/**
 * ModelPlayground — "Try It" in-browser inference component.
 *
 * Runs models directly in the user's browser via Transformers.js (ONNX Runtime).
 * No API keys. No server. Models are cached after the first download.
 *
 * Supports: text-generation, text-classification, summarization, translation,
 * fill-mask, question-answering, zero-shot-classification, token-classification,
 * feature-extraction, sentence-similarity, and more.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  HiPlay, HiCog, HiCode, HiClipboardCopy,
  HiExclamationCircle, HiInformationCircle,
  HiLightningBolt, HiClock, HiDesktopComputer,
  HiSwitchHorizontal, HiDatabase, HiX,
} from 'react-icons/hi';
import toast from 'react-hot-toast';
import {
  runBrowserInference,
  isModelLoaded,
  isTaskSupported,
  isLikelyCompatible,
  taskLabel,
  estimateSize,
  SUGGESTED_MODELS,
  type DownloadProgress,
  type BrowserInferenceResult,
} from '../services/browserInference';

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  owner: string;
  slug: string;
  task?: string | null;
  pipelineTag?: string | null;
  originalModelId?: string | null;
  hostingType?: string | null;
}

// ── Task-specific placeholder text ───────────────────────────────────────────

const PLACEHOLDERS: Record<string, string> = {
  'text-generation': 'Write a short story about a robot learning to paint...',
  'text2text-generation': 'Translate the following to French: Hello, how are you today?',
  'summarization': 'Paste a long article or document here to get a summary...',
  'text-classification': 'I absolutely loved this movie! The acting was superb.',
  'token-classification': 'My name is Sarah and I work at Google in New York City.',
  'fill-mask': 'The capital of France is [MASK].',
  'translation': 'The weather is beautiful today and I want to go for a walk.',
  'zero-shot-classification': 'I need to buy groceries and fix my car this weekend.',
  'feature-extraction': 'Enter text to generate embedding vectors...',
  'sentence-similarity': 'The cat sat on the mat.',
  'conversational': 'Hello! How can you help me today?',
  'question-answering': 'What is the capital of France?',
};

// ── Main Component ───────────────────────────────────────────────────────────

export default function ModelPlayground({ owner, slug, task, pipelineTag, originalModelId }: Props) {
  // ── State ──
  const [running, setRunning] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [result, setResult] = useState<BrowserInferenceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Download progress tracking
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadFile, setDownloadFile] = useState('');
  const [downloadedMB, setDownloadedMB] = useState(0);
  const [totalMB, setTotalMB] = useState(0);

  // Custom model override
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [customModelId, setCustomModelId] = useState('');

  // Input states
  const [input, setInput] = useState('');
  const [context, setContext] = useState('');
  const [labels, setLabels] = useState('');
  const [compareSentence, setCompareSentence] = useState('');

  // Parameters
  const [showParams, setShowParams] = useState(false);
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [showCode, setShowCode] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Derived ──

  const resolvedTask = pipelineTag || task || '';
  const resolvedModelId = useCustomModel && customModelId
    ? customModelId
    : (originalModelId || `${owner}/${slug}`);
  const modelLoaded = isModelLoaded(resolvedTask, resolvedModelId);
  const taskSupported = isTaskSupported(resolvedTask);
  const likelyWorks = isLikelyCompatible(resolvedModelId);

  const suggestions = SUGGESTED_MODELS[resolvedTask] || [];

  // Reset results when model changes
  useEffect(() => {
    setResult(null);
    setError(null);
    setDownloadProgress(0);
  }, [resolvedModelId, resolvedTask]);

  // ── Progress handler ──

  const handleProgress = useCallback((progress: DownloadProgress) => {
    if (progress.status === 'progress' && progress.progress != null) {
      setDownloadProgress(Math.round(progress.progress));
      if (progress.loaded != null) setDownloadedMB(+(progress.loaded / 1024 / 1024).toFixed(1));
      if (progress.total != null) setTotalMB(+(progress.total / 1024 / 1024).toFixed(1));
      if (progress.file) setDownloadFile(progress.file.split('/').pop() || progress.file);
    } else if (progress.status === 'initiate') {
      setDownloading(true);
      if (progress.file) setDownloadFile(progress.file.split('/').pop() || progress.file);
    } else if (progress.status === 'done' || progress.status === 'ready') {
      setDownloadProgress(100);
    }
  }, []);

  // ── Run inference ──

  const runInference = useCallback(async () => {
    if (!input.trim() && resolvedTask !== 'conversational') return;

    setRunning(true);
    setError(null);
    setResult(null);

    if (!modelLoaded) {
      setDownloading(true);
      setDownloadProgress(0);
    }

    // Build inputs based on task
    let inputs: unknown;
    switch (resolvedTask) {
      case 'question-answering':
        inputs = { question: input.trim(), context: context.trim() };
        break;
      case 'sentence-similarity':
        inputs = { source_sentence: input.trim(), sentences: [compareSentence.trim()] };
        break;
      default:
        inputs = input.trim();
    }

    // Build parameters
    const mergedParams = { ...params };
    if (resolvedTask === 'zero-shot-classification' && labels.trim()) {
      mergedParams.candidate_labels = labels.split(',').map(l => l.trim()).filter(Boolean);
    }

    try {
      const inferenceResult = await runBrowserInference(
        resolvedTask,
        resolvedModelId,
        inputs,
        mergedParams,
        handleProgress,
      );

      setResult(inferenceResult);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);

      if (msg.includes('404') || msg.includes('Could not locate file') || msg.includes('not found')) {
        setError(
          `This model doesn't have browser-compatible (ONNX) files. ` +
          `Try one of the suggested models below, or use a model from the Xenova/ or onnx-community/ namespaces.`
        );
        setShowSuggestions(true);
      } else if (msg.includes('out of memory') || msg.includes('OOM')) {
        setError('Model is too large for your browser. Try a smaller or quantized model.');
      } else {
        setError(msg);
      }
    } finally {
      setRunning(false);
      setDownloading(false);
    }
  }, [input, context, labels, compareSentence, params, resolvedTask, resolvedModelId, modelLoaded, handleProgress]);

  // ── Code snippet ──

  const codeSnippet = `import { pipeline } from '@huggingface/transformers';

// Load model (cached after first download)
const pipe = await pipeline('${resolvedTask}', '${resolvedModelId}');

// Run inference
const result = await pipe(${JSON.stringify(input || PLACEHOLDERS[resolvedTask] || 'Hello world')}${
    resolvedTask === 'zero-shot-classification'
      ? `, ['${labels || 'cooking, travel, technology'}']`
      : ''
  });
console.log(result);`;

  // ── Render: unsupported task ──

  if (!taskSupported) {
    return (
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <HiLightningBolt className="w-4 h-4 text-amber-400" /> Inference
        </h3>
        <p className="text-white/40 text-sm mb-3">
          {resolvedTask
            ? `Browser inference for "${taskLabel(resolvedTask)}" is not yet available.`
            : 'No task type detected for this model. Pick a compatible model below to try in-browser inference.'}
        </p>
        {/* Show all task categories when no task is detected */}
        {!resolvedTask && (
          <div className="space-y-3 mt-3">
            <p className="text-xs text-white/30">Try one of these popular models:</p>
            {Object.entries(SUGGESTED_MODELS).slice(0, 5).map(([t, models]) => (
              <div key={t}>
                <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1">{taskLabel(t)}</p>
                <div className="flex flex-wrap gap-2">
                  {models.slice(0, 2).map(s => (
                    <button
                      key={s.id}
                      onClick={() => { setUseCustomModel(true); setCustomModelId(s.id); }}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white/60 hover:text-white transition-all"
                    >
                      {s.label} <span className="text-white/30 ml-1">{s.size}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {resolvedTask && suggestions.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-white/30 mb-2">Try one of these compatible models:</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setUseCustomModel(true); setCustomModelId(s.id); }}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white/60 hover:text-white transition-all"
                >
                  {s.label} <span className="text-white/30 ml-1">{s.size}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Render: main playground ──

  return (
    <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
      {/* ── Header ── */}
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
            <HiDesktopComputer className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Try this model</h3>
            <p className="text-xs text-white/40">
              {taskLabel(resolvedTask)} — runs in your browser
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] text-emerald-400 font-medium">
            <HiDesktopComputer className="w-3 h-3" />
            In-Browser
          </span>

          {modelLoaded && (
            <span className="flex items-center gap-1 px-2 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-[10px] text-cyan-400 font-medium">
              <HiDatabase className="w-3 h-3" />
              Cached
            </span>
          )}

          <button
            onClick={() => setShowCode(!showCode)}
            className={`p-2 rounded-lg text-xs transition-all ${showCode ? 'bg-violet-500/20 text-violet-300' : 'bg-white/5 text-white/40 hover:text-white/60'}`}
            title="Show code"
          >
            <HiCode className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowParams(!showParams)}
            className={`p-2 rounded-lg text-xs transition-all ${showParams ? 'bg-violet-500/20 text-violet-300' : 'bg-white/5 text-white/40 hover:text-white/60'}`}
            title="Parameters"
          >
            <HiCog className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* ── Info banner ── */}
        <div className="flex items-start gap-2 px-3 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
          <HiInformationCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
          <p className="text-xs text-emerald-300/80">
            This model runs entirely in your browser using WebAssembly. No data leaves your device.
            {!modelLoaded && ` First run downloads ~${estimateSize(resolvedTask)} of model files (cached for future use).`}
          </p>
        </div>

        {/* ── ONNX compatibility warning (only for non-Xenova/onnx-community models) ── */}
        {!likelyWorks && !useCustomModel && (
          <div className="flex items-start gap-2 px-3 py-2 bg-amber-500/5 border border-amber-500/10 rounded-lg">
            <HiExclamationCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-300/80">
              <p>
                This model may not have browser-compatible (ONNX) files.
                You can try running it — if it fails, use a suggested model below.
              </p>
              <button
                onClick={() => setShowSuggestions(!showSuggestions)}
                className="mt-1 text-amber-400 hover:text-amber-300 underline"
              >
                {showSuggestions ? 'Hide' : 'Show'} compatible models
              </button>
            </div>
          </div>
        )}

        {/* ── Custom model / suggestions panel ── */}
        {(showSuggestions || useCustomModel) && (
          <div className="bg-black/20 rounded-xl border border-white/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
                <HiSwitchHorizontal className="w-3.5 h-3.5" />
                Model Selection
              </h4>
              {useCustomModel && (
                <button
                  onClick={() => { setUseCustomModel(false); setCustomModelId(''); setShowSuggestions(false); }}
                  className="text-xs text-white/30 hover:text-white/60 flex items-center gap-1"
                >
                  <HiX className="w-3 h-3" /> Reset
                </button>
              )}
            </div>

            <div>
              <label className="text-xs text-white/40 mb-1 block">Custom Model ID (from HuggingFace Hub)</label>
              <input
                value={customModelId}
                onChange={e => { setCustomModelId(e.target.value); setUseCustomModel(true); }}
                placeholder="e.g. Xenova/distilbert-base-uncased-finetuned-sst-2-english"
                className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:ring-1 focus:ring-violet-500 focus:border-violet-500 outline-none"
              />
            </div>

            {suggestions.length > 0 && (
              <div>
                <p className="text-xs text-white/30 mb-2">Or pick a known-compatible model:</p>
                <div className="grid gap-2">
                  {suggestions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => { setCustomModelId(s.id); setUseCustomModel(true); setShowSuggestions(false); }}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-all ${
                        customModelId === s.id
                          ? 'bg-violet-500/15 border-violet-500/30 text-violet-300'
                          : 'bg-white/[0.02] border-white/10 text-white/50 hover:bg-white/5 hover:text-white/70'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-medium">{s.label}</span>
                        <span className="text-[10px] text-white/25 ml-2 font-mono">{s.id}</span>
                      </div>
                      <span className="text-[10px] text-white/25">{s.size}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 px-3 py-2 bg-violet-500/5 border border-violet-500/10 rounded-lg">
              <span className="text-[10px] text-violet-400 font-medium">ACTIVE:</span>
              <span className="text-xs text-white/60 font-mono truncate">{resolvedModelId}</span>
            </div>
          </div>
        )}

        {/* ── Code snippet ── */}
        {showCode && (
          <div className="bg-black/30 rounded-xl border border-white/5 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
              <span className="text-xs text-white/40 font-medium">JavaScript / TypeScript (Transformers.js)</span>
              <button
                onClick={() => { navigator.clipboard.writeText(codeSnippet); toast.success('Copied!'); }}
                className="text-xs text-white/30 hover:text-white/60 transition-colors flex items-center gap-1"
              >
                <HiClipboardCopy className="w-3.5 h-3.5" /> Copy
              </button>
            </div>
            <pre className="p-4 text-xs text-green-300 font-mono overflow-x-auto whitespace-pre">
              {codeSnippet}
            </pre>
          </div>
        )}

        {/* ── Parameters panel ── */}
        {showParams && (
          <div className="bg-black/20 rounded-xl border border-white/5 p-4 space-y-3">
            <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Parameters</h4>
            {resolvedTask === 'text-generation' || resolvedTask === 'text2text-generation' ? (
              <div className="grid grid-cols-2 gap-3">
                <ParamInput label="Max New Tokens" type="number" min={1} max={2048}
                  value={(params.max_new_tokens as number) || 128}
                  onChange={v => setParams(p => ({ ...p, max_new_tokens: parseInt(String(v)) || 128 }))}
                />
                <ParamInput label="Temperature" type="number" min={0} max={2} step={0.1}
                  value={(params.temperature as number) ?? 0.7}
                  onChange={v => setParams(p => ({ ...p, temperature: parseFloat(String(v)) || 0.7 }))}
                />
                <ParamInput label="Top-P" type="number" min={0} max={1} step={0.05}
                  value={(params.top_p as number) ?? 0.9}
                  onChange={v => setParams(p => ({ ...p, top_p: parseFloat(String(v)) || 0.9 }))}
                />
                <ParamInput label="Repetition Penalty" type="number" min={1} max={3} step={0.1}
                  value={(params.repetition_penalty as number) ?? 1.0}
                  onChange={v => setParams(p => ({ ...p, repetition_penalty: parseFloat(String(v)) || 1.0 }))}
                />
              </div>
            ) : resolvedTask === 'summarization' ? (
              <div className="grid grid-cols-2 gap-3">
                <ParamInput label="Max Length" type="number" min={10} max={1000}
                  value={(params.max_length as number) || 150}
                  onChange={v => setParams(p => ({ ...p, max_length: parseInt(String(v)) || 150 }))}
                />
                <ParamInput label="Min Length" type="number" min={1} max={500}
                  value={(params.min_length as number) || 30}
                  onChange={v => setParams(p => ({ ...p, min_length: parseInt(String(v)) || 30 }))}
                />
              </div>
            ) : (
              <p className="text-xs text-white/30">No configurable parameters for this task.</p>
            )}
          </div>
        )}

        {/* ── Task-specific extra inputs ── */}
        {resolvedTask === 'question-answering' && (
          <div>
            <label className="text-xs text-white/50 mb-1 block">Context</label>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="Provide the context paragraph the model should answer from..."
              rows={4}
              className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/20 focus:ring-1 focus:ring-violet-500 focus:border-violet-500 outline-none resize-none"
            />
          </div>
        )}
        {resolvedTask === 'zero-shot-classification' && (
          <div>
            <label className="text-xs text-white/50 mb-1 block">Candidate Labels (comma-separated)</label>
            <input
              value={labels}
              onChange={e => setLabels(e.target.value)}
              placeholder="cooking, travel, technology, sports"
              className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/20 focus:ring-1 focus:ring-violet-500 focus:border-violet-500 outline-none"
            />
          </div>
        )}
        {resolvedTask === 'sentence-similarity' && (
          <div>
            <label className="text-xs text-white/50 mb-1 block">Compare with</label>
            <input
              value={compareSentence}
              onChange={e => setCompareSentence(e.target.value)}
              placeholder="The dog is lying on the rug."
              className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/20 focus:ring-1 focus:ring-violet-500 focus:border-violet-500 outline-none"
            />
          </div>
        )}

        {/* ── Main input ── */}
        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                runInference();
              }
            }}
            placeholder={PLACEHOLDERS[resolvedTask] || 'Enter your input...'}
            rows={resolvedTask === 'text-generation' || resolvedTask === 'summarization' ? 5 : 3}
            className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/20 focus:ring-1 focus:ring-violet-500 focus:border-violet-500 outline-none resize-none pr-28"
          />
          <div className="absolute bottom-2 right-2 flex items-center gap-2">
            <span className="text-[10px] text-white/20">⌘↵</span>
            <button
              onClick={runInference}
              disabled={running || (!input.trim() && resolvedTask !== 'conversational')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                running
                  ? 'bg-violet-500/30 text-violet-300 cursor-wait'
                  : 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:opacity-90 shadow-lg shadow-emerald-500/20'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {running ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-violet-300 border-t-transparent rounded-full animate-spin" />
                  {downloading ? 'Loading...' : 'Running...'}
                </>
              ) : (
                <>
                  <HiPlay className="w-4 h-4" />
                  Run
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Download progress bar ── */}
        {downloading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/50 flex items-center gap-1.5">
                <div className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                Downloading model{downloadFile ? `: ${downloadFile}` : '...'}
              </span>
              <span className="text-white/40 font-mono">
                {downloadProgress > 0 ? `${downloadProgress}%` : ''}
                {downloadedMB > 0 && totalMB > 0 ? ` (${downloadedMB} / ${totalMB} MB)` : ''}
              </span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
            <p className="text-[10px] text-white/25">
              First run downloads model files. They&apos;re cached in your browser for future use.
            </p>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="flex items-start gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <HiExclamationCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-300">{error}</p>
              {suggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggestions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setCustomModelId(s.id);
                        setUseCustomModel(true);
                        setError(null);
                        setShowSuggestions(false);
                      }}
                      className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[11px] text-white/50 hover:text-white/70 transition-all"
                    >
                      Try {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Result ── */}
        {result && (
          <div ref={resultRef} className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Output</h4>
              <div className="flex items-center gap-3 text-[10px] text-white/30">
                <span className="flex items-center gap-1">
                  <HiClock className="w-3 h-3" /> {result.time_ms.toFixed(0)}ms
                </span>
                {result.fromCache && (
                  <span className="text-cyan-400 flex items-center gap-1">
                    <HiDatabase className="w-3 h-3" /> cached
                  </span>
                )}
                <span className="text-emerald-400 flex items-center gap-1">
                  <HiDesktopComputer className="w-3 h-3" /> in-browser
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      typeof result.outputs === 'string'
                        ? result.outputs
                        : JSON.stringify(result.outputs, null, 2)
                    );
                    toast.success('Output copied!');
                  }}
                  className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
                >
                  <HiClipboardCopy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="bg-black/30 border border-white/5 rounded-xl p-4">
              <OutputRenderer task={resolvedTask} outputs={result.outputs} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ── Reusable param input ─────────────────────────────────────────────────────

function ParamInput({ label, type, min, max, step, value, onChange }: {
  label: string;
  type: string;
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="text-xs text-white/40 mb-1 block">{label}</label>
      <input
        type={type}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-white focus:ring-1 focus:ring-violet-500 focus:border-violet-500 outline-none"
      />
    </div>
  );
}


// ── Output Renderer ──────────────────────────────────────────────────────────

function OutputRenderer({ task, outputs }: { task: string; outputs: unknown }) {
  // ─── Text Generation ───
  if (task === 'text-generation' || task === 'text2text-generation') {
    const items = Array.isArray(outputs) ? outputs : [outputs];
    return (
      <div className="space-y-3">
        {items.map((item: unknown, i: number) => {
          const text = typeof item === 'object' && item !== null
            ? (item as Record<string, string>).generated_text || JSON.stringify(item)
            : String(item);
          return (
            <p key={i} className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">{text}</p>
          );
        })}
      </div>
    );
  }

  // ─── Classification ───
  if (task === 'text-classification' || task === 'zero-shot-classification') {
    let labelList: Array<{ label: string; score: number }> = [];
    if (Array.isArray(outputs)) {
      const flat = Array.isArray(outputs[0]) ? outputs[0] : outputs;
      labelList = flat as Array<{ label: string; score: number }>;
    } else if (typeof outputs === 'object' && outputs !== null) {
      const o = outputs as Record<string, unknown>;
      if (o.labels && o.scores) {
        labelList = (o.labels as string[]).map((l: string, i: number) => ({
          label: l,
          score: (o.scores as number[])[i],
        }));
      } else if (o.label && o.score != null) {
        labelList = [{ label: o.label as string, score: o.score as number }];
      }
    }
    return (
      <div className="space-y-2">
        {labelList.map((l, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-sm text-white/70 w-32 truncate" title={l.label}>{l.label}</span>
            <div className="flex-1 bg-white/5 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full transition-all duration-500"
                style={{ width: `${(l.score * 100).toFixed(1)}%` }}
              />
            </div>
            <span className="text-xs text-white/50 w-14 text-right">{(l.score * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    );
  }

  // ─── Token Classification (NER) ───
  if (task === 'token-classification') {
    const entities = Array.isArray(outputs) ? outputs : [];
    const colors: Record<string, string> = {
      PER: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
      ORG: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      LOC: 'bg-green-500/20 text-green-300 border-green-500/30',
      MISC: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    };
    return (
      <div className="flex flex-wrap gap-2">
        {entities.map((ent: Record<string, unknown>, i: number) => {
          const group = String(ent.entity_group || ent.entity || 'MISC').replace(/^B-|^I-/, '');
          const cls = colors[group] || 'bg-white/10 text-white/70 border-white/20';
          return (
            <span key={i} className={`px-2 py-1 rounded border text-xs ${cls}`}>
              {String(ent.word)} <span className="opacity-60 text-[10px] ml-1">{group}</span>
            </span>
          );
        })}
      </div>
    );
  }

  // ─── Question Answering ───
  if (task === 'question-answering') {
    const ans = typeof outputs === 'object' && outputs !== null ? outputs as Record<string, unknown> : {};
    const score = typeof ans.score === 'number' ? ans.score : null;
    return (
      <div className="space-y-2">
        <p className="text-sm text-white/80">{String(ans.answer || JSON.stringify(outputs))}</p>
        {score !== null && (
          <p className="text-xs text-white/40">Confidence: {(score * 100).toFixed(1)}%</p>
        )}
      </div>
    );
  }

  // ─── Summarization / Translation ───
  if (task === 'summarization' || task === 'translation') {
    const items = Array.isArray(outputs) ? outputs : [outputs];
    return (
      <div className="space-y-2">
        {items.map((item: unknown, i: number) => {
          const text = typeof item === 'object' && item !== null
            ? (item as Record<string, string>).summary_text
              || (item as Record<string, string>).translation_text
              || JSON.stringify(item)
            : String(item);
          return <p key={i} className="text-sm text-white/80 leading-relaxed">{text}</p>;
        })}
      </div>
    );
  }

  // ─── Fill Mask ───
  if (task === 'fill-mask') {
    const items = Array.isArray(outputs) ? outputs : [];
    return (
      <div className="space-y-1.5">
        {items.map((item: Record<string, unknown>, i: number) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-sm text-white/80 font-medium">{String(item.token_str)}</span>
            <div className="flex-1 bg-white/5 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full"
                style={{ width: `${((item.score as number) * 100).toFixed(1)}%` }}
              />
            </div>
            <span className="text-xs text-white/40 w-14 text-right">{((item.score as number) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    );
  }

  // ─── Feature Extraction (Embeddings) ───
  if (task === 'feature-extraction') {
    const vec = Array.isArray(outputs) ? outputs : [];
    const dims = vec.length;
    const preview = vec.slice(0, 8).map((v: number) => (typeof v === 'number' ? v.toFixed(4) : String(v))).join(', ');
    return (
      <div className="space-y-2">
        <p className="text-xs text-white/40">Embedding: {dims} dimensions</p>
        <code className="text-xs text-green-300 block font-mono">[{preview}{dims > 8 ? ', ...' : ''}]</code>
      </div>
    );
  }

  // ─── Sentence Similarity ───
  if (task === 'sentence-similarity') {
    const scores = Array.isArray(outputs) ? outputs : [];
    return (
      <div className="space-y-2">
        {scores.map((s: number, i: number) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-sm text-white/70">Similarity</span>
            <div className="flex-1 bg-white/5 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full"
                style={{ width: `${(Math.max(0, s) * 100).toFixed(1)}%` }}
              />
            </div>
            <span className="text-sm font-medium text-white/80">{(s * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    );
  }

  // ─── Fallback — pretty-print JSON ───
  return (
    <pre className="text-xs text-white/60 font-mono whitespace-pre-wrap overflow-x-auto">
      {typeof outputs === 'string' ? outputs : JSON.stringify(outputs, null, 2)}
    </pre>
  );
}
