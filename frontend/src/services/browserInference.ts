/**
 * Browser-side model inference using Transformers.js (ONNX Runtime).
 *
 * Downloads model weights directly from HuggingFace Hub CDN and runs
 * inference entirely in the user's browser — no API keys, no server cost.
 *
 * Models are cached in the browser's Cache API / IndexedDB after first
 * download, so subsequent runs are near-instant.
 *
 * The heavy ONNX runtime is loaded lazily (only when inference is first called)
 * so it doesn't bloat the initial page load.
 */

// Lazy-loaded reference to the transformers library
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _transformers: any = null;

async function getTransformers() {
  if (!_transformers) {
    _transformers = await import('@huggingface/transformers');
    _transformers.env.allowLocalModels = false;
  }
  return _transformers;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface DownloadProgress {
  status: 'initiate' | 'download' | 'progress' | 'done' | 'ready';
  file?: string;
  name?: string;
  progress?: number;   // 0–100
  loaded?: number;     // bytes loaded
  total?: number;      // bytes total
}

export interface BrowserInferenceResult {
  outputs: unknown;
  time_ms: number;
  fromCache: boolean;
}

export type ProgressCallback = (progress: DownloadProgress) => void;

// ── Supported tasks ──────────────────────────────────────────────────────────

export const BROWSER_SUPPORTED_TASKS = [
  'text-generation',
  'text2text-generation',
  'text-classification',
  'token-classification',
  'question-answering',
  'fill-mask',
  'summarization',
  'translation',
  'feature-extraction',
  'zero-shot-classification',
  'sentence-similarity',        // custom: uses feature-extraction under the hood
  'image-classification',
  'automatic-speech-recognition',
] as const;

export type BrowserTask = (typeof BROWSER_SUPPORTED_TASKS)[number];

const TASK_ALIASES: Record<string, string> = {
  'sentiment-analysis': 'text-classification',
  'ner': 'token-classification',
  'asr': 'automatic-speech-recognition',
};

function normalizeTask(task: string): string {
  return TASK_ALIASES[task] || task;
}

export function isTaskSupported(task: string | null | undefined): boolean {
  if (!task) return false;
  const t = normalizeTask(task);
  return (BROWSER_SUPPORTED_TASKS as readonly string[]).includes(t) || t === 'sentence-similarity';
}

// ── Suggested models per task (known Transformers.js–compatible) ─────────────

export const SUGGESTED_MODELS: Record<string, Array<{ id: string; label: string; size: string }>> = {
  'text-classification': [
    { id: 'Xenova/distilbert-base-uncased-finetuned-sst-2-english', label: 'Sentiment Analysis (DistilBERT)', size: '67 MB' },
    { id: 'Xenova/bert-base-multilingual-uncased-sentiment', label: 'Multilingual Sentiment (BERT)', size: '167 MB' },
  ],
  'text-generation': [
    { id: 'Xenova/gpt2', label: 'GPT-2 (small)', size: '~300 MB' },
    { id: 'Xenova/distilgpt2', label: 'DistilGPT-2 (fast)', size: '~170 MB' },
    { id: 'onnx-community/Qwen2.5-0.5B-Instruct', label: 'Qwen 2.5 0.5B Instruct', size: '~500 MB' },
  ],
  'question-answering': [
    { id: 'Xenova/distilbert-base-cased-distilled-squad', label: 'DistilBERT SQuAD', size: '~65 MB' },
  ],
  'fill-mask': [
    { id: 'Xenova/bert-base-uncased', label: 'BERT Base', size: '~110 MB' },
    { id: 'Xenova/bert-base-cased', label: 'BERT Base (cased)', size: '~110 MB' },
  ],
  'summarization': [
    { id: 'Xenova/distilbart-cnn-6-6', label: 'DistilBART CNN', size: '~300 MB' },
  ],
  'translation': [
    { id: 'Xenova/nllb-200-distilled-600M', label: 'NLLB 200 (multilingual)', size: '~600 MB' },
  ],
  'token-classification': [
    { id: 'Xenova/bert-base-NER', label: 'BERT NER', size: '~110 MB' },
  ],
  'feature-extraction': [
    { id: 'Xenova/all-MiniLM-L6-v2', label: 'MiniLM L6 v2 (embeddings)', size: '~23 MB' },
    { id: 'Xenova/bge-small-en-v1.5', label: 'BGE Small EN', size: '~33 MB' },
  ],
  'zero-shot-classification': [
    { id: 'Xenova/nli-deberta-v3-xsmall', label: 'DeBERTa v3 XSmall NLI', size: '~90 MB' },
    { id: 'Xenova/mobilebert-uncased-mnli', label: 'MobileBERT MNLI', size: '~25 MB' },
  ],
  'sentence-similarity': [
    { id: 'Xenova/all-MiniLM-L6-v2', label: 'MiniLM L6 v2', size: '~23 MB' },
    { id: 'Xenova/all-MiniLM-L12-v2', label: 'MiniLM L12 v2', size: '~33 MB' },
  ],
  'image-classification': [
    { id: 'Xenova/vit-base-patch16-224', label: 'ViT Base (ImageNet)', size: '~86 MB' },
  ],
  'automatic-speech-recognition': [
    { id: 'Xenova/whisper-tiny.en', label: 'Whisper Tiny (English)', size: '~60 MB' },
  ],
};

// ── Pipeline cache ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pipelineCache = new Map<string, any>();

function cacheKey(task: string, modelId: string): string {
  return `${normalizeTask(task)}::${modelId}`;
}

export function isModelLoaded(task: string, modelId: string): boolean {
  return pipelineCache.has(cacheKey(task, modelId));
}

export function clearPipeline(task: string, modelId: string): void {
  const key = cacheKey(task, modelId);
  const pipe = pipelineCache.get(key);
  if (pipe?.dispose) pipe.dispose();
  pipelineCache.delete(key);
}

export function clearAllPipelines(): void {
  for (const pipe of pipelineCache.values()) {
    if (pipe?.dispose) pipe.dispose();
  }
  pipelineCache.clear();
}

// ── Core: load pipeline ──────────────────────────────────────────────────────

async function getOrCreatePipeline(
  task: string,
  modelId: string,
  onProgress?: ProgressCallback,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const key = cacheKey(task, modelId);

  if (pipelineCache.has(key)) {
    return pipelineCache.get(key);
  }

  // Lazy-load the transformers library (includes ONNX runtime)
  const { pipeline } = await getTransformers();

  // The actual task used for pipeline(). For sentence-similarity we use feature-extraction.
  const pipelineTask = normalizeTask(task) === 'sentence-similarity'
    ? 'feature-extraction'
    : normalizeTask(task);

  const pipe = await pipeline(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pipelineTask as any,
    modelId,
    {
      progress_callback: onProgress ?? (() => {}),
      // Let the library pick the best available dtype/quantization
    },
  );

  pipelineCache.set(key, pipe);
  return pipe;
}

// ── Core: run inference ──────────────────────────────────────────────────────

export async function runBrowserInference(
  task: string,
  modelId: string,
  inputs: unknown,
  parameters?: Record<string, unknown>,
  onProgress?: ProgressCallback,
): Promise<BrowserInferenceResult> {
  const normalizedTask = normalizeTask(task);
  const wasLoaded = isModelLoaded(task, modelId);

  const pipe = await getOrCreatePipeline(normalizedTask, modelId, onProgress);

  const start = performance.now();
  let outputs: unknown;

  switch (normalizedTask) {
    // ─── Text Generation ───
    case 'text-generation': {
      const genParams: Record<string, unknown> = {
        max_new_tokens: (parameters?.max_new_tokens as number) || 128,
        do_sample: true,
      };
      if (parameters?.temperature != null) genParams.temperature = parameters.temperature;
      if (parameters?.top_p != null) genParams.top_p = parameters.top_p;
      if (parameters?.repetition_penalty != null) genParams.repetition_penalty = parameters.repetition_penalty;
      outputs = await pipe(inputs as string, genParams);
      break;
    }

    // ─── Text-to-Text ───
    case 'text2text-generation': {
      outputs = await pipe(inputs as string, {
        max_new_tokens: (parameters?.max_new_tokens as number) || 128,
      });
      break;
    }

    // ─── Classification ───
    case 'text-classification': {
      const result = await pipe(inputs as string, { topk: 5 });
      outputs = Array.isArray(result) ? result : [result];
      break;
    }

    // ─── Token Classification (NER) ───
    case 'token-classification': {
      outputs = await pipe(inputs as string);
      break;
    }

    // ─── Question Answering ───
    case 'question-answering': {
      const qa = inputs as { question: string; context: string };
      outputs = await pipe(qa.question, qa.context);
      break;
    }

    // ─── Fill Mask ───
    case 'fill-mask': {
      outputs = await pipe(inputs as string, { topk: 5 });
      break;
    }

    // ─── Summarization ───
    case 'summarization': {
      outputs = await pipe(inputs as string, {
        max_length: (parameters?.max_length as number) || 150,
        min_length: (parameters?.min_length as number) || 30,
      });
      break;
    }

    // ─── Translation ───
    case 'translation': {
      outputs = await pipe(inputs as string, {
        max_length: (parameters?.max_length as number) || 200,
      });
      break;
    }

    // ─── Feature Extraction (Embeddings) ───
    case 'feature-extraction': {
      const raw = await pipe(inputs as string, { pooling: 'mean', normalize: true });
      // raw is a Tensor; convert to plain array
      outputs = Array.from(raw.data as Float32Array);
      break;
    }

    // ─── Zero-Shot Classification ───
    case 'zero-shot-classification': {
      const candidateLabels = parameters?.candidate_labels as string[] | undefined;
      if (!candidateLabels || candidateLabels.length === 0) {
        throw new Error('Please provide at least one candidate label.');
      }
      outputs = await pipe(inputs as string, candidateLabels, {
        multi_label: (parameters?.multi_label as boolean) ?? false,
      });
      break;
    }

    // ─── Sentence Similarity ───
    case 'sentence-similarity': {
      const sim = inputs as { source_sentence: string; sentences: string[] };
      const sourceEmbed = await pipe(sim.source_sentence, { pooling: 'mean', normalize: true });
      const sourceVec = Array.from(sourceEmbed.data as Float32Array);

      const scores: number[] = [];
      for (const sent of sim.sentences) {
        const embed = await pipe(sent, { pooling: 'mean', normalize: true });
        const vec = Array.from(embed.data as Float32Array);
        // Cosine similarity (vectors are already normalized)
        let dot = 0;
        for (let i = 0; i < sourceVec.length; i++) dot += sourceVec[i] * vec[i];
        scores.push(dot);
      }
      outputs = scores;
      break;
    }

    // ─── Fallback ───
    default:
      outputs = await pipe(inputs);
  }

  return {
    outputs,
    time_ms: performance.now() - start,
    fromCache: wasLoaded,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Human-readable task label */
export function taskLabel(task: string): string {
  const labels: Record<string, string> = {
    'text-generation': 'Text Generation',
    'text2text-generation': 'Text-to-Text',
    'text-classification': 'Text Classification',
    'token-classification': 'Named Entity Recognition',
    'question-answering': 'Question Answering',
    'fill-mask': 'Fill Mask',
    'summarization': 'Summarization',
    'translation': 'Translation',
    'feature-extraction': 'Feature Extraction (Embeddings)',
    'zero-shot-classification': 'Zero-Shot Classification',
    'sentence-similarity': 'Sentence Similarity',
    'image-classification': 'Image Classification',
    'automatic-speech-recognition': 'Speech Recognition',
    'conversational': 'Conversational',
  };
  return labels[normalizeTask(task)] || task;
}

/** Estimate model download size */
export function estimateSize(task: string): string {
  const sizes: Record<string, string> = {
    'text-generation': '170–500 MB',
    'text2text-generation': '200–600 MB',
    'text-classification': '65–170 MB',
    'token-classification': '65–170 MB',
    'question-answering': '65–170 MB',
    'fill-mask': '65–170 MB',
    'summarization': '200–400 MB',
    'translation': '200–600 MB',
    'feature-extraction': '20–170 MB',
    'zero-shot-classification': '25–170 MB',
    'sentence-similarity': '20–50 MB',
    'image-classification': '80–350 MB',
    'automatic-speech-recognition': '60–400 MB',
  };
  return sizes[normalizeTask(task)] || '50–500 MB';
}

/** Check if a model ID looks like a known Transformers.js–compatible model */
export function isLikelyCompatible(modelId: string): boolean {
  const compat_prefixes = [
    'Xenova/', 'onnx-community/', 'mixedbread-ai/',
    'Supabase/', 'jinaai/',
  ];
  return compat_prefixes.some(p => modelId.startsWith(p));
}
