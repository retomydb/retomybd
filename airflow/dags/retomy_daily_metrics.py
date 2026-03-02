"""
retomY Airflow DAG: Dataset Quality & Metrics Pipeline
Runs daily to aggregate usage metrics, compute dataset quality scores,
and trigger privacy scans on newly uploaded datasets.
"""
from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.microsoft.mssql.hooks.mssql import MsSqlHook

default_args = {
    'owner': 'retomy',
    'depends_on_past': False,
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
}


def aggregate_daily_metrics(**context):
    """Aggregate daily views, downloads, purchases per dataset."""
    hook = MsSqlHook(mssql_conn_id='retomy_mssql')
    sql = """
    -- Materialize daily metrics snapshot
    INSERT INTO retomy.UsageMetrics (DatasetId, MetricDate, Views, Downloads, Purchases)
    SELECT 
        d.DatasetId,
        CAST(GETDATE() AS DATE),
        ISNULL(d.TotalViews, 0),
        ISNULL(d.TotalDownloads, 0),
        (SELECT COUNT(*) FROM retomy.Purchases WHERE DatasetId = d.DatasetId AND Status = 'completed')
    FROM retomy.Datasets d
    WHERE d.Status = 'published'
      AND NOT EXISTS (
        SELECT 1 FROM retomy.UsageMetrics um 
        WHERE um.DatasetId = d.DatasetId AND um.MetricDate = CAST(GETDATE() AS DATE)
      );
    """
    hook.run(sql)
    print(f"[retomY] Daily metrics aggregated at {datetime.utcnow()}")


def compute_quality_scores(**context):
    """Recompute quality/ranking scores for published datasets."""
    hook = MsSqlHook(mssql_conn_id='retomy_mssql')
    sql = """
    -- Wilson score confidence interval for ranking
    UPDATE d SET
        d.QualityScore = CASE
            WHEN r.TotalReviews = 0 THEN 50.0
            ELSE (
                (r.AvgRating / 5.0 + 1.9208 / (2.0 * r.TotalReviews) 
                 - 1.96 * SQRT((r.AvgRating / 5.0 * (1 - r.AvgRating / 5.0) 
                 + 0.9604 / (4.0 * r.TotalReviews)) / r.TotalReviews)) 
                / (1 + 3.8416 / r.TotalReviews)
            ) * 100
        END
    FROM retomy.Datasets d
    CROSS APPLY (
        SELECT 
            ISNULL(AVG(CAST(rv.Rating AS FLOAT)), 0) AS AvgRating,
            COUNT(rv.ReviewId) AS TotalReviews
        FROM retomy.Reviews rv WHERE rv.DatasetId = d.DatasetId
    ) r
    WHERE d.Status = 'published';
    """
    hook.run(sql)
    print(f"[retomY] Quality scores recomputed at {datetime.utcnow()}")


def check_stale_datasets(**context):
    """Flag datasets not updated in 90+ days."""
    hook = MsSqlHook(mssql_conn_id='retomy_mssql')
    sql = """
    INSERT INTO retomy.Notifications (UserId, Type, Title, Message)
    SELECT 
        d.SellerId,
        'alert',
        'Dataset Update Reminder',
        'Your dataset "' + d.Title + '" hasn''t been updated in over 90 days. Consider refreshing the data to maintain quality.'
    FROM retomy.Datasets d
    WHERE d.Status = 'published'
      AND d.UpdatedAt < DATEADD(DAY, -90, GETDATE())
      AND NOT EXISTS (
        SELECT 1 FROM retomy.Notifications n 
        WHERE n.UserId = d.SellerId 
          AND n.Title = 'Dataset Update Reminder'
          AND n.Message LIKE '%' + d.Title + '%'
          AND n.CreatedAt > DATEADD(DAY, -7, GETDATE())
      );
    """
    hook.run(sql)
    print(f"[retomY] Stale dataset check completed at {datetime.utcnow()}")


def compute_seller_payouts(**context):
    """Calculate pending seller payouts for completed purchases."""
    hook = MsSqlHook(mssql_conn_id='retomy_mssql')
    sql = """
    -- Insert payout records for sellers with unpaid earnings
    INSERT INTO retomy.SellerPayouts (SellerId, Amount, PeriodStart, PeriodEnd, Status)
    SELECT 
        p.SellerId,
        SUM(p.SellerEarnings),
        DATEADD(DAY, -30, GETDATE()),
        GETDATE(),
        'pending'
    FROM retomy.Purchases p
    WHERE p.Status = 'completed'
      AND p.PurchasedAt >= DATEADD(DAY, -30, GETDATE())
      AND NOT EXISTS (
        SELECT 1 FROM retomy.SellerPayouts sp
        WHERE sp.SellerId = p.SellerId
          AND sp.PeriodEnd >= DATEADD(DAY, -1, GETDATE())
      )
    GROUP BY p.SellerId
    HAVING SUM(p.SellerEarnings) > 0;
    """
    hook.run(sql)
    print(f"[retomY] Seller payouts computed at {datetime.utcnow()}")


with DAG(
    dag_id='retomy_daily_metrics',
    default_args=default_args,
    description='Daily dataset metrics aggregation and quality scoring',
    schedule_interval='0 2 * * *',  # 2 AM daily
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=['retomy', 'metrics', 'etl'],
) as dag:

    t_metrics = PythonOperator(
        task_id='aggregate_daily_metrics',
        python_callable=aggregate_daily_metrics,
    )

    t_quality = PythonOperator(
        task_id='compute_quality_scores',
        python_callable=compute_quality_scores,
    )

    t_stale = PythonOperator(
        task_id='check_stale_datasets',
        python_callable=check_stale_datasets,
    )

    t_payouts = PythonOperator(
        task_id='compute_seller_payouts',
        python_callable=compute_seller_payouts,
    )

    # Pipeline: metrics first, then quality and stale in parallel, then payouts
    t_metrics >> [t_quality, t_stale] >> t_payouts
