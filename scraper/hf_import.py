#!/usr/bin/env python3
"""Robust HuggingFace model importer using huggingface_hub library.

Uses huggingface_hub's built-in rate limiting and retry logic.
Skips models already in the database (safe to re-run).
"""
import sys, os, time, json, uuid, re, logging
from datetime import datetime, timezone
from typing import Optional, List, Dict

sys.path.insert(0, os.path.dirname(__file__))

from huggingface_hub import HfApi, ModelInfo
from huggingface_hub.utils import HfHubHTTPError
import requests
import pyodbc

# ── Config ────────────────────────────────────────────────────────────────
OWNER_ID = "84C9D1F7-F3B0-46B3-9BA5-1441887D9F5B"
CONN_STR = (
    "DRIVER={ODBC Driver 18 for SQL Server};SERVER=localhost,1433;"
    "DATABASE=retomY;UID=sa;PWD=Prestige@123;"
    "TrustServerCertificate=yes;Encrypt=yes"
)
DB_URL = (
    "mssql+pyodbc://sa:Prestige%40123@localhost:1433/retomY"
    "?driver=ODBC+Driver+18+for+SQL+Server"
    "&TrustServerCertificate=yes&Encrypt=yes"
)

CATEGORIES = [
    ("text-generation", 300), ("text2text-generation", 100),
    ("text-classification", 200), ("token-classification", 100),
    ("question-answering", 100), ("summarization", 80),
    ("translation", 80), ("fill-mask", 80), ("conversational", 60),
    ("zero-shot-classification", 50), ("sentence-similarity", 80),
    ("feature-extraction", 100), ("table-question-answering", 30),
    ("image-classification", 150), ("object-detection", 80),
    ("image-segmentation", 80), ("image-to-text", 60),
    ("text-to-image", 150), ("image-to-image", 60),
    ("depth-estimation", 40), ("unconditional-image-generation", 30),
    ("video-classification", 30), ("visual-question-answering", 40),
    ("document-question-answering", 40), ("image-feature-extraction", 30),
    ("automatic-speech-recognition", 100), ("text-to-speech", 60),
    ("audio-classification", 60), ("audio-to-audio", 30),
    ("text-to-video", 40), ("image-text-to-text", 60),
    ("reinforcement-learning", 60), ("tabular-classification", 30),
    ("tabular-regression", 20), ("mask-generation", 20),
    ("any-to-any", 20),
]

TASK_MAP = {
    "text-generation": "Text Generation",
    "text2text-generation": "Text-to-Text Generation",
    "text-classification": "Text Classification",
    "token-classification": "Token Classification",
    "question-answering": "Question Answering",
    "summarization": "Summarization",
    "translation": "Translation",
    "fill-mask": "Fill-Mask",
    "conversational": "Conversational",
    "feature-extraction": "Feature Extraction",
    "sentence-similarity": "Sentence Similarity",
    "zero-shot-classification": "Zero-Shot Classification",
    "image-classification": "Image Classification",
    "image-segmentation": "Image Segmentation",
    "object-detection": "Object Detection",
    "image-to-text": "Image-to-Text",
    "text-to-image": "Text-to-Image",
    "text-to-video": "Text-to-Video",
    "text-to-speech": "Text-to-Speech",
    "automatic-speech-recognition": "Speech Recognition",
    "audio-classification": "Audio Classification",
    "reinforcement-learning": "Reinforcement Learning",
    "tabular-classification": "Tabular Classification",
    "tabular-regression": "Tabular Regression",
    "depth-estimation": "Depth Estimation",
    "image-to-image": "Image-to-Image",
    "unconditional-image-generation": "Unconditional Image Generation",
    "video-classification": "Video Classification",
    "visual-question-answering": "Visual Question Answering",
    "document-question-answering": "Document Question Answering",
    "image-feature-extraction": "Image Feature Extraction",
}

AUTO_CLASS = {
    "text-generation": "AutoModelForCausalLM",
    "text2text-generation": "AutoModelForSeq2SeqLM",
    "text-classification": "AutoModelForSequenceClassification",
    "token-classification": "AutoModelForTokenClassification",
    "question-answering": "AutoModelForQuestionAnswering",
    "fill-mask": "AutoModelForMaskedLM",
    "summarization": "AutoModelForSeq2SeqLM",
    "translation": "AutoModelForSeq2SeqLM",
    "feature-extraction": "AutoModel",
    "image-classification": "AutoModelForImageClassification",
    "object-detection": "AutoModelForObjectDetection",
    "automatic-speech-recognition": "AutoModelForSpeechSeq2Seq",
    "audio-classification": "AutoModelForAudioClassification",
}

