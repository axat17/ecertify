# releaseiq-microservice

Node.js + Express + TypeScript API for the ReleaseIQ platform.

## Quick Start

```bash
cp src/config/env/.env.local .env
npm install
npm run seed      # seed MongoDB with dummy data
npm run dev       # start dev server on :4000
```

## Environments

| File | ENV | Auth | Jira/Copado |
|------|-----|------|-------------|
| `.env.local`      | local      | Mock JWT | Mocked |
| `.env.dit`        | dit        | Azure AD | Mocked |
| `.env.fit`        | fit        | Azure AD | Real |
| `.env.iat`        | iat        | Azure AD | Real |
| `.env.production` | production | Azure AD | Real + Key Vault |

Start in a specific env: `NODE_ENV=fit npm start`

## Structure

```
src/
├── config/
│   ├── index.ts            ← Loads correct .env.{NODE_ENV}
│   └── env/                ← .env.local, .env.dit, .env.fit, .env.iat, .env.production
├── middleware/auth.ts      ← JWT + Azure AD + mock login + role guards
├── models/index.ts         ← All Mongoose models (9 collections)
├── routes/
│   ├── auth.routes.ts
│   ├── project.routes.ts
│   ├── certification.routes.ts   ← Core: join, defect, verify, complete, bulk Jira
│   ├── jira.routes.ts
│   ├── copado.routes.ts
│   ├── admin.routes.ts
│   └── activity.routes.ts
├── types/index.ts          ← All TypeScript interfaces
└── utils/
    ├── db.ts               ← MongoDB connection with retry
    ├── logger.ts           ← Winston
    └── seed.ts             ← Full dummy data seed script
```

## Demo Accounts (mock mode)

| Role | Email |
|------|-------|
| Main Admin | john.doe@adp.com |
| Project Admin | jane.smith@adp.com |
| BU Tester | tester.bu@adp.com |
