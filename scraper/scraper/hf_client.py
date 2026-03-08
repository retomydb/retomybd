"""Rich Hugging Face model metadata client.

Fetches comprehensive model information from the HF Hub API including:
- Full metadata (framework, task, library, architecture, language, etc.)
- README / model card content
- Usage code snippets (transformers, diffusers, sentence-transformers, PEFT, GGUF)
- Downloads, likes, evaluation results, safetensors info
"""

import re
import json
import logging
from typing import Optional, List, Dict, Any

import requests

logger = logging.getLogger(__name__)

# ── Tag / library mappings ────────────────────────────────────────────────────

FRAMEWORK_TAGS = {
    "pytorch", "tf", "tensorflow", "jax", "flax", "onnx", "openvino",
    "tensorrt", "coreml", "paddle", "gguf", "rust", "safetensors",
}

LIBRARY_TAGS = {
    "transformers", "diffusers", "sentence-transformers", "tokenizers",
    "timm", "peft", "adapter-transformers", "spacy", "flair", "allennlp",
    "fairseq", "espnet", "speechbrain", "nemo", "paddlenlp", "stanza",
    "setfit", "span-marker", "scikit-learn", "fasttext", "stable-baselines3",
    "ml-agents", "sample-factory", "open_clip", "bertopic", "keras",
    "fastai", "asteroid", "pyannote-audio", "k2", "mindspore",
}

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


