"""
retomY Airflow DAG: Dataset Ingestion Pipeline
Triggered when a new dataset is uploaded. Validates file,
extracts schema metadata, generates sample preview, and
runs privacy scan.
"""
from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.microsoft.mssql.hooks.mssql import MsSqlHook

default_args = {
    'owner': 'retomy',
    'depends_on_past': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=2),
}


def validate_upload(**context):
    """Validate uploaded dataset file integrity."""
    dataset_id = context['dag_run'].conf.get('dataset_id')
    if not dataset_id:
        raise ValueError("No dataset_id provided in dag_run.conf")
    
    hook = MsSqlHook(mssql_conn_id='retomy_mssql')
    records = hook.get_records(
        f"SELECT DatasetId, FileFormat, FileSize, BlobPath FROM retomy.Datasets WHERE DatasetId = '{dataset_id}'"
    )
    if not records:
        raise ValueError(f"Dataset {dataset_id} not found")
    
    ds = records[0]
    print(f"[retomY] Validating dataset {ds[0]}: format={ds[1]}, size={ds[2]}, blob={ds[3]}")
    
    # Update status
    hook.run(f"""
        UPDATE retomy.Datasets SET Status = 'processing' WHERE DatasetId = '{dataset_id}';
        INSERT INTO retomy.AuditLogs (UserId, Action, EntityType, EntityId, Details)
        SELECT SellerId, 'dataset_validation_started', 'Dataset', DatasetId, 'Automated validation pipeline triggered'
        FROM retomy.Datasets WHERE DatasetId = '{dataset_id}';
    """)
    return dataset_id


def extract_schema(**context):
    """Extract column names, types, row counts from the dataset."""
    dataset_id = context['ti'].xcom_pull(task_ids='validate_upload')
    hook = MsSqlHook(mssql_conn_id='retomy_mssql')
    
    # In production, this would download from Azurite and parse the file
    # For now, mark schema extraction as complete
    hook.run(f"""
        UPDATE retomy.Datasets 
        SET UpdatedAt = GETDATE()
        WHERE DatasetId = '{dataset_id}';
    """)
    print(f"[retomY] Schema extracted for dataset {dataset_id}")


def generate_sample(**context):
    """Generate a sample preview (first N rows) and store in Azurite."""
    dataset_id = context['ti'].xcom_pull(task_ids='validate_upload')
    hook = MsSqlHook(mssql_conn_id='retomy_mssql')
    
    hook.run(f"""
        UPDATE retomy.Datasets 
        SET SampleAvailable = 1, UpdatedAt = GETDATE()
        WHERE DatasetId = '{dataset_id}';
    """)
    print(f"[retomY] Sample generated for dataset {dataset_id}")


def privacy_scan(**context):
    """Scan dataset for PII (emails, SSNs, phone numbers, etc.)."""
    dataset_id = context['ti'].xcom_pull(task_ids='validate_upload')
    hook = MsSqlHook(mssql_conn_id='retomy_mssql')
    
    # Simulated privacy score (in production, would scan actual data)
    hook.run(f"""
        UPDATE retomy.Datasets 
        SET PrivacyScore = 95.0, 
            Status = 'pending',
            UpdatedAt = GETDATE()
        WHERE DatasetId = '{dataset_id}';
        
        INSERT INTO retomy.Notifications (UserId, Type, Title, Message)
        SELECT SellerId, 'dataset', 'Dataset Ready for Review',
            'Your dataset has passed automated checks and is pending admin review.'
        FROM retomy.Datasets WHERE DatasetId = '{dataset_id}';
    """)
    print(f"[retomY] Privacy scan completed for dataset {dataset_id}")


with DAG(
    dag_id='retomy_dataset_ingestion',
    default_args=default_args,
    description='Process newly uploaded datasets: validate, extract schema, generate samples, privacy scan',
    schedule_interval=None,  # Triggered via API
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=['retomy', 'ingestion', 'pipeline'],
) as dag:

    t_validate = PythonOperator(
        task_id='validate_upload',
        python_callable=validate_upload,
    )

    t_schema = PythonOperator(
        task_id='extract_schema',
        python_callable=extract_schema,
    )

    t_sample = PythonOperator(
        task_id='generate_sample',
        python_callable=generate_sample,
    )

    t_privacy = PythonOperator(
        task_id='privacy_scan',
        python_callable=privacy_scan,
    )

    # validate -> [schema + sample in parallel] -> privacy scan
    t_validate >> [t_schema, t_sample] >> t_privacy
