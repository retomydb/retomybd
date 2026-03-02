"""
retomY — Enterprise Dataset Marketplace
Core Configuration
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache

# Load .env from project root
ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    # App
    APP_NAME: str = "retomY"
    API_VERSION: str = "v1"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_DEBUG: bool = True
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    # MSSQL
    MSSQL_HOST: str = "localhost"
    MSSQL_PORT: int = 1433
    MSSQL_USER: str = "sa"
    MSSQL_PASSWORD: str = "Prestige@123"
    MSSQL_DATABASE: str = "retomY"
    MSSQL_DRIVER: str = "ODBC Driver 18 for SQL Server"

    # Azure Storage (Azurite)
    AZURE_STORAGE_ACCOUNT_NAME: str = "devstoreaccount1"
    AZURE_STORAGE_ACCOUNT_KEY: str = "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=="
    AZURE_STORAGE_CONNECTION_STRING: str = ""
    AZURE_BLOB_ENDPOINT: str = "http://127.0.0.1:10000/devstoreaccount1"
    AZURE_QUEUE_ENDPOINT: str = "http://127.0.0.1:10001/devstoreaccount1"
    AZURE_TABLE_ENDPOINT: str = "http://127.0.0.1:10002/devstoreaccount1"
    AZURE_STORAGE_API_VERSION: str = "2021-12-02"

    # JWT
    JWT_SECRET_KEY: str = "retomY-enterprise-jwt-secret-key-2026-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Platform
    PLATFORM_COMMISSION_RATE: float = 0.15
    MAX_UPLOAD_SIZE_MB: int = 500
    ALLOWED_FILE_TYPES: str = "csv,json,parquet,xlsx,tsv,xml,zip,gz"

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PLATFORM_ACCOUNT_ID: str = ""
    FRONTEND_URL: str = "http://localhost:3000"

    # Airflow
    AIRFLOW_HOST: str = "localhost"
    AIRFLOW_PORT: int = 8080
    AIRFLOW_USER: str = "airflow"
    AIRFLOW_PASSWORD: str = "airflow"

    @property
    def mssql_connection_string(self) -> str:
        return (
            f"DRIVER={{{self.MSSQL_DRIVER}}};"
            f"SERVER={self.MSSQL_HOST},{self.MSSQL_PORT};"
            f"DATABASE={self.MSSQL_DATABASE};"
            f"UID={self.MSSQL_USER};"
            f"PWD={self.MSSQL_PASSWORD};"
            f"TrustServerCertificate=yes;"
        )

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    @property
    def allowed_file_types_list(self) -> list[str]:
        return [t.strip() for t in self.ALLOWED_FILE_TYPES.split(",")]

    class Config:
        env_file = str(ENV_PATH)
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