logging.basicConfig(level=logging.WARNING)
log = logging.getLogger("hf_import")


# ── DB helpers ────────────────────────────────────────────────────────────

def get_existing_slugs() -> set:
    conn = pyodbc.connect(CONN_STR)
    c = conn.cursor()
    c.execute("SELECT Slug FROM retomy.Repositories WHERE RepoType = 'model'")
    slugs = {r[0] for r in c.fetchall()}
    conn.close()
    return slugs


def db_insert(table: str, row: dict):
    """Insert a row using pyodbc directly (avoids SQLAlchemy reflection overhead)."""
    conn = pyodbc.connect(CONN_STR)
    c = conn.cursor()
    cols = ", ".join(row.keys())
    placeholders = ", ".join(["?"] * len(row))
    sql = f"INSERT INTO retomy.{table} ({cols}) VALUES ({placeholders})"
    c.execute(sql, list(row.values()))
    conn.commit()
    conn.close()


# ── Metadata extraction ──────────────────────────────────────────────────

def normalize_gated(value) -> str:
    if isinstance(value, str) and value in ('none', 'auto', 'manual'):
        return value
    if value is True:
        return 'manual'
    return 'none'


def detect_framework(tags: list, config: dict) -> Optional[str]:
    tag_set = {t.lower() for t in tags}
    for fw in ["pytorch", "tf", "tensorflow", "jax", "flax", "onnx", "gguf",
                "openvino", "tensorrt", "coreml", "paddle"]:
        if fw in tag_set:
            return fw
    if config.get("torch_dtype"):
        return "pytorch"
    return None


def detect_library(tags: list, library_name: Optional[str]) -> Optional[str]:
    if library_name:
        return library_name
    LIBRARY_TAGS = {
        "transformers", "diffusers", "sentence-transformers", "tokenizers",
        "timm", "peft", "adapter-transformers", "spacy", "flair",
        "fairseq", "espnet", "speechbrain", "nemo", "paddlenlp",
        "setfit", "span-marker", "scikit-learn", "fasttext",
        "stable-baselines3", "open_clip", "keras", "fastai",
    }
    tag_set = {t.lower() for t in tags}
    for lib in sorted(LIBRARY_TAGS):
        if lib in tag_set:
            return lib
    return None


def detect_task(pipeline_tag: Optional[str], tags: list) -> Optional[str]:
    if pipeline_tag and pipeline_tag in TASK_MAP:
        return TASK_MAP[pipeline_tag]
    if pipeline_tag:
        return pipeline_tag.replace("-", " ").title()
    tag_set = {t.lower() for t in tags}
    for raw, display in TASK_MAP.items():
        if raw in tag_set:
            return display
    return None


def detect_architecture(config: dict) -> Optional[str]:
    archs = config.get("architectures")
    if archs and isinstance(archs, list):
        return ", ".join(archs)
    mt = config.get("model_type")
    if mt:
        return mt
    return None


def detect_language(card_data: dict, tags: list) -> Optional[str]:
    lang = card_data.get("language")
    if lang:
        if isinstance(lang, list):
            return ", ".join(str(l) for l in lang[:5])
        return str(lang)
    lang_pat = re.compile(r'^[a-z]{2}$')
    langs = [t for t in tags if lang_pat.match(t)]
    if langs:
        return ", ".join(langs[:5])
    return None


def detect_base_model(card_data: dict, tags: list) -> Optional[str]:
    bm = card_data.get("base_model")
    if bm:
        if isinstance(bm, list):
            return bm[0] if bm else None
        return str(bm)
    for t in tags:
        if t.startswith("base_model:"):
            return t.split(":", 1)[1]
    return None


def detect_param_count(safetensors: dict, config: dict) -> Optional[int]:
    params = safetensors.get("total")
    if params:
        return int(params)
    st_params = safetensors.get("parameters")
    if isinstance(st_params, dict):
        total = sum(v for v in st_params.values() if isinstance(v, (int, float)))
        if total > 0:
            return int(total)
    return None


