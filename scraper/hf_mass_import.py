#!/usr/bin/env python3
"""
Mass HuggingFace importer — discover + enqueue + worker for 1M+ models.

Architecture (same pattern as GitHub / Replicate workers):
  Phase 1 – discover:  stream HF Hub listing → Redis queue  (≈2-3 min for 1M)
  Phase 2 – work:      pop from queue → build rows → fetch README → DB insert

All rich metadata comes from the listing itself (tags, config, card_data,
safetensors, siblings, eval_results …) so per-model API calls are only
needed for the README.

Usage:
  # Discover – enqueue all HF models into Redis
  .venv/bin/python scraper/hf_mass_import.py discover \
      --redis-url redis://localhost:6379/0 --queue hf_models --limit 0

  # Work – consume queue and insert into DB
  .venv/bin/python scraper/hf_mass_import.py work \
      --redis-url redis://localhost:6379/0 --queue hf_models --max-jobs 0
"""

import argparse
import json
import os
import re
import sys
import time
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict

import requests

try:
    import redis as redis_lib
except ImportError:
    redis_lib = None

try:
    import pyodbc
except ImportError:
    pyodbc = None

from huggingface_hub import HfApi, ModelInfo

# ── Constants ──────────────────────────────────────────────────────────────
CONN_STR = (
    "DRIVER={ODBC Driver 18 for SQL Server};"
    "SERVER=localhost,1433;DATABASE=retomY;"
    "UID=sa;PWD=Prestige@123;"
    "TrustServerCertificate=yes;Encrypt=yes;"
)
OWNER_ID = "84C9D1F7-F3B0-46B3-9BA5-1441887D9F5B"
STATS_INTERVAL = 200

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
    "mask-generation": "Mask Generation",
    "any-to-any": "Any-to-Any",
    "image-text-to-text": "Image-Text-to-Text",
    "audio-to-audio": "Audio-to-Audio",
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


# ═══════════════════════════════════════════════════════════════════════════
#  DB helpers
# ═══════════════════════════════════════════════════════════════════════════

def _connect_db(conn_str: str = CONN_STR):
    return pyodbc.connect(conn_str, autocommit=False, timeout=30)


def _is_conn_error(exc):
    code = getattr(exc, "args", [None])[0] if exc.args else None
    return code in ("08S01", "08001", "HYT00", "HY000", "01000") or "closed" in str(exc).lower()


def _ensure_conn(conn, conn_str: str = CONN_STR):
    if conn is not None:
        try:
            conn.execute("SELECT 1")
            return conn
        except Exception:
            try:
                conn.close()
            except Exception:
                pass
    return _connect_db(conn_str)


def get_existing_model_ids(conn) -> set:
    """Return set of OriginalModelId for HF models already in DB."""
    cur = conn.cursor()
    cur.execute("""
        SELECT OriginalModelId FROM retomy.ModelMetadata
        WHERE HostingType = 'huggingface' AND OriginalModelId IS NOT NULL
    """)
    return {r[0] for r in cur.fetchall()}


# ═══════════════════════════════════════════════════════════════════════════
#  Metadata extraction  (copied from hf_import.py build_rows logic)
# ═══════════════════════════════════════════════════════════════════════════

def _normalize_gated(value) -> str:
    if isinstance(value, str) and value in ('none', 'auto', 'manual'):
        return value
    if value is True:
        return 'manual'
    return 'none'


def _detect_framework(tags, config):
    tag_set = {t.lower() for t in tags}
    for fw in ["pytorch", "tf", "tensorflow", "jax", "flax", "onnx", "gguf",
               "openvino", "tensorrt", "coreml", "paddle"]:
        if fw in tag_set:
            return fw
    if isinstance(config, dict) and config.get("torch_dtype"):
        return "pytorch"
    return None


def _detect_library(tags, library_name):
    if library_name:
        return library_name
    LIBS = {
        "transformers", "diffusers", "sentence-transformers", "tokenizers",
        "timm", "peft", "adapter-transformers", "spacy", "flair",
        "fairseq", "espnet", "speechbrain", "nemo", "paddlenlp",
        "setfit", "span-marker", "scikit-learn", "fasttext",
        "stable-baselines3", "open_clip", "keras", "fastai",
    }
    tag_set = {t.lower() for t in tags}
    for lib in sorted(LIBS):
        if lib in tag_set:
            return lib
    return None


