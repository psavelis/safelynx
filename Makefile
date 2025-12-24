# Safelynx - Face Recognition Security Platform
# Compatible with macOS M1/M4

.PHONY: help up down build clean test lint docker-up docker-down dev frontend backend db migrate run-all down-all setup-interactive ngrok

SHELL := /bin/zsh
PROJECT_NAME := safelynx
RUST_LOG := info
DATABASE_URL := postgres://safelynx:safelynx@localhost:7888/safelynx
CONFIG_FILE := $(HOME)/.safelynx/config.env

# Load config if exists
-include $(CONFIG_FILE)

# Directories (use absolute paths for reliability)
ROOT_DIR := $(shell pwd)
BACKEND_DIR := $(ROOT_DIR)/backend
FRONTEND_DIR := $(ROOT_DIR)/frontend
SCRIPTS_DIR := $(ROOT_DIR)/scripts
DATA_DIR := $(HOME)/Documents/Safelynx

# Colors
CYAN := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
RESET := \033[0m

help: ## Display this help
	@echo ""
	@echo "  $(CYAN)╔═══════════════════════════════════════════════════════════╗$(RESET)"
	@echo "  $(CYAN)║$(RESET)   $(GREEN)🦁 SAFELYNX$(RESET) - Face Recognition Security Platform     $(CYAN)║$(RESET)"
	@echo "  $(CYAN)╚═══════════════════════════════════════════════════════════╝$(RESET)"
	@echo ""
	@echo "  $(GREEN)Quick Start:$(RESET)"
	@echo "    $(CYAN)make setup$(RESET)     Interactive setup wizard"
	@echo "    $(CYAN)make run-all$(RESET)   Start everything (database, backend, frontend)"
	@echo "    $(CYAN)make down-all$(RESET)  Stop everything"
	@echo "    $(CYAN)make ngrok$(RESET)     Start ngrok tunnels for remote access"
	@echo ""
	@echo "  $(GREEN)All Commands:$(RESET)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "    $(CYAN)%-15s$(RESET) %s\n", $$1, $$2}'
	@echo ""

# =============================================================================
# Main Commands
# =============================================================================

setup: ## 🔧 Interactive setup wizard
	@$(SCRIPTS_DIR)/setup.sh

run-all: ## 🚀 Start everything for production (DB + Backend + Frontend)
	@echo ""
	@echo "  $(CYAN)╔═══════════════════════════════════════════════════════════╗$(RESET)"
	@echo "  $(CYAN)║$(RESET)   $(GREEN)🦁 Starting SAFELYNX$(RESET)                                   $(CYAN)║$(RESET)"
	@echo "  $(CYAN)╚═══════════════════════════════════════════════════════════╝$(RESET)"
	@echo ""
	@if [ ! -f "$(CONFIG_FILE)" ]; then \
		echo "  $(YELLOW)→$(RESET) No configuration found. Running setup..."; \
		$(SCRIPTS_DIR)/setup.sh; \
	fi
	@if [ -f "$(CONFIG_FILE)" ]; then . $(CONFIG_FILE); fi
	@mkdir -p $(DATA_DIR)/recordings $(DATA_DIR)/snapshots $(DATA_DIR)/db $(DATA_DIR)/logs
	@echo "  $(CYAN)→$(RESET) Starting PostgreSQL database..."
	@$(MAKE) docker-up --no-print-directory
	@sleep 2
	@echo "  $(CYAN)→$(RESET) Running database migrations..."
	@cd $(BACKEND_DIR) && DATABASE_URL=$(DATABASE_URL) cargo run --bin migrate 2>/dev/null || true
	@echo "  $(CYAN)→$(RESET) Building backend (release mode)..."
	@cd $(BACKEND_DIR) && cargo build --release 2>&1 | tail -3 || true
	@echo "  $(CYAN)→$(RESET) Starting backend server..."
	@cd $(BACKEND_DIR) && RUST_LOG=$(RUST_LOG) DATABASE_URL=$(DATABASE_URL) ./target/release/safelynx-backend > $(DATA_DIR)/logs/backend.log 2>&1 &
	@sleep 2
	@if command -v npm >/dev/null 2>&1; then \
		echo "  $(CYAN)→$(RESET) Installing frontend dependencies..."; \
		cd $(FRONTEND_DIR) && npm install --silent 2>/dev/null; \
		echo "  $(CYAN)→$(RESET) Starting frontend server..."; \
		cd $(FRONTEND_DIR) && npm run dev > $(DATA_DIR)/logs/frontend.log 2>&1 & \
		sleep 3; \
	fi
	@echo ""
	@echo "  $(GREEN)╔═══════════════════════════════════════════════════════════╗$(RESET)"
	@echo "  $(GREEN)║$(RESET)   $(CYAN)✅ SAFELYNX IS RUNNING$(RESET)                                 $(GREEN)║$(RESET)"
	@echo "  $(GREEN)║$(RESET)                                                           $(GREEN)║$(RESET)"
	@echo "  $(GREEN)║$(RESET)   Frontend:  $(CYAN)http://localhost:7900$(RESET)                       $(GREEN)║$(RESET)"
	@echo "  $(GREEN)║$(RESET)   Backend:   $(CYAN)http://localhost:7889$(RESET)                       $(GREEN)║$(RESET)"
	@echo "  $(GREEN)║$(RESET)   Database:  $(CYAN)localhost:7888$(RESET)                              $(GREEN)║$(RESET)"
	@echo "  $(GREEN)║$(RESET)                                                           $(GREEN)║$(RESET)"
	@echo "  $(GREEN)║$(RESET)   Remote:    $(YELLOW)make ngrok$(RESET) (for browser camera access)    $(GREEN)║$(RESET)"
	@echo "  $(GREEN)║$(RESET)   To stop:   $(YELLOW)make down-all$(RESET)                              $(GREEN)║$(RESET)"
	@echo "  $(GREEN)╚═══════════════════════════════════════════════════════════╝$(RESET)"
	@echo ""
	@if command -v open >/dev/null 2>&1; then \
		sleep 1 && open http://localhost:7900; \
	fi

ngrok: ## 🌐 Start ngrok tunnels for remote camera access
	@echo ""
	@echo "  $(CYAN)╔═══════════════════════════════════════════════════════════╗$(RESET)"
	@echo "  $(CYAN)║$(RESET)   $(GREEN)🌐 Starting ngrok tunnels$(RESET)                             $(CYAN)║$(RESET)"
	@echo "  $(CYAN)╚═══════════════════════════════════════════════════════════╝$(RESET)"
	@echo ""
	@if ! command -v ngrok >/dev/null 2>&1; then \
		echo "  $(RED)✗ ngrok not installed$(RESET)"; \
		echo "  Install with: $(CYAN)brew install ngrok$(RESET)"; \
		echo "  Then run: $(CYAN)ngrok config add-authtoken YOUR_TOKEN$(RESET)"; \
		exit 1; \
	fi
	@echo "  $(CYAN)→$(RESET) Starting backend tunnel (port 7889)..."
	@ngrok http 7889 --log=stdout > $(DATA_DIR)/logs/ngrok-backend.log 2>&1 &
	@sleep 3
	@echo "  $(CYAN)→$(RESET) Starting frontend tunnel (port 7900)..."
	@ngrok http 7900 --log=stdout > $(DATA_DIR)/logs/ngrok-frontend.log 2>&1 &
	@sleep 3
	@echo ""
	@echo "  $(GREEN)ngrok tunnels started!$(RESET)"
	@echo "  Check $(CYAN)http://localhost:4040$(RESET) for tunnel URLs"
	@echo ""
	@echo "  $(YELLOW)Note:$(RESET) Update VITE_API_URL to the ngrok backend URL"
	@echo "  for remote browser camera access."
	@echo ""

ngrok-stop: ## 🛑 Stop ngrok tunnels
	@-pkill -f "ngrok" 2>/dev/null || true
	@echo "  $(GREEN)✅ ngrok tunnels stopped.$(RESET)"

down-all: ## 🛑 Stop all Safelynx services
	@echo ""
	@echo "  $(YELLOW)→$(RESET) Stopping Safelynx services..."
	@-pkill -f "safelynx-backend" 2>/dev/null || true
	@-pkill -f "vite.*7900" 2>/dev/null || true
	@-pkill -f "node.*vite" 2>/dev/null || true
	@$(MAKE) docker-down --no-print-directory
	@echo "  $(GREEN)✅ Safelynx stopped.$(RESET)"
	@echo ""

up: setup docker-up migrate backend-build ## Start Safelynx (PostgreSQL + Backend + Frontend)
	@echo "$(GREEN)Starting Safelynx...$(RESET)"
	@mkdir -p $(DATA_DIR)/recordings $(DATA_DIR)/snapshots $(DATA_DIR)/db
	@$(MAKE) -j2 backend-run frontend-run

down: ## Stop all Safelynx services
	@echo "$(YELLOW)Stopping Safelynx...$(RESET)"
	@-pkill -f "safelynx-backend" 2>/dev/null || true
	@-pkill -f "vite" 2>/dev/null || true
	@$(MAKE) docker-down
	@echo "$(GREEN)Safelynx stopped.$(RESET)"

# =============================================================================
# Development Commands
# =============================================================================

dev: docker-up migrate ## Start development mode with hot reload
	@echo "$(GREEN)Starting development mode...$(RESET)"
	@if command -v npm >/dev/null 2>&1 && [ -d "$(FRONTEND_DIR)/node_modules" ]; then \
		$(MAKE) -j2 backend-dev frontend-dev; \
	else \
		echo "$(YELLOW)npm not available - running backend only$(RESET)"; \
		$(MAKE) backend-dev; \
	fi

backend-dev: ## Run backend with hot reload
	@cd $(BACKEND_DIR) && RUST_LOG=$(RUST_LOG) DATABASE_URL=$(DATABASE_URL) cargo watch -x run 2>/dev/null || \
		(echo "$(YELLOW)cargo-watch not installed. Running without hot reload...$(RESET)" && \
		RUST_LOG=$(RUST_LOG) DATABASE_URL=$(DATABASE_URL) cargo run)

frontend-dev: ## Run frontend with hot reload
	@if command -v npm >/dev/null 2>&1; then cd $(FRONTEND_DIR) && npm run dev; else echo "$(YELLOW)npm not installed$(RESET)"; fi

backend-run: ## Run backend in production mode
	@cd $(BACKEND_DIR) && RUST_LOG=$(RUST_LOG) DATABASE_URL=$(DATABASE_URL) ./target/release/safelynx-backend &

frontend-run: ## Run frontend in production mode
	@if command -v npm >/dev/null 2>&1 && [ -d "$(FRONTEND_DIR)/node_modules" ]; then cd $(FRONTEND_DIR) && npm run preview &; fi

# =============================================================================
# Build Commands
# =============================================================================

build: backend-build frontend-build ## Build both backend and frontend

backend-build: ## Build Rust backend
	@echo "$(CYAN)Building backend...$(RESET)"
	@cd $(BACKEND_DIR) && cargo build --release

frontend-build: ## Build React frontend (requires npm)
	@echo "$(CYAN)Building frontend...$(RESET)"
	@if command -v npm >/dev/null 2>&1; then \
		cd $(FRONTEND_DIR) && npm install && npm run build; \
	else \
		echo "$(YELLOW)npm not installed - skipping frontend build$(RESET)"; \
	fi

# =============================================================================
# Docker Commands
# =============================================================================

docker-up: ## Start PostgreSQL container
	@echo "$(CYAN)Starting PostgreSQL...$(RESET)"
	@mkdir -p $(DATA_DIR)/db
	@docker compose -f docker/docker-compose.yml up -d

docker-down: ## Stop PostgreSQL container
	@echo "$(YELLOW)Stopping PostgreSQL...$(RESET)"
	@docker compose -f docker/docker-compose.yml down

docker-logs: ## View PostgreSQL logs
	@docker compose -f docker/docker-compose.yml logs -f

# =============================================================================
# Database Commands
# =============================================================================

migrate: ## Run database migrations
	@echo "$(CYAN)Running migrations...$(RESET)"
	@cd $(BACKEND_DIR) && DATABASE_URL=$(DATABASE_URL) cargo run --bin migrate

db-reset: ## Reset database (WARNING: destroys all data)
	@echo "$(YELLOW)Resetting database...$(RESET)"
	@docker compose -f docker/docker-compose.yml down -v
	@rm -rf $(DATA_DIR)/db
	@$(MAKE) docker-up
	@sleep 3
	@$(MAKE) migrate

# =============================================================================
# Test Commands
# =============================================================================

test: docker-up ## Run all tests
	@echo "$(CYAN)Running tests...$(RESET)"
	@cd $(BACKEND_DIR) && DATABASE_URL=$(DATABASE_URL) cargo test
	@if command -v npm >/dev/null 2>&1; then cd $(FRONTEND_DIR) && npm test 2>/dev/null || true; fi

test-backend: docker-up ## Run backend tests only
	@echo "$(CYAN)Running backend tests...$(RESET)"
	@cd $(BACKEND_DIR) && DATABASE_URL=$(DATABASE_URL) cargo test

test-coverage: docker-up ## Run tests with coverage
	@echo "$(CYAN)Running tests with coverage...$(RESET)"
	@cd $(BACKEND_DIR) && DATABASE_URL=$(DATABASE_URL) cargo tarpaulin --out Html
	@if command -v npm >/dev/null 2>&1; then cd $(FRONTEND_DIR) && npm run test:coverage 2>/dev/null || true; fi

test-integration: docker-up ## Run integration tests
	@cd $(BACKEND_DIR) && DATABASE_URL=$(DATABASE_URL) cargo test --features integration

# =============================================================================
# Quality Commands
# =============================================================================

lint: ## Run linters
	@cd $(BACKEND_DIR) && cargo clippy -- -D warnings
	@if command -v npm >/dev/null 2>&1 && [ -d "$(FRONTEND_DIR)/node_modules" ]; then cd $(FRONTEND_DIR) && npm run lint 2>/dev/null || true; fi

fmt: ## Format code
	@cd $(BACKEND_DIR) && cargo fmt
	@if command -v npm >/dev/null 2>&1 && [ -d "$(FRONTEND_DIR)/node_modules" ]; then cd $(FRONTEND_DIR) && npm run format 2>/dev/null || true; fi

check: lint test ## Run all checks

# =============================================================================
# Setup Commands
# =============================================================================

setup: check-prereqs ## Install dependencies
	@echo "$(CYAN)Setting up Safelynx...$(RESET)"
	@mkdir -p $(DATA_DIR)/recordings $(DATA_DIR)/snapshots $(DATA_DIR)/db
	@command -v rustc >/dev/null 2>&1 || (echo "Installing Rust..." && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh)
	@if command -v npm >/dev/null 2>&1; then cd $(FRONTEND_DIR) && npm install; else echo "$(YELLOW)npm not found - skipping frontend setup. Install Node.js for frontend.$(RESET)"; fi
	@echo "$(GREEN)Setup complete!$(RESET)"

check-prereqs: ## Check prerequisites
	@echo "$(CYAN)Checking prerequisites...$(RESET)"
	@echo -n "  Rust:     " && (command -v rustc >/dev/null 2>&1 && echo "$(GREEN)✓ $(shell rustc --version | cut -d' ' -f2)$(RESET)" || echo "$(YELLOW)✗ Not installed (will install)$(RESET)")
	@echo -n "  Cargo:    " && (command -v cargo >/dev/null 2>&1 && echo "$(GREEN)✓ $(shell cargo --version | cut -d' ' -f2)$(RESET)" || echo "$(YELLOW)✗ Not installed$(RESET)")
	@echo -n "  Docker:   " && (command -v docker >/dev/null 2>&1 && echo "$(GREEN)✓ $(shell docker --version | cut -d' ' -f3 | tr -d ',')$(RESET)" || echo "$(YELLOW)✗ Not installed$(RESET)")
	@echo -n "  Node.js:  " && (command -v node >/dev/null 2>&1 && echo "$(GREEN)✓ $(shell node --version)$(RESET)" || echo "$(YELLOW)✗ Not installed (optional for frontend)$(RESET)")
	@echo -n "  npm:      " && (command -v npm >/dev/null 2>&1 && echo "$(GREEN)✓ $(shell npm --version)$(RESET)" || echo "$(YELLOW)✗ Not installed (optional for frontend)$(RESET)")
	@echo ""

clean: ## Clean build artifacts
	@cd $(BACKEND_DIR) && cargo clean
	@if [ -d "$(FRONTEND_DIR)/node_modules" ]; then cd $(FRONTEND_DIR) && rm -rf node_modules dist; fi
	@echo "$(GREEN)Cleaned.$(RESET)"

# =============================================================================
# Utility Commands
# =============================================================================

logs: ## View all logs
	@tail -f $(DATA_DIR)/logs/*.log

status: ## Check service status
	@echo "$(CYAN)Safelynx Status$(RESET)"
	@echo "==============="
	@echo -n "PostgreSQL: " && (docker ps | grep -q safelynx-postgres && echo "$(GREEN)Running$(RESET)" || echo "$(YELLOW)Stopped$(RESET)")
	@echo -n "Backend:    " && (pgrep -f "safelynx-backend" >/dev/null && echo "$(GREEN)Running$(RESET)" || echo "$(YELLOW)Stopped$(RESET)")
	@echo -n "Frontend:   " && (pgrep -f "vite" >/dev/null && echo "$(GREEN)Running$(RESET)" || echo "$(YELLOW)Stopped$(RESET)")
