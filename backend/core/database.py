"""
retomY — Database Connection Pool
"""
import pyodbc
from contextlib import contextmanager
from core.config import get_settings
import structlog

logger = structlog.get_logger()

_connection_pool = []


def get_db_connection():
    """Get a database connection."""
    settings = get_settings()
    try:
        conn = pyodbc.connect(settings.mssql_connection_string, autocommit=False)
        return conn
    except Exception as e:
        logger.error("database_connection_failed", error=str(e))
        raise


@contextmanager
def get_db():
    """Context manager for database connections with auto-commit/rollback."""
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def execute_sp(sp_name: str, params: dict = None, fetch: str = "all"):
    """
    Execute a stored procedure and return results.
    
    Args:
        sp_name: Stored procedure name (e.g., 'retomy.sp_RegisterUser')
        params: Dictionary of parameters
        fetch: 'all', 'one', 'none', or 'multi' (multiple result sets)
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        if params:
            param_placeholders = ", ".join([f"@{k}=?" for k in params.keys()])
            sql = f"EXEC {sp_name} {param_placeholders}"
            cursor.execute(sql, list(params.values()))
        else:
            cursor.execute(f"EXEC {sp_name}")

        if fetch == "none":
            conn.commit()
            return None
        elif fetch == "one":
            columns = [col[0] for col in cursor.description] if cursor.description else []
            row = cursor.fetchone()
            conn.commit()
            if row:
                return dict(zip(columns, row))
            return None
        elif fetch == "multi":
            results = []
            while True:
                if cursor.description:
                    columns = [col[0] for col in cursor.description]
                    rows = cursor.fetchall()
                    results.append([dict(zip(columns, row)) for row in rows])
                if not cursor.nextset():
                    break
            conn.commit()
            return results
        else:  # all
            columns = [col[0] for col in cursor.description] if cursor.description else []
            rows = cursor.fetchall()
            conn.commit()
            return [dict(zip(columns, row)) for row in rows]
    except Exception as e:
        conn.rollback()
        logger.error("stored_procedure_failed", sp=sp_name, error=str(e))
        raise
    finally:
        cursor.close()
        conn.close()


def execute_query(sql: str, params: list = None, fetch: str = "all"):
    """Execute a raw SQL query."""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        if params:
            cursor.execute(sql, params)
        else:
            cursor.execute(sql)

        if fetch == "none":
            conn.commit()
            return None
        elif fetch == "one":
            columns = [col[0] for col in cursor.description] if cursor.description else []
            row = cursor.fetchone()
            conn.commit()
            if row:
                return dict(zip(columns, row))
            return None
        else:
            columns = [col[0] for col in cursor.description] if cursor.description else []
            rows = cursor.fetchall()
            conn.commit()
            return [dict(zip(columns, row)) for row in rows]
    except Exception as e:
        conn.rollback()
        logger.error("query_failed", sql=sql[:100], error=str(e))
        raise
    finally:
        cursor.close()
        conn.close()