def detect_tensor_type(tags: list, siblings: list) -> Optional[str]:
    tag_set = {t.lower() for t in tags}
    types = []
    filenames = [s.get("rfilename", "") if isinstance(s, dict) else getattr(s, "rfilename", "") for s in siblings]
    if "safetensors" in tag_set or any(f.endswith(".safetensors") for f in filenames):
        types.append("safetensors")
    if any(f.endswith(".bin") for f in filenames):
        types.append("pytorch")
    if "gguf" in tag_set or any(f.endswith(".gguf") for f in filenames):
        types.append("gguf")
    if any(f.endswith(".onnx") for f in filenames):
        types.append("onnx")
    return ", ".join(types) if types else None


def detect_license(card_data: dict, tags: list) -> Optional[str]:
    lic = card_data.get("license")
    if lic:
        if isinstance(lic, list):
            return lic[0] if lic else None
        return str(lic)
    for t in tags:
        if t.startswith("license:"):
            return t.split(":", 1)[1]
    return None


def generate_usage_snippets(model_id: str, library: Optional[str],
                            pipeline_tag: Optional[str], framework: Optional[str],
                            tags: list) -> str:
    snippets = {}
    lib = (library or "").lower()
    task = (pipeline_tag or "").lower()
    tag_set = {t.lower() for t in tags}

    if lib in ("transformers", "") or "transformers" in tag_set:
        if task:
            snippets["pipeline"] = (
                f'from transformers import pipeline\n\n'
                f'pipe = pipeline("{task}", model="{model_id}")\n'
                f'result = pipe("Your input text here")\nprint(result)'
            )
        auto = AUTO_CLASS.get(task, "AutoModel")
        snippets["direct"] = (
            f'from transformers import AutoTokenizer, {auto}\n\n'
            f'tokenizer = AutoTokenizer.from_pretrained("{model_id}")\n'
            f'model = {auto}.from_pretrained("{model_id}")\n\n'
            f'inputs = tokenizer("Your input text here", return_tensors="pt")\n'
            f'outputs = model(**inputs)'
        )

    if lib == "diffusers" or "diffusers" in tag_set:
        pipe_class = "StableDiffusionPipeline"
        if "stable-diffusion-xl" in tag_set or "sdxl" in tag_set:
            pipe_class = "StableDiffusionXLPipeline"
        elif "flux" in model_id.lower():
            pipe_class = "FluxPipeline"
        snippets["diffusers"] = (
            f'from diffusers import {pipe_class}\nimport torch\n\n'
            f'pipe = {pipe_class}.from_pretrained("{model_id}", torch_dtype=torch.float16)\n'
            f'pipe = pipe.to("cuda")\n\n'
            f'image = pipe("A beautiful sunset over the mountains").images[0]\n'
            f'image.save("output.png")'
        )

    if lib == "sentence-transformers" or "sentence-transformers" in tag_set:
        snippets["sentence_transformers"] = (
            f'from sentence_transformers import SentenceTransformer\n\n'
            f'model = SentenceTransformer("{model_id}")\n'
            f'embeddings = model.encode(["Example sentence"])\nprint(embeddings.shape)'
        )

    if lib == "peft" or "peft" in tag_set or "lora" in tag_set:
        snippets["peft"] = (
            f'from peft import PeftModel, PeftConfig\n'
            f'from transformers import AutoModelForCausalLM, AutoTokenizer\n\n'
            f'config = PeftConfig.from_pretrained("{model_id}")\n'
            f'base = AutoModelForCausalLM.from_pretrained(config.base_model_name_or_path)\n'
            f'model = PeftModel.from_pretrained(base, "{model_id}")'
        )

    if "gguf" in tag_set or framework == "gguf":
        snippets["gguf"] = (
            f'from llama_cpp import Llama\n\n'
            f'llm = Llama(model_path="./model.gguf", n_ctx=2048, n_gpu_layers=-1)\n'
            f'output = llm("Hello! ", max_tokens=256)\nprint(output["choices"][0]["text"])'
        )

    if not snippets:
        snippets["generic"] = (
            f'from huggingface_hub import hf_hub_download\n\n'
            f'hf_hub_download(repo_id="{model_id}", filename="config.json")'
        )

    return json.dumps(snippets)


# ── README fetch with retry ──────────────────────────────────────────────

def fetch_readme(model_id: str, session: requests.Session) -> Optional[str]:
    url = f"https://huggingface.co/{model_id}/raw/main/README.md"
    for attempt in range(3):
        try:
            r = session.get(url, timeout=15)
            if r.status_code == 429:
                time.sleep(2 ** attempt * 2)
                continue
            if r.status_code == 200:
                text = r.text
                if text.startswith("---"):
                    end = text.find("---", 3)
                    if end != -1:
                        text = text[end + 3:].strip()
                return text
            return None
        except Exception:
            time.sleep(1)
    return None


