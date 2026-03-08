# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : Makefile
# DESCRIPTION  : CI/CD automation targets
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# LAST UPDATED : 2026-03-08
# ============================================================

.PHONY: all format lint typecheck test qa build docker migrate clean help

# ---------------------------------------------------------------------------
# Variables
# ---------------------------------------------------------------------------
PYTHON        := python3.11
PIP           := pip
PYTEST        := pytest
BLACK         := black
RUFF          := ruff
MYPY          := mypy
PYLINT        := pylint
UVICORN       := uvicorn
ALEMBIC       := alembic
DOCKER_COMPOSE := docker compose

BACKEND_SRC   := backend microservices configs database
FRONTEND_SRC  := frontend

# Colors
RESET  := \033[0m
GREEN  := \033[32m
YELLOW := \033[33m
RED    := \033[31m
BLUE   := \033[34m

# ---------------------------------------------------------------------------
# help — list all targets
# ---------------------------------------------------------------------------
help:
	@echo ""
	@echo "$(BLUE)╔══════════════════════════════════════════════╗$(RESET)"
	@echo "$(BLUE)║      BRANDSCALE — Makefile Targets            ║$(RESET)"
	@echo "$(BLUE)╚══════════════════════════════════════════════╝$(RESET)"
	@echo ""
	@echo "  $(GREEN)make format$(RESET)     → Black (Python) + Prettier (TypeScript)"
	@echo "  $(GREEN)make lint$(RESET)       → Ruff + Pylint + ESLint"
	@echo "  $(GREEN)make typecheck$(RESET)  → Mypy (Python) + tsc --noEmit (TypeScript)"
	@echo "  $(GREEN)make test$(RESET)       → Pytest + Jest with coverage"
	@echo "  $(GREEN)make qa$(RESET)         → format + lint + typecheck + test (fail-fast)"
	@echo "  $(GREEN)make build$(RESET)      → Next.js production build"
	@echo "  $(GREEN)make docker$(RESET)     → docker compose up --build"
	@echo "  $(GREEN)make migrate$(RESET)    → Alembic upgrade head"
	@echo "  $(GREEN)make all$(RESET)        → make qa + make build"
	@echo "  $(GREEN)make clean$(RESET)      → Remove build artifacts and caches"
	@echo "  $(GREEN)make help$(RESET)       → Show this help"
	@echo ""

# ---------------------------------------------------------------------------
# format — Black (Python) + Prettier (TypeScript)
# ---------------------------------------------------------------------------
format:
	@echo "$(YELLOW)▶ [BRANDSCALE] Running Black formatter...$(RESET)"
	$(BLACK) $(BACKEND_SRC) --line-length 88
	@echo "$(YELLOW)▶ [BRANDSCALE] Running Prettier formatter...$(RESET)"
	cd $(FRONTEND_SRC) && npx prettier --write "**/*.{ts,tsx,json,css,md}"
	@echo "$(GREEN)✓ Format complete$(RESET)"

# ---------------------------------------------------------------------------
# lint — Ruff + Pylint + ESLint
# ---------------------------------------------------------------------------
lint:
	@echo "$(YELLOW)▶ [BRANDSCALE] Running Ruff linter...$(RESET)"
	$(RUFF) check $(BACKEND_SRC)
	@echo "$(YELLOW)▶ [BRANDSCALE] Running Pylint static analysis...$(RESET)"
	$(PYLINT) $(BACKEND_SRC) --fail-under=8.5
	@echo "$(YELLOW)▶ [BRANDSCALE] Running ESLint...$(RESET)"
	cd $(FRONTEND_SRC) && npx eslint . --ext .ts,.tsx --max-warnings 0
	@echo "$(GREEN)✓ Lint complete$(RESET)"

# ---------------------------------------------------------------------------
# typecheck — Mypy + tsc
# ---------------------------------------------------------------------------
typecheck:
	@echo "$(YELLOW)▶ [BRANDSCALE] Running Mypy type checker...$(RESET)"
	$(MYPY) $(BACKEND_SRC)
	@echo "$(YELLOW)▶ [BRANDSCALE] Running TypeScript compiler check...$(RESET)"
	cd $(FRONTEND_SRC) && npx tsc --noEmit
	@echo "$(GREEN)✓ Type check complete$(RESET)"

# ---------------------------------------------------------------------------
# test — Pytest + Jest
# ---------------------------------------------------------------------------
test:
	@echo "$(YELLOW)▶ [BRANDSCALE] Running Pytest with coverage...$(RESET)"
	$(PYTEST) tests/ -v --tb=short
	@echo "$(YELLOW)▶ [BRANDSCALE] Running Jest tests...$(RESET)"
	cd $(FRONTEND_SRC) && npx jest --coverage --coverageThreshold='{"global":{"lines":70}}'
	@echo "$(GREEN)✓ Tests complete$(RESET)"

# ---------------------------------------------------------------------------
# qa — Full quality assurance pipeline (fail-fast)
# ---------------------------------------------------------------------------
qa: format lint typecheck test
	@echo ""
	@echo "$(GREEN)╔══════════════════════════════════════════════╗$(RESET)"
	@echo "$(GREEN)║  ✓ BRANDSCALE QA PASSED — zero errors         ║$(RESET)"
	@echo "$(GREEN)╚══════════════════════════════════════════════╝$(RESET)"

# ---------------------------------------------------------------------------
# build — Next.js production build
# ---------------------------------------------------------------------------
build:
	@echo "$(YELLOW)▶ [BRANDSCALE] Building Next.js frontend...$(RESET)"
	cd $(FRONTEND_SRC) && npm run build
	@echo "$(GREEN)✓ Build complete$(RESET)"

# ---------------------------------------------------------------------------
# docker — Build and run all services
# ---------------------------------------------------------------------------
docker:
	@echo "$(YELLOW)▶ [BRANDSCALE] Building and starting Docker services...$(RESET)"
	$(DOCKER_COMPOSE) -f docker/docker-compose.yml up --build
	@echo "$(GREEN)✓ Docker services started$(RESET)"

docker-down:
	@echo "$(YELLOW)▶ [BRANDSCALE] Stopping Docker services...$(RESET)"
	$(DOCKER_COMPOSE) -f docker/docker-compose.yml down

docker-logs:
	$(DOCKER_COMPOSE) -f docker/docker-compose.yml logs -f

# ---------------------------------------------------------------------------
# migrate — Run Alembic migrations
# ---------------------------------------------------------------------------
migrate:
	@echo "$(YELLOW)▶ [BRANDSCALE] Running Alembic migrations...$(RESET)"
	$(ALEMBIC) upgrade head
	@echo "$(GREEN)✓ Migrations complete$(RESET)"

migrate-create:
	@read -p "Migration message: " msg; \
	$(ALEMBIC) revision --autogenerate -m "$$msg"

migrate-downgrade:
	$(ALEMBIC) downgrade -1

# ---------------------------------------------------------------------------
# install — Install all dependencies
# ---------------------------------------------------------------------------
install:
	@echo "$(YELLOW)▶ [BRANDSCALE] Installing Python dependencies...$(RESET)"
	$(PIP) install -e ".[dev]"
	@echo "$(YELLOW)▶ [BRANDSCALE] Installing Node dependencies...$(RESET)"
	cd $(FRONTEND_SRC) && npm install
	@echo "$(GREEN)✓ Installation complete$(RESET)"

# ---------------------------------------------------------------------------
# dev — Start development servers
# ---------------------------------------------------------------------------
dev-backend:
	@echo "$(YELLOW)▶ [BRANDSCALE] Starting FastAPI backend...$(RESET)"
	bash scripts/start_backend.sh

dev-frontend:
	@echo "$(YELLOW)▶ [BRANDSCALE] Starting Next.js frontend...$(RESET)"
	cd $(FRONTEND_SRC) && npm run dev

dev-workers:
	@echo "$(YELLOW)▶ [BRANDSCALE] Starting Celery workers...$(RESET)"
	bash scripts/start_workers.sh

# ---------------------------------------------------------------------------
# health — Check all services health
# ---------------------------------------------------------------------------
health:
	$(PYTHON) scripts/check_health.py

# ---------------------------------------------------------------------------
# clean — Remove build artifacts
# ---------------------------------------------------------------------------
clean:
	@echo "$(YELLOW)▶ [BRANDSCALE] Cleaning build artifacts...$(RESET)"
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "htmlcov" -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	find . -name ".coverage" -delete 2>/dev/null || true
	rm -f BRANDSCALE_coverage_report.html 2>/dev/null || true
	cd $(FRONTEND_SRC) && rm -rf .next out node_modules/.cache 2>/dev/null || true
	@echo "$(GREEN)✓ Clean complete$(RESET)"

# ---------------------------------------------------------------------------
# all — Full pipeline
# ---------------------------------------------------------------------------
all: qa build
	@echo ""
	@echo "$(GREEN)╔══════════════════════════════════════════════╗$(RESET)"
	@echo "$(GREEN)║  ✓ BRANDSCALE ALL TARGETS PASSED              ║$(RESET)"
	@echo "$(GREEN)╚══════════════════════════════════════════════╝$(RESET)"
