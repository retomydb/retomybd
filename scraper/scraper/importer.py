import uuid
import json
from datetime import datetime, timezone
from typing import List, Optional

from scraper.hf_client import HFClient


class HFImporter:
    """Import models from Hugging Face with comprehensive metadata."""

    def __init__(self, hf_token: Optional[str] = None):
        self.client = HFClient(token=hf_token)

    def _slugify(self, model_id: str) -> str:
        return model_id.replace('/', '-').lower()

    @staticmethod
    def _normalize_gated(value) -> str:
        """Convert HF gated field to DB-compatible value ('none'/'auto'/'manual')."""
        if isinstance(value, str) and value in ('none', 'auto', 'manual'):
            return value
        if value is True:
            return 'manual'
        return 'none'

    def prepare_rows(self, model_id: str) -> tuple:
        """Return (repo_row, meta_row) prepared from HF metadata.

        These rows match the column names in the database (keys are column names).
        All available metadata fields are populated from the rich HF API response.
        """
        data = self.client.fetch_model(model_id)
        repo_id = str(uuid.uuid4()).upper()
        now = datetime.now(timezone.utc).isoformat()

        name = data.get("name") or model_id.split("/")[-1]
        slug = self._slugify(model_id)
        description = data.get("description") or ""
        tags = data.get("tags") or []
        license_type = data.get("license")

        # ── Repositories row ─────────────────────────────────────────────
        repo_row = {
            "RepoId": repo_id,
            "OwnerId": None,  # Set by caller
            "OwnerType": "user",
            "RepoType": "model",
            "Name": name,
            "Slug": slug,
            "Description": description[:2000] if description else None,
            "Private": 1 if data.get("private") else 0,
            "Gated": self._normalize_gated(data.get("gated")),
            "PricingModel": "free",
            "Price": 0,
            "LicenseType": license_type,
            "Tags": ",".join(tags[:50]) if tags else None,
            "TotalDownloads": data.get("downloads") or 0,
            "TotalLikes": data.get("likes") or 0,
            "SourceUrl": data.get("source_url"),
            "ImportedFrom": "huggingface",
            "LastCommitAt": data.get("lastModified"),
        }

        # ── ModelMetadata row ────────────────────────────────────────────
        readme = data.get("readme")
        usage_snippets = data.get("usage_snippets")
        eval_results = data.get("eval_results")

        # Build widget data with essential HF info
        widget = {
            "huggingface_url": data.get("source_url"),
            "files": data.get("files", [])[:100],  # cap to avoid huge blobs
        }
        if data.get("widget_data"):
            widget["hf_widget"] = data["widget_data"]

        meta_row = {
            "RepoId": repo_id,
            "Framework": data.get("framework"),
            "Task": data.get("task"),
            "Library": data.get("library"),
            "Architecture": data.get("architecture"),
            "Language": data.get("language"),
            "BaseModel": data.get("base_model"),
            "ParameterCount": data.get("parameter_count"),
            "TensorType": data.get("tensor_type"),
            "SafeTensors": 1 if data.get("safetensors") else 0,
            "PipelineTag": data.get("pipeline_tag"),
            "InferenceEnabled": 1 if data.get("inference_enabled") else 0,
            "WidgetData": json.dumps(widget),
            "EvalResults": json.dumps(eval_results) if eval_results else None,
            "GithubReadme": readme[:50000] if readme else None,  # cap large READMEs
            "UsageGuide": usage_snippets,  # already JSON string
            "OriginalModelId": data.get("model_id"),
            "ScraperFetchedAt": now,
            "HostingType": "huggingface",
        }

        return repo_row, meta_row

    def run(self, model_ids: List[str], dry_run: bool = True,
            owner_id: Optional[str] = None, limit: Optional[int] = None):
        """Run importer for given model ids.

        - `dry_run=True` prints the rows that would be inserted.
        - If `dry_run=False`, `owner_id` must be provided and inserts will be attempted.
        """
        out = []
        for i, mid in enumerate(model_ids):
            if limit and i >= limit:
                break
            try:
                print(f"[{i+1}/{len(model_ids)}] Fetching {mid}...")
                repo_row, meta_row = self.prepare_rows(mid)
                if not dry_run:
                    if not owner_id:
                        raise RuntimeError("owner_id is required when applying changes")
                    repo_row["OwnerId"] = owner_id
                    from scraper import db
                    db.insert_into_table('Repositories', repo_row)
                    db.insert_into_table('ModelMetadata', meta_row)
                    out.append({"model": mid, "repo_id": repo_row["RepoId"], "inserted": True})
                    print(f"  ✓ Inserted {mid} → {repo_row['RepoId']}")
                else:
                    out.append({"model": mid, "repo_row": repo_row, "meta_row": meta_row})
                    print(f"  [dry-run] {mid}: framework={meta_row['Framework']}, "
                          f"task={meta_row['Task']}, lib={meta_row['Library']}, "
                          f"params={meta_row['ParameterCount']}, "
                          f"readme={'yes' if meta_row['GithubReadme'] else 'no'}, "
                          f"usage={'yes' if meta_row['UsageGuide'] else 'no'}")
            except Exception as e:
                out.append({"model": mid, "error": str(e)})
                print(f"  ✗ Error: {e}")
        return out


