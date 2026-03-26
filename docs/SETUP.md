# ReleaseIQ — Local Setup Guide

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | https://nodejs.org |
| npm | 9+ | comes with Node |
| MongoDB | 7.0 | https://www.mongodb.com/docs/manual/installation/ |
| Git | any | https://git-scm.com |

---

## Quick Setup (one command)

```bash
chmod +x scripts/setup.sh && ./scripts/setup.sh
```

This script:
1. Checks Node.js version
2. Installs MongoDB if missing (macOS via Homebrew, Ubuntu via apt)
3. Verifies MongoDB is running
4. Creates `api/.env` from the local template
5. Installs API dependencies
6. Builds TypeScript
7. Seeds the database with dummy data
8. Creates `ui/.env.local`
9. Installs UI dependencies

---

## Manual Setup

### 1. MongoDB

**macOS (Homebrew):**
```bash
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0
```

**Ubuntu:**
```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update && sudo apt-get install -y mongodb-org
sudo systemctl start mongod && sudo systemctl enable mongod
```

**Verify:**
```bash
mongosh --eval "db.runCommand({ connectionStatus: 1 })"
```

### 2. API

```bash
cd api
cp src/config/env/.env.local .env   # copy local config
npm install                          # install dependencies
npm run seed                         # seed database
npm run dev                          # start dev server
```

API runs at `http://localhost:4000`

### 3. UI

```bash
cd ui
cat > .env.local << 'EOF'
VITE_API_URL=http://localhost:4000/api
VITE_AUTH_MODE=mock
EOF
npm install
npm run dev
```

UI runs at `http://localhost:3000`

---

## Demo Accounts

| Role | Email | Access |
|------|-------|--------|
| Main Admin | `john.doe@adp.com` | Full platform — all projects, users, error logs, admin requests |
| Project Admin | `jane.smith@adp.com` | E-Certify SF + SF1 — configure, sync, manage sessions |
| BU Tester | `tester.bu@adp.com` | View all projects, join certification sessions |

---

## Key URLs

| URL | Description |
|-----|-------------|
| `http://localhost:3000` | React application |
| `http://localhost:3000/login` | Login page |
| `http://localhost:3000/cert/:sessionId` | Certification share link |
| `http://localhost:4000/api/health` | API health check |
| `http://localhost:4000/api/projects` | Projects JSON |

---

## Resetting Data

```bash
./scripts/reseed.sh     # drops and re-seeds database
```

Or from the API directory:
```bash
cd api && npm run seed
```

---

## Common Issues

**MongoDB not connecting:**
```bash
# Check if running
ps aux | grep mongod
# Start manually
mongod --dbpath /tmp/mongodb-data --fork --logpath /tmp/mongod.log
```

**Port 4000 already in use:**
```bash
lsof -i :4000 | grep LISTEN
kill -9 <PID>
```

**TypeScript build errors:**
```bash
cd api && npx tsc --noEmit   # check types without building
```

**"Cannot find module" errors:**
```bash
cd api && npm install         # reinstall deps
cd ui && npm install
```

**Seed fails with duplicate key:**
```bash
# The seed script deletes all docs before inserting
# If it still fails, drop the DB manually:
mongosh releaseiq_local --eval "db.dropDatabase()"
cd api && npm run seed
```
