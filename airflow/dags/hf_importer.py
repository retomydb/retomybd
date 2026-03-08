"""Airflow DAG to run the Hugging Face importer (dry-run by default).

This DAG executes the scraper CLI inside the repository virtualenv.
"""
from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.bash import BashOperator

REPO_ROOT = '/Users/oladimejishodipe/retomY'
SCRAPER_PY = f"{REPO_ROOT}/scraper/scraper/main.py"
PYTHON = f"{REPO_ROOT}/scraper/.venv/bin/python"

default_args = {
    'owner': 'retomy',
    'depends_on_past': False,
    'start_date': datetime(2025, 1, 1),
    'retries': 0,
}

with DAG(
    'hf_importer_daily',
    default_args=default_args,
    schedule_interval='@daily',
    catchup=False,
) as dag:

    # Run dry-run by default. To apply changes, toggle flags or create a separate DAG.
    cmd = f"{PYTHON} {SCRAPER_PY} import_hf --file {REPO_ROOT}/scraper/models_to_import.txt --dry-run"

    run_importer = BashOperator(
        task_id='run_hf_importer_dryrun',
        bash_command=cmd,
    )

    run_importer
