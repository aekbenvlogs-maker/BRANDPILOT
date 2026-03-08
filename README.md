# BRANDSCALE — AI Brand Scaling Platform

> **Full-stack, production-ready AI marketing automation platform.**  
> Generate content, score leads, run email sequences, and monitor everything — from a single codebase.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BRANDSCALE                               │
│                                                                 │
│  ┌──────────────┐    ┌────────────────────────────────────┐    │
│  │  Next.js 14  │───▶│  FastAPI Backend  (:8000)          │    │
│  │  (frontend)  │    │  /api/v1/projects                  │    │
│  │  :3000       │    │  /api/v1/campaigns                 │    │
│  └──────────────┘    │  /api/v1/leads                     │    │
│                      │  /api/v1/content                   │    │
│                      │  /api/v1/workflows                 │    │
│                      │  /api/v1/analytics                 │    │
│                      └────────────┬───────────────────────┘    │
│                                   │                             │
│         ┌─────────────────────────┼──────────────────────┐     │
│         ▼                         ▼                       ▼     │
│  ┌─────────────┐          ┌──────────────┐        ┌──────────┐ │
│  │ PostgreSQL  │          │    Redis      │        │  Celery  │ │
│  │ (prod DB)   │          │  Cache/Queue  │        │ Workers  │ │
│  └─────────────┘          └──────────────┘        └──────────┘ │
│                                                                 │
│  Microservices (Celery workers + FastAPI sub-routers):          │
│  ┌──────────────┐ ┌──────────────┐ ┌───────────┐ ┌──────────┐ │
│  │ bs_ai_text   │ │ bs_ai_image  │ │ bs_email  │ │bs_scoring│ │
│  │ bs_ai_video  │ │              │ │           │ │          │ │
│  └──────────────┘ └──────────────┘ └───────────┘ └──────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer       | Technology                                           |
|-------------|------------------------------------------------------|
| Backend     | Python 3.11, FastAPI (async), SQLAlchemy 2.0, Alembic |
| Frontend    | Next.js 14, React 18, TypeScript strict, Tailwind CSS |
| Database    | PostgreSQL (prod) / SQLite (dev)                      |
| Queue/Cache | Redis 7, Celery 5, Flower                             |
| AI          | OpenAI-compatible API (GPT-4), Ollama local fallback  |
| Storage     | S3-compatible (AWS / MinIO / Backblaze)               |
| Auth        | JWT (HS256), bcrypt, refresh tokens                   |
| RGPD        | Fernet PII encryption, opt-in mandatory, unsubscribe  |

---

## Prerequisites

- Python 3.11.9 (`pyenv install 3.11.9`)
- Node.js 20 + npm
- Docker & Docker Compose
- Redis (or use Docker)
- PostgreSQL (or use Docker)

---

## Installation

### 1. Clone and enter the repo

```bash
git clone https://github.com/yourorg/brandscale.git
cd brandscale
```

### 2. Configure environment variables

```bash
cp .env.example .env
# Edit .env with your values:
#   SECRET_KEY, OPENAI_API_KEY, FERNET_KEY, SMTP_*, S3_*, DATABASE_URL
```

Generate a Fernet key:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### 3. Install Python dependencies

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e "."
```

### 4. Install frontend dependencies

```bash
cd frontend && npm install && cd ..
```

### 5. Run the full QA suite

```bash
make qa   # format + lint + typecheck + tests
```

### 6. Run all (build + start)

```bash
make all
```

---

## Running Locally (without Docker)

```bash
# Terminal 1 — backend
make dev-backend

# Terminal 2 — Celery workers
make dev-workers