# ── Build DB rows from ModelInfo ─────────────────────────────────────────

def build_rows(info: ModelInfo, readme: Optional[str]) -> tuple:
    """Build (repo_row, meta_row) from a huggingface_hub ModelInfo object."""
    model_id = info.id or ""
    repo_id = str(uuid.uuid4()).upper()
    now = datetime.now(timezone.utc).isoformat()

    tags = list(info.tags or [])
    card_data = info.card_data or {}
    if hasattr(card_data, "to_dict"):
        card_data = card_data.to_dict()
    elif not isinstance(card_data, dict):
        card_data = {}
    config = info.config or {}
    if not isinstance(config, dict):
        config = {}
    siblings = list(info.siblings or [])
    safetensors = info.safetensors or {}
    if not isinstance(safetensors, dict):
        safetensors = {}

    slug = model_id.replace("/", "-").lower()
    name = model_id.split("/")[-1] if "/" in model_id else model_id

    framework = detect_framework(tags, config)
    library = detect_library(tags, getattr(info, "library_name", None))
    task = detect_task(info.pipeline_tag, tags)
    architecture = detect_architecture(config)
    language = detect_language(card_data, tags)
    base_model = detect_base_model(card_data, tags)
    param_count = detect_param_count(safetensors, config)
    tensor_type = detect_tensor_type(tags, siblings)
    license_type = detect_license(card_data, tags)
    eval_results = card_data.get("eval_results") or card_data.get("model-index")

    description = ""
    if isinstance(card_data, dict):
        description = card_data.get("summary") or ""

    usage = generate_usage_snippets(model_id, library, info.pipeline_tag, framework, tags)

    # ── File list
    filenames = []
    for s in siblings[:100]:
        fn = s.rfilename if hasattr(s, "rfilename") else (s.get("rfilename") if isinstance(s, dict) else "")
        if fn:
            filenames.append(fn)

    widget_data = json.dumps({
        "huggingface_url": f"https://huggingface.co/{model_id}",
        "files": filenames,
    })

    repo_row = {
        "RepoId": repo_id,
        "OwnerId": OWNER_ID,
        "OwnerType": "user",
        "RepoType": "model",
        "Name": name,
        "Slug": slug,
        "Description": description[:2000] if description else None,
        "Private": 1 if info.private else 0,
        "Gated": normalize_gated(info.gated),
        "PricingModel": "free",
        "Price": 0,
        "LicenseType": license_type,
        "Tags": ",".join(tags[:50]) if tags else None,
        "TotalDownloads": info.downloads or 0,
        "TotalLikes": info.likes or 0,
        "SourceUrl": f"https://huggingface.co/{model_id}",
        "ImportedFrom": "huggingface",
        "LastCommitAt": info.last_modified.isoformat() if info.last_modified else None,
    }

    meta_row = {
        "RepoId": repo_id,
        "Framework": framework,
        "Task": task,
        "Library": library,
        "Architecture": architecture,
        "Language": language,
        "BaseModel": base_model,
        "ParameterCount": param_count,
        "TensorType": tensor_type,
        "SafeTensors": 1 if safetensors.get("total") or safetensors.get("parameters") else 0,
        "PipelineTag": info.pipeline_tag,
        "InferenceEnabled": 1 if getattr(info, "inference", None) else 0,
        "WidgetData": widget_data,
        "EvalResults": json.dumps(eval_results) if eval_results else None,
        "GithubReadme": readme[:50000] if readme else None,
        "UsageGuide": usage,
        "OriginalModelId": model_id,
        "ScraperFetchedAt": now,
        "HostingType": "huggingface",
    }

    return repo_row, meta_row


# ── Main ─────────────────────────────────────────────────────────────────

