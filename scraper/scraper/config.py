import os
from dotenv import load_dotenv
from urllib.parse import quote_plus

load_dotenv()

# Primary: explicit DATABASE_URL
DATABASE_URL = os.getenv('DATABASE_URL')

if not DATABASE_URL:
    # Try to construct a SQL Server URL from MSSQL_* env vars if present.
    host = os.getenv('MSSQL_HOST')
    port = os.getenv('MSSQL_PORT')
    user = os.getenv('MSSQL_USER')
    password = os.getenv('MSSQL_PASSWORD')
    database = os.getenv('MSSQL_DATABASE')
    driver = os.getenv('MSSQL_DRIVER')

    if host and user and password and database:
        # Build a pyodbc URL: mssql+pyodbc://user:pass@host:port/dbname?driver=ODBC+Driver+18+for+SQL+Server
        user_q = quote_plus(user)
        pass_q = quote_plus(password)
        hostpart = f"{host}:{port}" if port else host
        driver_q = quote_plus(driver) if driver else quote_plus('ODBC Driver 18 for SQL Server')
        # Add TrustServerCertificate and Encrypt flags to avoid SSL verification failures
        extra = os.getenv('MSSQL_EXTRA_PARAMS', '')
        if extra:
            # allow user-specified params (should be in URL query form, e.g. "TrustServerCertificate=yes&Encrypt=yes")
            suffix = f"&{extra.lstrip('&')}"
        else:
            suffix = "&TrustServerCertificate=yes&Encrypt=yes"
        DATABASE_URL = f"mssql+pyodbc://{user_q}:{pass_q}@{hostpart}/{database}?driver={driver_q}{suffix}"

if not DATABASE_URL:
    raise RuntimeError('Please set DATABASE_URL in .env or environment')