def import_from_file(path: str) -> List[str]:
    with open(path, 'r', encoding='utf8') as f:
        lines = [l.strip() for l in f if l.strip()]
    return lines


class ScrapedImporter:
    """Importer for locally scraped model metadata (JSON).

    Expects each item to be a dict with at least `model_id` or `id`, `name`, and optional
    keys similar to HF metadata: `description`, `tags`, `private`, `pipeline_tag`, `raw`.
    """

    def __init__(self):
        pass

    def _slugify(self, model_id: str) -> str:
        return model_id.replace('/', '-').lower()

    @staticmethod
    def _normalize_gated(value) -> str:
        """Convert gated field to DB-compatible value ('none'/'auto'/'manual')."""
        if isinstance(value, str) and value in ('none', 'auto', 'manual'):
            return value
        if value is True:
            return 'manual'
        return 'none'

    def prepare_rows_from_scraped(self, item: dict) -> tuple:
        model_id = item.get('model_id') or item.get('id') or item.get('repo') or item.get('huggingface_id')
        if not model_id:
            raise ValueError('scraped item missing model id (model_id | id | repo)')
        repo_id = str(uuid.uuid4()).upper()
        now = datetime.now(timezone.utc).isoformat()
        name = item.get('name') or model_id.split('/')[-1]
        slug = self._slugify(model_id)
        description = item.get('description') or item.get('summary') or ''
        tags = item.get('tags') or item.get('tag_list') or []

        repo_row = {
            'RepoId': repo_id,
            'OwnerId': None,
            'OwnerType': item.get('owner_type') or 'user',
            'RepoType': item.get('repo_type') or 'model',
            'Name': name,
            'Slug': slug,
            'Description': description[:2000] if description else None,
            'Private': 1 if item.get('private') else 0,
            'Gated': self._normalize_gated(item.get('gated')),
            'PricingModel': item.get('pricing_model') or 'free',
            'Price': item.get('price') or 0,
            'LicenseType': item.get('license') or None,
            'Tags': ','.join(tags[:50]) if tags else None,
            'TotalDownloads': item.get('downloads') or item.get('total_downloads') or 0,
            'TotalLikes': item.get('likes') or item.get('total_likes') or 0,
            'SourceUrl': item.get('source_url'),
            'ImportedFrom': item.get('source') or 'scraped',
        }

        widget = {
            'source': item.get('source') or 'scraped',
            'source_url': item.get('source_url'),
        }

        meta_row = {
            'RepoId': repo_id,
            'Framework': item.get('framework'),
            'Task': item.get('task'),
            'Library': item.get('library'),
            'Architecture': item.get('architecture'),
            'Language': item.get('language'),
            'BaseModel': item.get('base_model'),
            'ParameterCount': item.get('parameter_count'),
            'TensorType': item.get('tensor_type'),
            'SafeTensors': 1 if item.get('safe_tensors') else 0,
            'PipelineTag': item.get('pipeline_tag'),
            'InferenceEnabled': 1 if item.get('inference_enabled') else 0,
            'WidgetData': json.dumps(widget),
            'EvalResults': json.dumps(item.get('eval_results')) if item.get('eval_results') else None,
            'GithubReadme': item.get('readme') or item.get('model_card'),
            'UsageGuide': json.dumps(item.get('usage_snippets')) if item.get('usage_snippets') else None,
            'OriginalModelId': model_id,
            'ScraperFetchedAt': now,
            'HostingType': item.get('hosting_type') or 'scraped',
        }

        return repo_row, meta_row

    def run(self, items: List[dict], dry_run: bool = True, owner_id: Optional[str] = None, limit: Optional[int] = None):
        out = []
        for i, it in enumerate(items):
            if limit and i >= limit:
                break
            try:
                repo_row, meta_row = self.prepare_rows_from_scraped(it)
                if not dry_run:
                    if not owner_id:
                        raise RuntimeError('owner_id is required when applying changes')
                    repo_row['OwnerId'] = owner_id
                    from scraper import db
                    db.insert_into_table('Repositories', repo_row)
                    db.insert_into_table('ModelMetadata', meta_row)
                    out.append({'model': it.get('model_id') or it.get('id'), 'repo_id': repo_row['RepoId'], 'inserted': True})
                else:
                    out.append({'model': it.get('model_id') or it.get('id'), 'repo_row': repo_row, 'meta_row': meta_row})
            except Exception as e:
                out.append({'model': it.get('model_id') or it.get('id'), 'error': str(e)})
        return out


def import_scraped_json(path: str) -> List[dict]:
    with open(path, 'r', encoding='utf8') as f:
        txt = f.read().strip()
        if not txt:
            return []
        # allow either a JSON list or newline-delimited JSON objects
        if txt.startswith('['):
            return json.loads(txt)
        else:
            items = []
            for line in txt.splitlines():
                line = line.strip()
                if not line:
                    continue
                items.append(json.loads(line))
            return items

