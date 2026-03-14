#!/usr/bin/env python3
"""Enrichment: infer Task/Framework/Library from Topics/Description and update DB.

This script will:
 - Read recent rows from retomy.ModelMetadata where HostingType='github'
 - Heuristically infer `Task`, `Framework`, `Library` from `GithubTopics` or `WidgetData`
 - Update the ModelMetadata row with inferred values where missing

Usage:
  python3 enrich_github_metadata.py --limit 100
"""
import json
import re
import pyodbc
import argparse

CONN_STR = (
    "DRIVER={ODBC Driver 18 for SQL Server};SERVER=localhost,1433;"
    "DATABASE=retomY;UID=sa;PWD=Prestige@123;"
    "TrustServerCertificate=yes;Encrypt=yes;"
)


TASK_KEYWORDS = {
    'text-generation': ['text-generation','generation','language model','gpt','causal'],
    'text2text-generation': ['translation','text2text','t5','seq2seq','text-to-text'],
    'text-classification': ['classification','sentiment','text-classification'],
    'question-answering': ['question-answering','qa','squad'],
    'summarization': ['summarization','summarize'],
    'image-classification': ['image-classification','classification','vision','imagenet'],
    'object-detection': ['object-detection','detection'],
    'text-to-image': ['text-to-image','diffusion','stable-diffusion','diffusers'],
    'automatic-speech-recognition': ['speech','asr','automatic-speech-recognition'],
}

FRAMEWORK_KEYWORDS = {
    'pytorch': ['pytorch','torch'],'tensorflow': ['tensorflow','tf'],'jax': ['jax','flax'],
    'gguf': ['gguf'], 'onnx': ['onnx']
}

LIBRARY_KEYWORDS = {
    'transformers': ['transformers','huggingface'],
    'diffusers': ['diffusers','stable-diffusion'],
    'sentence-transformers': ['sentence-transformers','sentence transformers'],
    'timm': ['timm'],
}


def infer_from_text(text: str, mapping: dict):
    if not text:
        return None
    t = text.lower()
    for key, kws in mapping.items():
        for kw in kws:
            if kw in t:
                return key
    return None


def get_rows(conn, limit: int = 100):
    cur = conn.cursor()
    # Description is stored on the Repositories table; select r.Description instead of mm.Description
    sql = ("SELECT mm.RepoId, mm.GithubTopics, mm.WidgetData, r.Description, mm.Task, mm.Framework, mm.Library "
           "FROM retomy.ModelMetadata mm "
           "JOIN retomy.Repositories r ON r.RepoId = mm.RepoId "
           "WHERE mm.HostingType = 'github' AND (mm.Task IS NULL OR mm.Framework IS NULL OR mm.Library IS NULL) "
           "ORDER BY mm.ScraperFetchedAt DESC")
    if limit:
        sql = sql + f" OFFSET 0 ROWS FETCH NEXT {limit} ROWS ONLY"
    cur.execute(sql)
    return cur.fetchall()


def update_row(conn, repo_id, updates: dict):
    cols = ", ".join(f"{k} = ?" for k in updates.keys())
    sql = f"UPDATE retomy.ModelMetadata SET {cols} WHERE RepoId = ?"
    vals = list(updates.values()) + [repo_id]
    cur = conn.cursor()
    cur.execute(sql, vals)
    conn.commit()


def parse_widget(widget_json):
    try:
        return json.loads(widget_json) if widget_json else {}
    except Exception:
        return {}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--limit', type=int, default=200)
    args = parser.parse_args()

    conn = pyodbc.connect(CONN_STR)
    rows = get_rows(conn, limit=args.limit)
    print(f"Found {len(rows)} rows to enrich")

    for r in rows:
        repo_id = r[0]
        topics = r[1] or ''
        widget = parse_widget(r[2])
        desc = r[3] or ''
        current_task = r[4]
        current_framework = r[5]
        current_library = r[6]

        combined = ' '.join([topics if isinstance(topics, str) else ','.join(topics), json.dumps(widget), desc])

        updates = {}
        if not current_task:
            task = infer_from_text(combined, TASK_KEYWORDS)
            if task:
                updates['Task'] = task
        if not current_framework:
            fw = infer_from_text(combined, FRAMEWORK_KEYWORDS)
            if fw:
                updates['Framework'] = fw
        if not current_library:
            lib = infer_from_text(combined, LIBRARY_KEYWORDS)
            if lib:
                updates['Library'] = lib

        if updates:
            print(f"Updating {repo_id}: {updates}")
            update_row(conn, repo_id, updates)

    conn.close()
    print("Enrichment complete")


if __name__ == '__main__':
    main()
