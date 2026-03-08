# =============================================================================
# retomY Backend — Production Dockerfile
# Multi-stage build for smaller, secure images
# =============================================================================
FROM python:3.11-slim AS base

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# ── Stage 1: System dependencies ────────────────────────
FROM base AS system-deps

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl gnupg2 unixodbc-dev && \
    curl -fsSL https://packages.microsoft.com/keys/microsoft.asc \
        | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg && \
    ARCH=$(dpkg --print-architecture) && \
    echo "deb [arch=${ARCH} signed-by=/usr/share/keyrings/microsoft-prod.gpg] \
        https://packages.microsoft.com/debian/12/prod bookworm main" \
        > /etc/apt/sources.list.d/mssql-release.list && \
    apt-get update && \
    ACCEPT_EULA=Y apt-get install -y msodbcsql18 && \
    apt-get purge -y gnupg2 && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# ── Stage 2: Python dependencies ────────────────────────
FROM system-deps AS dependencies

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ── Stage 3: Application ────────────────────────────────
FROM dependencies AS production

# Create non-root user for security
RUN groupadd -r retomy && useradd -r -g retomy -d /app -s /sbin/nologin retomy

COPY --chown=retomy:retomy . .

# Remove unnecessary files
RUN rm -rf __pycache__ .pytest_cache tests/ *.md

# Ensure /app/static exists and is writable by the app user
RUN mkdir -p /app/static && chown -R retomy:retomy /app

USER retomy

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Gunicorn with Uvicorn workers for production
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--workers", "2", "--loop", "uvloop", "--http", "httptools", \
     "--access-log", "--log-level", "info"]
