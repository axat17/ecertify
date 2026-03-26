# releaseiq-ui

React 18 + Vite frontend for the ReleaseIQ platform.

## Structure

```
src/
├── common/              ← Reusable atoms used across all features
│   ├── components/
│   │   ├── Badge.tsx    ← Badge, StatusBadge, statusToVariant
│   │   ├── Button.tsx   ← Button with variants/sizes/loading
│   │   └── UI.tsx       ← Card, Modal, Table, Field, Alert, Metric,
│   │                       ProgressBar, Tabs, StepPipeline, EnvCheckGroup…
│   ├── hooks/
│   │   └── index.ts     ← useToast, useClipboard, useDebounce, useTimer,
│   │                       usePoll, useLocalStorage
│   ├── utils/
│   │   └── index.ts     ← fmtDate, fmtDuration, healthColor, avatarColor,
│   │                       biWeeklyDate, isValidEmail, ROLE_LABELS, TEAMS…
│   └── types/
│       └── index.ts     ← Re-exports all shared types from services/api
│
├── apps/                ← Feature-level folders (page + sub-components)
│   ├── auth/
│   │   └── LoginPage.tsx
│   ├── dashboard/
│   │   ├── HomePage.tsx
│   │   └── components/  ← HeroStats, QuickActions, ProjectTile,
│   │                       ProjectListTable, ActivityFeed
│   ├── certification/
│   │   ├── CertSessionPage.tsx
│   │   ├── ActiveSessionsPage.tsx
│   │   └── components/  ← JoinForm, DefectForm, SessionTimer, JiraBulkModal,
│   │                       DefectItem, SessionCompleteSummary, ActiveSessionRow
│   ├── project/
│   │   ├── ProjectPage.tsx
│   │   └── components/  ← BundleCard, CopadoPipelineBar, TeamViewPanel, LabelTable
│   └── admin/
│       ├── AdminPage.tsx
│       └── components/  ← ProjectAdminPanel, CopadoConfigForm,
│                           AccessRequestPanel, CreateProjectPanel,
│                           AdminRequestCard, ErrorLogRow, UserRow
│
├── layout/
│   ├── Layout.tsx       ← Shell with Outlet
│   ├── Sidebar.tsx      ← Collapsible sidebar, project nav
│   └── Header.tsx       ← Top bar + ToastContainer
│
├── services/api.ts      ← All typed Axios calls
└── store/authStore.ts   ← Zustand auth state (persisted)
```

## Quick Start

```bash
cp .env.example .env.local   # or create manually (see below)
npm install
npm run dev
```

`.env.local`:
```
VITE_API_URL=http://localhost:4000/api
VITE_AUTH_MODE=mock
```

## Routes

| Path | Component | Auth |
|------|-----------|------|
| `/login` | auth/LoginPage | Public |
| `/cert/:sessionId` | certification/CertSessionPage | Public (UUID = credential) |
| `/` | dashboard/HomePage | Required |
| `/projects/:id` | project/ProjectPage | Required |
| `/projects/:id/sessions` | certification/ActiveSessionsPage | Required |
| `/admin` | admin/AdminPage | Required (admin role) |
