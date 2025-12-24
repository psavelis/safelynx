#!/bin/bash

# =============================================================================
# SAFELYNX - Interactive Setup Script
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
RESET='\033[0m'

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PROJECT_ROOT/.safelynx.env"

# Default values
DEFAULT_DB_HOST="localhost"
DEFAULT_DB_PORT="7888"
DEFAULT_DB_NAME="safelynx"
DEFAULT_DB_USER="safelynx"
DEFAULT_DB_PASSWORD="safelynx_secret"
DEFAULT_API_PORT="7889"
DEFAULT_FRONTEND_PORT="7900"
DEFAULT_DATA_DIR="$PROJECT_ROOT/data"

echo ""
echo -e "  ${CYAN}╔═══════════════════════════════════════════════════════════╗${RESET}"
echo -e "  ${CYAN}║${RESET}   ${GREEN}🦁 SAFELYNX Setup Wizard${RESET}                              ${CYAN}║${RESET}"
echo -e "  ${CYAN}╚═══════════════════════════════════════════════════════════╝${RESET}"
echo ""

# Check for existing config
if [ -f "$CONFIG_FILE" ]; then
    echo -e "  ${YELLOW}⚠${RESET}  Existing configuration found at: ${CYAN}$CONFIG_FILE${RESET}"
    echo ""
    read -p "     Do you want to overwrite it? [y/N]: " overwrite
    if [[ ! "$overwrite" =~ ^[Yy]$ ]]; then
        echo -e "  ${GREEN}✓${RESET}  Using existing configuration."
        exit 0
    fi
    echo ""
fi

echo -e "  ${WHITE}Press Enter to use default values shown in [brackets]${RESET}"
echo ""

# Database Configuration
echo -e "  ${CYAN}━━━ Database Configuration ━━━${RESET}"
echo ""

read -p "     Database Host [$DEFAULT_DB_HOST]: " DB_HOST
DB_HOST=${DB_HOST:-$DEFAULT_DB_HOST}

read -p "     Database Port [$DEFAULT_DB_PORT]: " DB_PORT
DB_PORT=${DB_PORT:-$DEFAULT_DB_PORT}

read -p "     Database Name [$DEFAULT_DB_NAME]: " DB_NAME
DB_NAME=${DB_NAME:-$DEFAULT_DB_NAME}

read -p "     Database User [$DEFAULT_DB_USER]: " DB_USER
DB_USER=${DB_USER:-$DEFAULT_DB_USER}

read -sp "     Database Password [$DEFAULT_DB_PASSWORD]: " DB_PASSWORD
DB_PASSWORD=${DB_PASSWORD:-$DEFAULT_DB_PASSWORD}
echo ""
echo ""

# Server Configuration
echo -e "  ${CYAN}━━━ Server Configuration ━━━${RESET}"
echo ""

read -p "     Backend API Port [$DEFAULT_API_PORT]: " API_PORT
API_PORT=${API_PORT:-$DEFAULT_API_PORT}

read -p "     Frontend Port [$DEFAULT_FRONTEND_PORT]: " FRONTEND_PORT
FRONTEND_PORT=${FRONTEND_PORT:-$DEFAULT_FRONTEND_PORT}

read -p "     Data Directory [$DEFAULT_DATA_DIR]: " DATA_DIR
DATA_DIR=${DATA_DIR:-$DEFAULT_DATA_DIR}
echo ""

# Optional: ngrok Configuration
echo -e "  ${CYAN}━━━ Remote Access (Optional) ━━━${RESET}"
echo ""
read -p "     Enable ngrok tunnel for remote access? [y/N]: " enable_ngrok
ENABLE_NGROK="false"
NGROK_AUTHTOKEN=""

if [[ "$enable_ngrok" =~ ^[Yy]$ ]]; then
    ENABLE_NGROK="true"
    read -p "     ngrok Auth Token (from ngrok.com dashboard): " NGROK_AUTHTOKEN
fi
echo ""

# Optional: Detection Settings
echo -e "  ${CYAN}━━━ Detection Settings ━━━${RESET}"
echo ""
read -p "     Minimum Confidence Threshold (0.0-1.0) [0.6]: " MIN_CONFIDENCE
MIN_CONFIDENCE=${MIN_CONFIDENCE:-0.6}

read -p "     Log Level (debug/info/warn/error) [info]: " LOG_LEVEL
LOG_LEVEL=${LOG_LEVEL:-info}
echo ""

# Build DATABASE_URL
DATABASE_URL="postgres://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"

# Create configuration file
echo -e "  ${CYAN}→${RESET} Creating configuration file..."

cat > "$CONFIG_FILE" << EOF
# SAFELYNX Configuration
# Generated on $(date)

# Database
export DATABASE_URL="$DATABASE_URL"
export POSTGRES_USER="$DB_USER"
export POSTGRES_PASSWORD="$DB_PASSWORD"
export POSTGRES_DB="$DB_NAME"
export DB_HOST="$DB_HOST"
export DB_PORT="$DB_PORT"

# Server
export API_PORT="$API_PORT"
export FRONTEND_PORT="$FRONTEND_PORT"
export RUST_LOG="$LOG_LEVEL"

# Storage
export DATA_DIR="$DATA_DIR"

# Detection
export MIN_CONFIDENCE="$MIN_CONFIDENCE"

# ngrok (Remote Access)
export ENABLE_NGROK="$ENABLE_NGROK"
export NGROK_AUTHTOKEN="$NGROK_AUTHTOKEN"
EOF

# Create data directories
echo -e "  ${CYAN}→${RESET} Creating data directories..."
mkdir -p "$DATA_DIR/recordings"
mkdir -p "$DATA_DIR/snapshots"
mkdir -p "$DATA_DIR/db"
mkdir -p "$DATA_DIR/logs"

# Update frontend .env if needed
FRONTEND_ENV="$PROJECT_ROOT/frontend/.env"
echo -e "  ${CYAN}→${RESET} Updating frontend environment..."
cat > "$FRONTEND_ENV" << EOF
VITE_API_URL=http://localhost:$API_PORT
VITE_WS_URL=ws://localhost:$API_PORT/ws
EOF

echo ""
echo -e "  ${GREEN}╔═══════════════════════════════════════════════════════════╗${RESET}"
echo -e "  ${GREEN}║${RESET}   ${WHITE}✓ Setup Complete!${RESET}                                     ${GREEN}║${RESET}"
echo -e "  ${GREEN}╚═══════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${WHITE}Configuration saved to:${RESET} ${CYAN}$CONFIG_FILE${RESET}"
echo ""
echo -e "  ${WHITE}Quick Start:${RESET}"
echo -e "    ${CYAN}make run-all${RESET}      Start everything (DB + Backend + Frontend)"
echo -e "    ${CYAN}make dev${RESET}          Development mode with hot reload"
echo ""
echo -e "  ${WHITE}Access Points:${RESET}"
echo -e "    ${CYAN}Frontend:${RESET}         http://localhost:$FRONTEND_PORT"
echo -e "    ${CYAN}Backend API:${RESET}      http://localhost:$API_PORT"
echo -e "    ${CYAN}API Docs:${RESET}         http://localhost:$API_PORT/api/docs"
echo ""

if [[ "$ENABLE_NGROK" == "true" ]]; then
    echo -e "  ${WHITE}Remote Access:${RESET}"
    echo -e "    ${CYAN}make ngrok${RESET}        Start ngrok tunnel"
    echo ""
fi

echo -e "  ${YELLOW}Tip:${RESET} Run ${CYAN}make help${RESET} to see all available commands."
echo ""