class HFClient:
    """Comprehensive Hugging Face model metadata client."""

    API_BASE = "https://huggingface.co/api/models/"
    RAW_BASE = "https://huggingface.co/{model_id}/raw/main/README.md"

    def __init__(self, token: Optional[str] = None, timeout: int = 15):
        self.session = requests.Session()
        self.timeout = timeout
        if token:
            self.session.headers["Authorization"] = f"Bearer {token}"

    # ── Core fetch ────────────────────────────────────────────────────────

    def fetch_model(self, model_id: str) -> dict:
        """Fetch rich model metadata from the HF Hub API.

        Returns a comprehensive dict with all extracted fields.
        """
        url = self.API_BASE + model_id
        r = self.session.get(url, timeout=self.timeout)
        r.raise_for_status()
        data = r.json()

        tags = data.get("tags") or []
        card_data = data.get("cardData") or {}
        config = data.get("config") or {}
        siblings = data.get("siblings") or []
        safetensors = data.get("safetensors") or {}

        # Detect fields from tags & config
        framework = self._detect_framework(tags, config)
        library = self._detect_library(tags, data)
        task = self._detect_task(data, tags)
        architecture = self._detect_architecture(config)
        language = self._detect_language(card_data, tags)
        base_model = self._detect_base_model(card_data, tags)
        param_count = self._detect_param_count(safetensors, config, data)
        tensor_type = self._detect_tensor_type(tags, siblings)
        license_id = self._detect_license(card_data, tags)
        eval_results = card_data.get("eval_results") or card_data.get("model-index")

        # Fetch README separately
        readme = self.fetch_readme(model_id)

        # Generate usage snippets
        usage = self.generate_usage_snippets(
            model_id=model_id,
            library=library,
            task=data.get("pipeline_tag"),
            framework=framework,
            tags=tags,
        )

        return {
            # Identifiers
            "model_id": data.get("id") or model_id,
            "name": (data.get("id") or model_id).split("/")[-1],
            # Basic info
            "pipeline_tag": data.get("pipeline_tag"),
            "tags": tags,
            "description": card_data.get("summary") or "",
            "private": data.get("private", False),
            "gated": data.get("gated", False),
            "lastModified": data.get("lastModified"),
            "created_at": data.get("createdAt"),
            # Stats
            "downloads": data.get("downloads") or 0,
            "downloads_all_time": data.get("downloadsAllTime") or data.get("downloads") or 0,
            "likes": data.get("likes") or 0,
            # Extracted metadata
            "framework": framework,
            "library": library,
            "task": task,
            "architecture": architecture,
            "language": language,
            "base_model": base_model,
            "parameter_count": param_count,
            "tensor_type": tensor_type,
            "license": license_id,
            "safetensors": bool(safetensors.get("total") or safetensors.get("parameters")),
            "inference_enabled": bool(data.get("inference")),
            # Rich content
            "readme": readme,
            "usage_snippets": usage,
            "eval_results": eval_results,
            "widget_data": data.get("widgetData"),
            # Files summary
            "files": [s.get("rfilename") for s in siblings if s.get("rfilename")],
            "card_data": card_data,
            # Source URL
            "source_url": f"https://huggingface.co/{model_id}",
            # Raw API response for archival
            "raw": data,
        }

    # ── README ────────────────────────────────────────────────────────────

    def fetch_readme(self, model_id: str) -> Optional[str]:
        """Fetch the raw README.md (model card) content."""
        url = self.RAW_BASE.format(model_id=model_id)
        try:
            r = self.session.get(url, timeout=self.timeout)
            if r.status_code == 200:
                text = r.text
                # Strip YAML front matter if present
                if text.startswith("---"):
                    end = text.find("---", 3)
                    if end != -1:
                        text = text[end + 3:].strip()
                return text
            return None
        except Exception as e:
            logger.warning("Failed to fetch README for %s: %s", model_id, e)
            return None

    # ── Usage snippets ────────────────────────────────────────────────────

    def generate_usage_snippets(
        self,
        model_id: str,
        library: Optional[str],
        task: Optional[str],
        framework: Optional[str],
        tags: List[str],
    ) -> str:
        """Generate usage code snippets as a JSON string.

        Returns a JSON object with keys like 'pipeline', 'direct', 'diffusers', etc.
        """
        snippets: Dict[str, str] = {}

        lib = (library or "").lower()
        task_tag = (task or "").lower()
        tag_set = {t.lower() for t in tags}

        # ── Transformers ──────────────────────────────────────────────────
        if lib in ("transformers", "") or "transformers" in tag_set:
            # Pipeline snippet
            if task_tag:
                snippets["pipeline"] = (
                    f'from transformers import pipeline\n\n'
                    f'pipe = pipeline("{task_tag}", model="{model_id}")\n'
                    f'result = pipe("Your input text here")\n'
                    f'print(result)'
                )

            # Direct loading snippet
            auto_class = self._auto_class_for_task(task_tag)
            snippets["direct"] = (
                f'from transformers import AutoTokenizer, {auto_class}\n\n'
                f'tokenizer = AutoTokenizer.from_pretrained("{model_id}")\n'
                f'model = {auto_class}.from_pretrained("{model_id}")\n\n'
                f'inputs = tokenizer("Your input text here", return_tensors="pt")\n'
                f'outputs = model(**inputs)'
            )

        # ── Diffusers ─────────────────────────────────────────────────────
        if lib == "diffusers" or "diffusers" in tag_set:
            pipe_class = "StableDiffusionPipeline"
            if "stable-diffusion-xl" in tag_set or "sdxl" in tag_set:
                pipe_class = "StableDiffusionXLPipeline"
            elif "flux" in model_id.lower():
                pipe_class = "FluxPipeline"

            snippets["diffusers"] = (
                f'from diffusers import {pipe_class}\nimport torch\n\n'
                f'pipe = {pipe_class}.from_pretrained(\n'
                f'    "{model_id}",\n'
                f'    torch_dtype=torch.float16\n'
                f')\n'
                f'pipe = pipe.to("cuda")\n\n'
                f'image = pipe("A beautiful sunset over the mountains").images[0]\n'
                f'image.save("output.png")'
            )

        # ── Sentence-Transformers ─────────────────────────────────────────
        if lib == "sentence-transformers" or "sentence-transformers" in tag_set:
            snippets["sentence_transformers"] = (
                f'from sentence_transformers import SentenceTransformer\n\n'
                f'model = SentenceTransformer("{model_id}")\n\n'
                f'sentences = ["This is an example sentence", "Each sentence is converted"]\n'
                f'embeddings = model.encode(sentences)\n'
                f'print(embeddings.shape)'
            )

        # ── PEFT / LoRA ──────────────────────────────────────────────────
        if lib == "peft" or "peft" in tag_set or "lora" in tag_set:
            snippets["peft"] = (
                f'from peft import PeftModel, PeftConfig\n'
                f'from transformers import AutoModelForCausalLM, AutoTokenizer\n\n'
                f'config = PeftConfig.from_pretrained("{model_id}")\n'
                f'base_model = AutoModelForCausalLM.from_pretrained(config.base_model_name_or_path)\n'
                f'model = PeftModel.from_pretrained(base_model, "{model_id}")\n'
                f'tokenizer = AutoTokenizer.from_pretrained(config.base_model_name_or_path)'
            )

        # ── GGUF ─────────────────────────────────────────────────────────
        if "gguf" in tag_set or framework == "gguf":
            snippets["gguf"] = (
                f'# Install: pip install llama-cpp-python\n'
                f'from llama_cpp import Llama\n\n'
                f'# Download the GGUF file from https://huggingface.co/{model_id}\n'
                f'llm = Llama(\n'
                f'    model_path="./model.gguf",\n'
                f'    n_ctx=2048,\n'
                f'    n_gpu_layers=-1  # Use GPU acceleration\n'
                f')\n\n'
                f'output = llm("Hello! ", max_tokens=256)\n'
                f'print(output["choices"][0]["text"])'
            )

        # ── Generic fallback ─────────────────────────────────────────────
        if not snippets:
            snippets["generic"] = (
                f'# Visit https://huggingface.co/{model_id} for usage instructions\n'
                f'# pip install huggingface_hub\n'
                f'from huggingface_hub import hf_hub_download\n\n'
                f'hf_hub_download(repo_id="{model_id}", filename="config.json")'
            )

        return json.dumps(snippets)

    # ── Detection helpers ─────────────────────────────────────────────────

    def _detect_framework(self, tags: List[str], config: dict) -> Optional[str]:
        tag_set = {t.lower() for t in tags}
        for fw in ["pytorch", "tf", "tensorflow", "jax", "flax", "onnx", "gguf",
                    "openvino", "tensorrt", "coreml", "paddle"]:
            if fw in tag_set:
                return fw
        # infer from config
        if config.get("torch_dtype"):
            return "pytorch"
        return None

    def _detect_library(self, tags: List[str], data: dict) -> Optional[str]:
        # HF API often provides library_name directly
        lib = data.get("library_name")
        if lib:
            return lib
        tag_set = {t.lower() for t in tags}
        for lib_tag in sorted(LIBRARY_TAGS):
            if lib_tag in tag_set:
                return lib_tag
        return None

    def _detect_task(self, data: dict, tags: List[str]) -> Optional[str]:
        pt = data.get("pipeline_tag")
        if pt and pt in TASK_MAP:
            return TASK_MAP[pt]
        if pt:
            return pt.replace("-", " ").title()
        # fall back to tags
        tag_set = {t.lower() for t in tags}
        for raw_task, display in TASK_MAP.items():
            if raw_task in tag_set:
                return display
        return None

    def _detect_architecture(self, config: dict) -> Optional[str]:
        # config.architectures is a list like ["LlamaForCausalLM"]
        archs = config.get("architectures")
        if archs and isinstance(archs, list):
            return ", ".join(archs)
        model_type = config.get("model_type")
        if model_type:
            return model_type
        return None

    def _detect_language(self, card_data: dict, tags: List[str]) -> Optional[str]:
        lang = card_data.get("language")
        if lang:
            if isinstance(lang, list):
                return ", ".join(lang[:5])
            return str(lang)
        # Check tags for language codes
        lang_pattern = re.compile(r'^[a-z]{2}$')
        lang_tags = [t for t in tags if lang_pattern.match(t)]
        if lang_tags:
            return ", ".join(lang_tags[:5])
        return None

    def _detect_base_model(self, card_data: dict, tags: List[str]) -> Optional[str]:
        bm = card_data.get("base_model")
        if bm:
            if isinstance(bm, list):
                return bm[0] if bm else None
            return str(bm)
        # Look for base_model in tags
        for t in tags:
            if t.startswith("base_model:"):
                return t.split(":", 1)[1]
        return None

    def _detect_param_count(self, safetensors: dict, config: dict, data: dict) -> Optional[int]:
        # safetensors.parameters often has the total
        params = safetensors.get("total")
        if params:
            return int(params)
        # check nested safetensors parameters
        st_params = safetensors.get("parameters")
        if isinstance(st_params, dict):
            total = sum(v for v in st_params.values() if isinstance(v, (int, float)))
            if total > 0:
                return int(total)
        # Fallback: cardData
        card_params = (data.get("cardData") or {}).get("parameter_count")
        if card_params:
            return int(card_params)
        return None

    def _detect_tensor_type(self, tags: List[str], siblings: list) -> Optional[str]:
        tag_set = {t.lower() for t in tags}
        types = []
        if "safetensors" in tag_set or any(
            s.get("rfilename", "").endswith(".safetensors") for s in siblings
        ):
            types.append("safetensors")
        if any(s.get("rfilename", "").endswith(".bin") for s in siblings):
            types.append("pytorch")
        if "gguf" in tag_set or any(
            s.get("rfilename", "").endswith(".gguf") for s in siblings
        ):
            types.append("gguf")
        if any(s.get("rfilename", "").endswith(".onnx") for s in siblings):
            types.append("onnx")
        return ", ".join(types) if types else None

    def _detect_license(self, card_data: dict, tags: List[str]) -> Optional[str]:
        lic = card_data.get("license")
        if lic:
            if isinstance(lic, list):
                return lic[0] if lic else None
            return str(lic)
        for t in tags:
            if t.startswith("license:"):
                return t.split(":", 1)[1]
        return None

    @staticmethod
    def _auto_class_for_task(task: str) -> str:
        """Map a pipeline task to the best AutoModel class."""
        mapping = {
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
        return mapping.get(task, "AutoModel")
