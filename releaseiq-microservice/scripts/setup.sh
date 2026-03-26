#!/usr/bin/env bash
# ============================================================
# ReleaseIQ — Local Machine Setup Script
# Run this once on a new machine to get everything running
# Usage: chmod +x scripts/setup.sh && ./scripts/setup.sh
# ============================================================

set -e  # Exit on any error

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[⚠]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info()  { echo -e "${BLUE}[→]${NC} $1"; }

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║        ReleaseIQ — Local Setup Script            ║"
echo "║        ADP Release Management Platform           ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ─── Check prerequisites ──────────────────────────────────────
info "Checking prerequisites..."

if ! command -v node &> /dev/null; then
  error "Node.js is not installed. Install from https://nodejs.org (v18+ required)"
fi

NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 18 ]; then
  error "Node.js v18+ required. Current: $(node -v). Upgrade at https://nodejs.org"
fi
log "Node.js $(node -v)"

if ! command -v npm &> /dev/null; then
  error "npm is not installed"
fi
log "npm $(npm -v)"

# ─── MongoDB setup ────────────────────────────────────────────
info "Checking MongoDB..."

if ! command -v mongod &> /dev/null; then
  warn "MongoDB not found. Attempting to install..."

  OS=$(uname -s)
  if [ "$OS" = "Darwin" ]; then
    if command -v brew &> /dev/null; then
      info "Installing MongoDB via Homebrew..."
      brew tap mongodb/brew 2>/dev/null || true
      brew install mongodb-community@7.0
      brew services start mongodb-community@7.0
      log "MongoDB installed and started via Homebrew"
    else
      error "Homebrew not found. Install MongoDB manually: https://www.mongodb.com/docs/manual/installation/
             OR install Homebrew first: https://brew.sh"
    fi
  elif [ "$OS" = "Linux" ]; then
    DISTRO=$(lsb_release -si 2>/dev/null || echo "Unknown")
    if [ "$DISTRO" = "Ubuntu" ] || [ "$DISTRO" = "Debian" ]; then
      info "Installing MongoDB on Ubuntu/Debian..."
      curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
      echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
      sudo apt-get update -q
      sudo apt-get install -y mongodb-org
      sudo systemctl start mongod
      sudo systemctl enable mongod
      log "MongoDB installed and started"
    else
      error "Unsupported Linux distro. Install MongoDB manually: https://www.mongodb.com/docs/manual/installation/"
    fi
  else
    error "Unsupported OS. Install MongoDB manually: https://www.mongodb.com/docs/manual/installation/"
  fi
else
  log "MongoDB is installed: $(mongod --version | head -1)"
fi

# Verify MongoDB is running
if ! mongosh --quiet --eval "db.runCommand({ connectionStatus: 1 })" &> /dev/null; then
  warn "MongoDB doesn't appear to be running. Attempting to start..."
  OS=$(uname -s)
  if [ "$OS" = "Darwin" ]; then
    brew services start mongodb-community@7.0 2>/dev/null || mongod --fork --logpath /tmp/mongod.log --dbpath /tmp/mongodb-data
  elif [ "$OS" = "Linux" ]; then
    sudo systemctl start mongod 2>/dev/null || mongod --fork --logpath /tmp/mongod.log --dbpath /tmp/mongodb-data
  fi
  sleep 2
  if ! mongosh --quiet --eval "db.runCommand({ connectionStatus: 1 })" &> /dev/null; then
    error "Could not start MongoDB. Start it manually and re-run this script."
  fi
fi
log "MongoDB is running"

# ─── API setup ────────────────────────────────────────────────
info "Setting up API..."

cd "$(dirname "$0")/../api"

# Create .env from local template if not exists
if [ ! -f .env ]; then
  cp src/config/env/.env.local .env
  log "Created api/.env from .env.local template"
else
  warn "api/.env already exists — skipping (delete it to reset)"
fi

info "Installing API dependencies..."
npm install
log "API dependencies installed"

info "Building TypeScript..."
npm run build
log "API built successfully"

info "Seeding database with dummy data..."
npm run seed
log "Database seeded"

# ─── UI setup ─────────────────────────────────────────────────
info "Setting up React UI..."

cd "../ui"

# Create .env.local if not exists
if [ ! -f .env.local ]; then
  cat > .env.local << 'EOF'
# ReleaseIQ UI — Local Environment
VITE_API_URL=http://localhost:4000/api
VITE_AUTH_MODE=mock
VITE_AZURE_CLIENT_ID=your-azure-client-id
VITE_AZURE_TENANT_ID=your-azure-tenant-id
EOF
  log "Created ui/.env.local"
else
  warn "ui/.env.local already exists — skipping"
fi

info "Installing UI dependencies..."
npm install
log "UI dependencies installed"

# ─── Done ─────────────────────────────────────────────────────
cd ..

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║              ✅ Setup Complete!                   ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}Start the platform:${NC}"
echo ""
echo -e "  ${BLUE}Terminal 1 — API:${NC}"
echo "    cd api && npm run dev"
echo ""
echo -e "  ${BLUE}Terminal 2 — UI:${NC}"
echo "    cd ui && npm run dev"
echo ""
echo -e "  ${BLUE}Open browser:${NC}"
echo "    http://localhost:3000"
echo ""
echo -e "${GREEN}Demo accounts (mock auth):${NC}"
echo "  🔴 Main Admin:    john.doe@adp.com"
echo "  🔵 Project Admin: jane.smith@adp.com"
echo "  ⚪ BU Tester:     tester.bu@adp.com"
echo ""
echo -e "${YELLOW}Note:${NC} JIRA_MOCK=true and COPADO_MOCK=true are set by default."
echo "All Jira/Copado calls are simulated. Set to false in api/.env when"
echo "real credentials are available."
echo ""