def _detect_task(pipeline_tag, tags):
    if pipeline_tag and pipeline_tag in TASK_MAP:
        return TASK_MAP[pipeline_tag]
    if pipeline_tag:
        return pipeline_tag.replace("-", " ").title()
    tag_set = {t.lower() for t in tags}
    for raw, display in TASK_MAP.items():
        if raw in tag_set:
            return display
    return None


def _detect_architecture(config):
    if not isinstance(config, dict):
        return None
    archs = config.get("architectures")
    if archs and isinstance(archs, list):
        return ", ".join(archs)
    mt = config.get("model_type")
    return mt if mt else None


def _detect_language(card_data, tags):
    if not isinstance(card_data, dict):
        return None
    lang = card_data.get("language")
    if lang:
        if isinstance(lang, list):
            return ", ".join(str(l) for l in lang[:5])
        return str(lang)
    pat = re.compile(r"^[a-z]{2}$")
    langs = [t for t in tags if pat.match(t)]
    return ", ".join(langs[:5]) if langs else None


def _detect_base_model(card_data, tags):
    if isinstance(card_data, dict):
        bm = card_data.get("base_model")
        if bm:
            return bm[0] if isinstance(bm, list) else str(bm)
    for t in tags:
        if t.startswith("base_model:"):
            return t.split(":", 1)[1]
    return None


def _detect_param_count(safetensors, config):
    if isinstance(safetensors, dict):
        total = safetensors.get("total")
        if total:
            return int(total)
        params = safetensors.get("parameters")
        if isinstance(params, dict):
            s = sum(v for v in params.values() if isinstance(v, (int, float)))
            if s > 0:
                return int(s)
    return None


def _detect_tensor_type(tags, siblings):
    tag_set = {t.lower() for t in tags}
    types = []
    filenames = []
    for s in siblings:
        fn = s.rfilename if hasattr(s, "rfilename") else (s.get("rfilename") if isinstance(s, dict) else "")
        if fn:
            filenames.append(fn)
    if "safetensors" in tag_set or any(f.endswith(".safetensors") for f in filenames):
        types.append("safetensors")
    if any(f.endswith(".bin") for f in filenames):
        types.append("pytorch")
    if "gguf" in tag_set or any(f.endswith(".gguf") for f in filenames):
        types.append("gguf")
    if any(f.endswith(".onnx") for f in filenames):
        types.append("onnx")
    return ", ".join(types) if types else None


def _detect_license(card_data, tags):
    if isinstance(card_data, dict):
        lic = card_data.get("license")
        if lic:
            return lic[0] if isinstance(lic, list) else str(lic)
    for t in tags:
        if t.startswith("license:"):
            return t.split(":", 1)[1]
    return None