def main():
    print("=" * 60, flush=True)
    print("retomY HF Import (huggingface_hub library)", flush=True)
    print("=" * 60, flush=True)

    existing = get_existing_slugs()
    print(f"Already in DB: {len(existing)} models\n", flush=True)

    api = HfApi()
    session = requests.Session()

    # ── Phase 1: Collect model IDs using huggingface_hub ──────────────────
    print("Phase 1: Collecting model IDs...", flush=True)
    all_models: Dict[str, str] = {}  # model_id -> pipeline_tag

    for task_tag, limit in CATEGORIES:
        for attempt in range(5):
            try:
                models = list(api.list_models(
                    pipeline_tag=task_tag,
                    sort="downloads",
                    limit=limit,
                ))
                new_count = 0
                for m in models:
                    if m.id and m.id not in all_models:
                        all_models[m.id] = task_tag
                        new_count += 1
                print(f"  {task_tag:<42} {new_count:>4} new ({len(models)} total)", flush=True)
                break
            except Exception as e:
                wait = 2 ** attempt * 3
                print(f"  RETRY {task_tag}: {str(e)[:80]}... waiting {wait}s", flush=True)
                time.sleep(wait)
        else:
            print(f"  SKIP  {task_tag} (all retries failed)", flush=True)
        time.sleep(0.3)  # small pause between categories

    # Filter out already-imported
    to_import = []
    for mid, ptag in all_models.items():
        slug = mid.replace("/", "-").lower()
        if slug not in existing:
            to_import.append((mid, ptag))

    print(f"\nTotal unique: {len(all_models)}", flush=True)
    print(f"Already in DB: {len(all_models) - len(to_import)}", flush=True)
    print(f"To import: {len(to_import)}", flush=True)

    if not to_import:
        print("\nNothing to import!", flush=True)
        return

    # ── Phase 2: Fetch details & insert ──────────────────────────────────
    print(f"\nPhase 2: Importing {len(to_import)} models...\n", flush=True)

    ok = 0
    fail = 0
    skip = 0
    start = time.time()

    for i, (model_id, ptag) in enumerate(to_import):
        slug = model_id.replace("/", "-").lower()
        if slug in existing:
            skip += 1
            continue

        # Fetch detailed model info via huggingface_hub
        info = None
        for attempt in range(5):
            try:
                info = api.model_info(model_id, securityStatus=False)
                break
            except Exception as e:
                es = str(e)
                if "429" in es or "Too Many Requests" in es:
                    wait = 2 ** attempt * 3
                    print(f"  429 on {model_id}, waiting {wait}s...", flush=True)
                    time.sleep(wait)
                elif "404" in es or "not found" in es.lower():
                    break  # model doesn't exist
                else:
                    wait = 2 ** attempt
                    time.sleep(wait)

        if not info:
            fail += 1
            skip_reason = "not found or rate limited"
            if (fail + ok) % 50 == 0:
                print(f"  SKIP {model_id}: {skip_reason}", flush=True)
            continue

        # Fetch README
        readme = fetch_readme(model_id, session)

        # Build rows and insert
        try:
            repo_row, meta_row = build_rows(info, readme)
            db_insert("Repositories", repo_row)
            db_insert("ModelMetadata", meta_row)
            existing.add(slug)
            ok += 1

            fw = meta_row.get("Framework") or "-"
            lib = meta_row.get("Library") or "-"
            params = meta_row.get("ParameterCount")
            has_readme = "Y" if readme else "N"
            print(f"[{ok:>4}] {model_id} | {fw} | {lib} | params={params} | readme={has_readme}", flush=True)

        except Exception as e:
            es = str(e)
            if "UNIQUE" in es or "duplicate" in es.lower():
                existing.add(slug)
                skip += 1
            else:
                fail += 1
                print(f"  ERR {model_id}: {es[:120]}", flush=True)

        # Progress report every 100
        total_done = ok + fail + skip
        if ok > 0 and ok % 100 == 0:
            elapsed = time.time() - start
            rate = ok / elapsed
            remaining = (len(to_import) - total_done) / max(rate, 0.01)
            print(f"\n--- {ok} inserted, {fail} failed, {skip} skipped | "
                  f"{rate:.1f}/s | ~{remaining/60:.0f}min left ---\n", flush=True)

        # Pace to avoid rate limits: 0.4s between models
        time.sleep(0.4)

    elapsed = time.time() - start
    final_count = len(get_existing_slugs())
    print(f"\n{'=' * 60}", flush=True)
    print(f"DONE in {elapsed/60:.1f} min", flush=True)
    print(f"  Inserted:  {ok}", flush=True)
    print(f"  Failed:    {fail}", flush=True)
    print(f"  Skipped:   {skip}", flush=True)
    print(f"  Total in DB: {final_count}", flush=True)
    print("=" * 60, flush=True)


if __name__ == "__main__":
    main()