# Terminal 3 — frontend
make dev-frontend
```

Open [http://localhost:3000](http://localhost:3000)  
API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## Running with Docker

```bash
make docker
# or
docker compose up --build
```

Services:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Flower (Celery monitor): http://localhost:5555 (user: brandscale / pass: brandscale)

---

## Database Migrations

```bash
make migrate           # apply all pending Alembic migrations
alembic revision --autogenerate -m "describe change"
```

---

## Testing

```bash
make test              # pytest with coverage
# Coverage report: BRANDSCALE_coverage_report.html
```

Target: **≥ 80% coverage** across `backend/` and `microservices/`.

---

## Quality Gates

```bash
make format    # black + ruff --fix + prettier
make lint      # ruff + pylint (fail-under=8.5) + eslint
make typecheck # mypy strict
make qa        # all of the above + tests
```

---

## Project Structure

```
brandscale/
├── backend/
│   ├── main.py                   # FastAPI app factory
│   └── api/v1/
│       ├── models/               # Pydantic v2 request/response models
│       ├── services/             # Business logic (auth, leads, campaigns…)
│       ├── controllers/          # Orchestration layer
│       └── routes/               # FastAPI route definitions
├── configs/
│   ├── settings.py               # Pydantic BaseSettings
│   ├── logging_config.py         # Loguru dual-timezone setup
│   └── ai_config.py              # OpenAI client factory + model configs
├── database/
│   ├── connection.py             # Async SQLAlchemy engine + session
│   ├── schema.sql                # PostgreSQL DDL
│   └── models_orm.py             # SQLAlchemy 2.0 ORM models
├── microservices/
│   ├── bs_ai_text/               # AI text generation (service, worker, api)
│   ├── bs_ai_image/              # AI image generation + S3
│   ├── bs_ai_video/              # Video script + render
│   ├── bs_email/                 # Email sequences + RGPD unsubscribe
│   ├── bs_scoring/               # Lead scoring + tier classification
│   └── workflow.py               # Full L2C pipeline orchestration
├── frontend/
│   ├── app/                      # Next.js 14 App Router pages
│   ├── components/               # React UI components
│   ├── hooks/                    # SWR data-fetching hooks
│   └── utils/                    # api.ts, formatters.ts, timezone.ts
├── tests/
│   ├── backend/                  # 7 backend pytest files
│   └── microservices/            # 7 microservice pytest files
├── scripts/                      # Shell + Python dev/ops scripts
├── .vscode/                      # Workspace settings, extensions, launch configs
├── Dockerfile.backend
├── Dockerfile.frontend
├── docker-compose.yml
├── Makefile
├── pyproject.toml
├── mypy.ini
└── .env.example
```

---

## Environment Variables Reference

| Variable              | Description                                  | Default          |
|-----------------------|----------------------------------------------|------------------|
| `APP_ENV`             | `development` / `production` / `test`        | `development`    |
| `SECRET_KEY`          | JWT signing secret (min 32 chars)            | **required**     |
| `DATABASE_URL`        | SQLAlchemy async DB URL                      | SQLite (dev)     |
| `REDIS_URL`           | Redis connection URL                         | `redis://localhost:6379/0` |
| `OPENAI_API_KEY`      | OpenAI API key                               | **required**     |
| `OPENAI_BASE_URL`     | Override for Ollama or other compatible APIs | OpenAI default   |
| `FERNET_KEY`          | 32-byte Fernet key for PII encryption        | **required**     |
| `SMTP_HOST`           | SMTP server hostname                         | `localhost`      |
| `SMTP_PORT`           | SMTP server port                             | `587`            |
| `S3_BUCKET`           | S3 bucket name for media                     | `brandscale`     |
| `S3_ENDPOINT_URL`     | Custom S3 endpoint (MinIO, Backblaze…)       | AWS default      |
| `CORS_ORIGINS`        | Comma-separated allowed CORS origins         | `http://localhost:3000` |
| `NEXT_PUBLIC_API_BASE_URL` | Frontend API base URL                 | `http://localhost:8000` |

Full list: see [.env.example](.env.example)

---

## RGPD / Privacy

- **PII encryption:** `email`, `first_name`, `last_name` are encrypted at rest with Fernet symmetric encryption.
- **Opt-in mandatory:** Leads without `opt_in=True` are skipped during email sequence creation.
- **Unsubscribe:** Processing guaranteed within 24 hours via dedicated endpoint `POST /bs-email/unsubscribe`.
- **Log purge:** Application logs are retained for 90 days max (configured in `configs/logging_config.py`).
- **No PII in logs:** Loguru configuration masks sensitive fields.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes following the engineering rules:
   - All Python files must include the standard file header
   - Functions ≤ 50 lines, docstrings + type hints mandatory
   - `make qa` must pass before opening a PR
4. Open a pull request against `main`

---

## Licence

MIT — Copyright © 2026 BRANDSCALE Dev Team
