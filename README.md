# ReleaseIQ — ADP Release Management Platform

A centralized platform for managing Salesforce and React release certifications, Jira sync, Copado bundle tracking, and team coordination.

## Quick Start

```bash
chmod +x scripts/setup.sh && ./scripts/setup.sh
```

Then in two terminals:
```bash
# Terminal 1
cd api && npm run dev

# Terminal 2  
cd ui && npm run dev
```

Open `http://localhost:3000` and log in with `john.doe@adp.com` (Main Admin).

## Documentation

| Doc | Description |
|-----|-------------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System design, diagrams, API map — **start here for manager presentation** |
| [`docs/FEATURES.md`](docs/FEATURES.md) | Every feature explained with data flow and code locations |
| [`docs/SETUP.md`](docs/SETUP.md) | Detailed local setup guide and troubleshooting |
| [`docs/CONNECTING_REAL_APIS.md`](docs/CONNECTING_REAL_APIS.md) | Step-by-step: Jira, Copado, Azure AD integration |

## Project Structure

```
releaseiq/
├── api/                    # Node.js Express API (TypeScript)
│   ├── src/
│   │   ├── config/         # Config loader + env files per environment
│   │   │   └── env/        # .env.local, .env.dit, .env.fit, .env.iat, .env.production
│   │   ├── middleware/     # auth.ts — JWT + Azure AD + mock login
│   │   ├── models/         # Mongoose models (all collections)
│   │   ├── routes/         # auth, projects, certifications, jira, copado, admin, activity
│   │   ├── types/          # Shared TypeScript interfaces
│   │   └── utils/          # logger, db connection, seed script
│   ├── package.json
│   └── tsconfig.json
│
├── ui/                     # React 18 + Vite (TypeScript)
│   ├── src/
│   │   ├── components/
│   │   │   └── layout/     # Layout.tsx — sidebar + header shell
│   │   ├── pages/          # HomePage, ProjectPage, CertSessionPage, ActiveSessionsPage, AdminPage, LoginPage
│   │   ├── services/       # api.ts — typed Axios calls for every endpoint
│   │   └── store/          # authStore.ts — Zustand auth state
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
│
├── docs/                   # Documentation
├── scripts/
│   ├── setup.sh            # One-command local setup
│   └── reseed.sh           # Reset + reseed database
└── README.md
```

## Environments

| Env | Auth | Jira | Copado | Notes |
|-----|------|------|--------|-------|
| LOCAL | Mock | Mock | Mock | Any email works |
| DIT | Azure SSO | Mock | Mock | Dev integration |
| FIT | Azure SSO | Real | Real | Functional testing |
| IAT | Azure SSO | Real | Real | Acceptance testing |
| PROD | Azure SSO | Real | Real | Azure Key Vault secrets |

## Tech Stack

- **API**: Node.js + Express + TypeScript + MongoDB/Mongoose
- **Frontend**: React 18 + Vite + TanStack Query v5 + Zustand
- **Auth**: Azure AD MSAL (prod) / Mock JWT (local)
- **External**: Jira Cloud REST API v3, Copado Salesforce API
