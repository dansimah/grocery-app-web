#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

log() { echo -e "\n\033[1;34m==>\033[0m \033[1m$*\033[0m"; }
err() { echo -e "\033[1;31mERROR:\033[0m $*" >&2; exit 1; }

# ── Pre-flight checks ───────────────────────────────────────────────
command -v node  >/dev/null || err "node not found. Install Node.js 24 first."
command -v npm   >/dev/null || err "npm not found."
command -v pm2   >/dev/null || err "pm2 not found. Run: npm install -g pm2"
[ -f ".env" ]              || err ".env file missing. See DEPLOYMENT.md Step 6.2."

# ── Install dependencies ────────────────────────────────────────────
log "Installing root dependencies"
npm install

log "Installing backend dependencies"
cd backend && npm install && cd ..

log "Installing frontend dependencies"
cd frontend && npm install && cd ..

# ── Database ─────────────────────────────────────────────────────────
log "Running database migrations"
cd backend
node src/config/migrate.js

log "Seeding database"
node src/config/seed.js
cd ..

# ── Build frontend ───────────────────────────────────────────────────
log "Building frontend"
cd frontend && npm run build && cd ..

# ── Prepare logs directory ───────────────────────────────────────────
mkdir -p logs

# ── Start / restart PM2 ─────────────────────────────────────────────
if pm2 describe grocery-backend >/dev/null 2>&1; then
    log "Restarting grocery-backend via PM2"
    pm2 restart grocery-backend
else
    log "Starting grocery-backend via PM2"
    pm2 start ecosystem.config.js
fi

pm2 save

log "Done! App is running on port ${PORT:-3001}"
pm2 status