def _generate_usage(model_id, library, pipeline_tag, framework, tags):
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
        pc = "StableDiffusionPipeline"
        if "stable-diffusion-xl" in tag_set or "sdxl" in tag_set:
            pc = "StableDiffusionXLPipeline"
        elif "flux" in model_id.lower():
            pc = "FluxPipeline"
        snippets["diffusers"] = (
            f'from diffusers import {pc}\nimport torch\n\n'
            f'pipe = {pc}.from_pretrained("{model_id}", torch_dtype=torch.float16)\n'
            f'pipe = pipe.to("cuda")\n'
            f'image = pipe("A beautiful sunset").images[0]\nimage.save("output.png")'
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


# ═══════════════════════════════════════════════════════════════════════════
#  README fetch
# ═══════════════════════════════════════════════════════════════════════════

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
                return text[:50000]  # cap
            return None
        except Exception:
            time.sleep(1)
    return None


# ═══════════════════════════════════════════════════════════════════════════
#  Build DB rows from serialized job
# ═══════════════════════════════════════════════════════════════════════════

def build_rows_from_job(job: dict, readme: Optional[str]):
    """Build (repo_row, meta_row) from a queue job dict.

    The job contains serialized ModelInfo fields saved during discovery.
    """
    model_id = job["model_id"]
    repo_id = str(uuid.uuid4()).upper()
    now = datetime.now(timezone.utc).isoformat()

    tags = job.get("tags") or []
    card_data = job.get("card_data") or {}
    config = job.get("config") or {}
    siblings = job.get("siblings") or []
    safetensors = job.get("safetensors") or {}
    pipeline_tag = job.get("pipeline_tag")
    library_name = job.get("library_name")

    slug = model_id.replace("/", "-").lower()
    name = model_id.split("/")[-1] if "/" in model_id else model_id

    framework = _detect_framework(tags, config)
    library = _detect_library(tags, library_name)
    task = _detect_task(pipeline_tag, tags)
    architecture = _detect_architecture(config)
    language = _detect_language(card_data, tags)
    base_model = _detect_base_model(card_data, tags)
    param_count = _detect_param_count(safetensors, config)
    tensor_type = _detect_tensor_type(tags, siblings)
    license_type = _detect_license(card_data, tags)
    eval_results = card_data.get("eval_results") or card_data.get("model-index") if isinstance(card_data, dict) else None

    description = ""
    if isinstance(card_data, dict):
        description = card_data.get("summary") or ""

    usage = _generate_usage(model_id, library, pipeline_tag, framework, tags)

    filenames = []
    for s in siblings[:100]:
        fn = s.get("rfilename") if isinstance(s, dict) else (getattr(s, "rfilename", "") if hasattr(s, "rfilename") else "")
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
        "Private": 1 if job.get("private") else 0,
        "Gated": _normalize_gated(job.get("gated")),
        "PricingModel": "free",
        "Price": 0,
        "LicenseType": (license_type or "")[:50] if license_type else None,
        "Tags": ",".join(tags[:50]) if tags else None,
        "TotalDownloads": job.get("downloads") or 0,
        "TotalLikes": job.get("likes") or 0,
        "SourceUrl": f"https://huggingface.co/{model_id}",
        "ImportedFrom": "huggingface",
        "LastCommitAt": job.get("last_modified"),
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
        "SafeTensors": 1 if (isinstance(safetensors, dict) and (safetensors.get("total") or safetensors.get("parameters"))) else 0,
        "PipelineTag": pipeline_tag,
        "InferenceEnabled": 1 if job.get("inference") else 0,
        "WidgetData": widget_data,
        "EvalResults": json.dumps(eval_results) if eval_results else None,
        "GithubReadme": readme,
        "UsageGuide": usage,
        "OriginalModelId": model_id,
        "ScraperFetchedAt": now,
        "HostingType": "huggingface",
    }

    return repo_row, meta_row


# ═══════════════════════════════════════════════════════════════════════════
#  DB insert
# ═══════════════════════════════════════════════════════════════════════════

def db_insert_rows(conn, repo_row: dict, meta_row: dict) -> str:
    """Insert repo + metadata rows. Returns 'ok' / 'skip' / 'error:...'."""
    max_attempts = 2
    for attempt in range(max_attempts):
        try:
            cur = conn.cursor()

            # ── Duplicate check ──
            cur.execute("""
                SELECT 1 FROM retomy.ModelMetadata
                WHERE HostingType = 'huggingface' AND OriginalModelId = ?
            """, [meta_row["OriginalModelId"]])
            if cur.fetchone():
                return "skip"

            # ── Insert Repositories ──
            cols = ", ".join(repo_row.keys())
            ph = ", ".join(["?"] * len(repo_row))
            try:
                cur.execute(f"INSERT INTO retomy.Repositories ({cols}) VALUES ({ph})",
                            list(repo_row.values()))
                conn.commit()
            except pyodbc.IntegrityError:
                conn.rollback()
                # slug collision — append repo_id suffix
                repo_row["Slug"] = f"{repo_row['Slug']}-{repo_row['RepoId'][:8].lower()}"
                cols = ", ".join(repo_row.keys())
                ph = ", ".join(["?"] * len(repo_row))
                cur.execute(f"INSERT INTO retomy.Repositories ({cols}) VALUES ({ph})",
                            list(repo_row.values()))
                conn.commit()

            # ── Insert ModelMetadata ──
            cols = ", ".join(meta_row.keys())
            ph = ", ".join(["?"] * len(meta_row))
            cur.execute(f"INSERT INTO retomy.ModelMetadata ({cols}) VALUES ({ph})",
                        list(meta_row.values()))
            conn.commit()
            return "ok"

        except pyodbc.Error as e:
            if attempt < max_attempts - 1 and _is_conn_error(e):
                print(f"  DB conn error (reconnecting): {e}")
                try:
                    conn.close()
                except Exception:
                    pass
                conn = _connect_db()
                continue
            try:
                conn.rollback()
            except Exception:
                pass
            return f"error:db:{e}"

    return "error:db:exhausted_retries"


