# retomY — Enterprise Dataset Marketplace

> *Retomy Db — Buy, Sell, and Discover Data at Scale.*

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────────────────┐
│   React UI   │────▶│  API Gateway │────▶│  FastAPI Backend Services    │
│  (Vite/TS)   │     │  (FastAPI)   │     │  ┌─────────┐ ┌───────────┐  │
└──────────────┘     └──────────────┘     │  │  Auth   │ │  Catalog  │  │
                                          │  └─────────┘ └───────────┘  │
                                          │  ┌─────────┐ ┌───────────┐  │
                                          │  │ Billing │ │  Storage  │  │
                                          │  └─────────┘ └───────────┘  │
                                          │  ┌─────────┐ ┌───────────┐  │
                                          │  │ Search  │ │Compliance │  │
                                          │  └─────────┘ └───────────┘  │
                                          └──────────────────────────────┘
                                                      │
                              ┌────────────────────────┼────────────────────────┐
                              ▼                        ▼                        ▼
                     ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
                     │    MSSQL     │         │   Azurite    │         │   Airflow    │
                     │  (Database)  │         │(Blob/Queue)  │         │    (ETL)     │
                     └──────────────┘         └──────────────┘         └──────────────┘
```

## Quick Start

```bash
# 1. Ensure Docker Desktop is running with Azurite, MSSQL, and Airflow

# 2. Run database migrations
cd database && python migrate.py

# 3. Start backend
cd backend && pip install -r requirements.txt && uvicorn main:app --reload

# 4. Start frontend
cd frontend && npm install && npm run dev
```

## Project Structure

```
retomY/
├── .env                    # Environment configuration
├── docker-compose.yml      # Application orchestration
├── database/
│   ├── migrations/         # SQL schema migrations
│   ├── stored_procedures/  # Enterprise stored procedures
│   ├── seed/               # Seed data
│   └── migrate.py          # Migration runner
├── backend/
│   ├── main.py             # FastAPI entry point
│   ├── core/               # Config, security, dependencies
│   ├── routers/            # API route handlers
│   ├── services/           # Business logic
│   ├── models/             # Pydantic models
│   ├── middleware/         # Auth, logging, rate limiting
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route pages
│   │   ├── services/       # API client
│   │   ├── store/          # State management
│   │   └── styles/         # Global styles
│   └── package.json
└── airflow/
    └── dags/               # ETL pipeline definitions
```

## Infrastructure

| Service      | Host                  | Port  |
|--------------|-----------------------|-------|
| MSSQL        | localhost             | 1433  |
| Azurite Blob | 127.0.0.1             | 10000 |
| Azurite Queue| 127.0.0.1             | 10001 |
| Azurite Table| 127.0.0.1             | 10002 |
| Airflow      | localhost             | 8080  |
| Backend API  | localhost             | 8000  |
| Frontend     | localhost             | 5173  |

## License

Proprietary — retomY Inc. All rights reserved.