# ═══════════════════════════════════════════════════════════════════════════
#  Serialise ModelInfo → compact job dict for Redis
# ═══════════════════════════════════════════════════════════════════════════

def _serialise_info(info: ModelInfo) -> dict:
    """Convert ModelInfo to a JSON-safe dict with only the fields we need."""
    tags = list(info.tags or [])

    card_data = info.card_data or {}
    if hasattr(card_data, "to_dict"):
        card_data = card_data.to_dict()
    elif not isinstance(card_data, dict):
        card_data = {}

    config = info.config or {}
    if not isinstance(config, dict):
        config = {}

    # Siblings: only keep rfilename to save space
    siblings = []
    for s in list(info.siblings or [])[:100]:
        fn = s.rfilename if hasattr(s, "rfilename") else (s.get("rfilename") if isinstance(s, dict) else "")
        if fn:
            siblings.append({"rfilename": fn})

    safetensors = info.safetensors or {}
    if not isinstance(safetensors, dict):
        safetensors = {}

    return {
        "model_id": info.id or "",
        "pipeline_tag": info.pipeline_tag,
        "library_name": getattr(info, "library_name", None),
        "tags": tags,
        "card_data": card_data,
        "config": config,
        "siblings": siblings,
        "safetensors": safetensors,
        "downloads": info.downloads or 0,
        "likes": info.likes or 0,
        "private": info.private,
        "gated": info.gated if isinstance(info.gated, (bool, str)) else False,
        "inference": bool(getattr(info, "inference", None)),
        "last_modified": info.last_modified.isoformat() if info.last_modified else None,
    }


# ═══════════════════════════════════════════════════════════════════════════
#  DISCOVER command
# ═══════════════════════════════════════════════════════════════════════════

def cmd_discover(args):
    api = HfApi()
    r = redis_lib.from_url(args.redis_url)

    # Load existing IDs from DB to avoid queueing duplicates
    print("Loading existing HF model IDs from DB...", flush=True)
    conn = _connect_db()
    existing = get_existing_model_ids(conn)
    conn.close()
    print(f"  {len(existing):,} already in DB", flush=True)

    print(f"Streaming HF model listing (limit={args.limit or 'unlimited'})...", flush=True)

    t0 = time.time()
    total = 0
    enqueued = 0
    skipped = 0

    limit = args.limit if args.limit else None

    for info in api.list_models(sort="downloads", limit=limit):
        total += 1
        model_id = info.id or ""
        if not model_id:
            continue

        # Skip if already in DB
        if model_id in existing:
            skipped += 1
            if total % 50000 == 0:
                elapsed = time.time() - t0
                print(f"  [discover] scanned {total:,} | enqueued {enqueued:,} | skipped {skipped:,} "
                      f"| {total/elapsed:.0f}/s", flush=True)
            continue

        job = _serialise_info(info)
        try:
            r.rpush(args.queue, json.dumps(job, ensure_ascii=False, default=str))
        except Exception as e:
            print(f"Redis error: {e}", flush=True)
            sys.exit(1)

        enqueued += 1

        if total % 50000 == 0:
            elapsed = time.time() - t0
            print(f"  [discover] scanned {total:,} | enqueued {enqueued:,} | skipped {skipped:,} "
                  f"| {total/elapsed:.0f}/s", flush=True)

    elapsed = time.time() - t0
    print(f"\n[DONE discover] scanned {total:,} | enqueued {enqueued:,} | "
          f"skipped {skipped:,} | {elapsed:.0f}s", flush=True)


# ═══════════════════════════════════════════════════════════════════════════
#  WORK command
# ═══════════════════════════════════════════════════════════════════════════

def cmd_work(args):
    r = redis_lib.from_url(args.redis_url)
    wid = getattr(args, 'worker_id', 1)
    prefix = f"[W{wid}]" if wid > 1 else ""
    conn = _connect_db()
    print(f"{prefix} DB connected", flush=True)

    session = requests.Session()

    processed = ok = skip = err = 0
    readme_ok = readme_fail = 0
    t0 = time.time()

    while True:
        item = r.lpop(args.queue)
        if item is None:
            if args.exit_empty:
                print("Queue empty, exiting", flush=True)
                break
            time.sleep(1)
            continue

        try:
            job = json.loads(item)
        except Exception:
            err += 1
            continue

        model_id = job.get("model_id")
        if not model_id:
            err += 1
            continue

        # ── Fetch README ──
        readme = None
        if not args.skip_readme:
            readme = fetch_readme(model_id, session)
            if readme:
                readme_ok += 1
            else:
                readme_fail += 1

        # ── Build rows & insert ──
        try:
            repo_row, meta_row = build_rows_from_job(job, readme)
        except Exception as e:
            err += 1
            print(f"  build_rows error for {model_id}: {e}", flush=True)
            continue

        conn = _ensure_conn(conn)
        result = db_insert_rows(conn, repo_row, meta_row)

        processed += 1
        if result == "ok":
            ok += 1
        elif result == "skip":
            skip += 1
        else:
            err += 1
            if err <= 20:
                print(f"  {result} for {model_id}", flush=True)

        # ── Stats ──
        if processed % STATS_INTERVAL == 0:
            elapsed = time.time() - t0
            rate = int(processed / elapsed * 3600) if elapsed > 0 else 0
            qlen = r.llen(args.queue)
            print(f"{prefix}[stats] Processed: {processed:,} | OK: {ok:,} | Skip: {skip:,} "
                  f"| Err: {err:,} | README: {readme_ok:,}/{readme_ok+readme_fail:,} "
                  f"| Rate: {rate:,}/hr | Queue: {qlen:,}", flush=True)

        if args.max_jobs and processed >= args.max_jobs:
            break

        # Small pace to avoid hammering HF for READMEs
        if not args.skip_readme and args.sleep > 0:
            time.sleep(args.sleep)

    elapsed = time.time() - t0
    rate = int(processed / elapsed * 3600) if elapsed > 0 else 0
    print(f"\n{prefix}[DONE] Processed: {processed:,} | OK: {ok:,} | Skip: {skip:,} "
          f"| Err: {err:,} | Rate: {rate:,}/hr | Elapsed: {elapsed:.0f}s", flush=True)

    if conn:
        try:
            conn.close()
        except Exception:
            pass


# ═══════════════════════════════════════════════════════════════════════════
#  CLI
# ═══════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="Mass HuggingFace importer")
    sub = parser.add_subparsers(dest="command")

    # discover
    p_disc = sub.add_parser("discover", help="Stream HF listing → Redis queue")
    p_disc.add_argument("--redis-url", default="redis://localhost:6379/0")
    p_disc.add_argument("--queue", default="hf_models")
    p_disc.add_argument("--limit", type=int, default=0,
                        help="Max models to scan (0 = all)")

    # work
    p_work = sub.add_parser("work", help="Consume queue → DB")
    p_work.add_argument("--redis-url", default="redis://localhost:6379/0")
    p_work.add_argument("--queue", default="hf_models")
    p_work.add_argument("--max-jobs", type=int, default=0, help="0 = infinite")
    p_work.add_argument("--exit-empty", action="store_true")
    p_work.add_argument("--skip-readme", action="store_true",
                        help="Skip README fetching (faster, less data)")
    p_work.add_argument("--sleep", type=float, default=0.05,
                        help="Seconds to sleep between jobs (default 0.05)")
    p_work.add_argument("--worker-id", type=int, default=1,
                        help="Worker ID for log prefix (default 1)")

    args = parser.parse_args()

    if args.command == "discover":
        if redis_lib is None:
            print("redis package not installed")
            sys.exit(1)
        cmd_discover(args)

    elif args.command == "work":
        if redis_lib is None:
            print("redis package not installed")
            sys.exit(1)
        if pyodbc is None:
            print("pyodbc package not installed")
            sys.exit(1)
        cmd_work(args)

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
