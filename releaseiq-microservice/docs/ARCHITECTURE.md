# ReleaseIQ — Architecture Document
**ADP Release Management Platform**
Version 1.0 | March 2026

---

## Executive Summary

ReleaseIQ is an internal ADP platform that centralizes Salesforce and React release management. It replaces manual spreadsheet tracking and disconnected Slack coordination with a unified dashboard, real-time Jira sync, Copado bundle tracking, and a structured certification workflow for release night.

**Key outcomes:**
- Release managers see every team's Jira story status in one screen
- BU testers join certification via a shared link — no login required
- All defects logged during certification auto-populate Jira bulk-create
- Copado promotion status and Apex test coverage tracked in real time
- Session data persists in MongoDB — closing a browser does not lose session

---

## System Architecture

```mermaid
graph TB
    subgraph Client["Browser / Client"]
        UI["React 18 + Vite\n(Port 3000)"]
        MSAL["MSAL.js\nAzure SSO"]
    end

    subgraph API["Node.js Express API (Port 4000)"]
        AUTH["Auth Middleware\nJWT + Azure AD"]
        PROJ["Project Routes"]
        CERT["Certification Routes\n(core feature)"]
        JIRA_R["Jira Routes\n(sync + labels)"]
        COP_R["Copado Routes\n(bundles + Apex)"]
        ADM["Admin Routes"]
        ACT["Activity Routes"]
    end

    subgraph Data["Data Layer"]
        MONGO[("MongoDB\nPort 27017")]
    end

    subgraph External["External APIs (mocked locally)"]
        JIRA_API["Jira Cloud\nREST API v3"]
        COP_API["Copado\nSalesforce API"]
        AZ_AD["Azure AD\nMSAL OAuth 2.0"]
    end

    UI --> |"JWT Bearer"| API
    MSAL --> AZ_AD
    AZ_AD --> |"ID Token"| AUTH
    AUTH --> MONGO
    PROJ --> MONGO
    CERT --> MONGO
    JIRA_R --> MONGO
    JIRA_R --> |"JIRA_MOCK=false"| JIRA_API
    COP_R --> MONGO
    COP_R --> |"COPADO_MOCK=false"| COP_API
    ADM --> MONGO
    ACT --> MONGO
```

---

## Data Flow: Certification Session Lifecycle

```mermaid
sequenceDiagram
    participant RM as Release Manager
    participant UI as React UI
    participant API as Express API
    participant DB as MongoDB
    participant BU as BU Tester

    RM->>UI: Opens project → Cert tab
    UI->>API: GET /certifications/project/:id
    API->>DB: Find sessions for release
    DB-->>API: Sessions list
    API-->>UI: Active + completed sessions

    RM->>UI: Copies certification link
    RM->>BU: Shares link via Slack/email

    BU->>UI: Clicks link (/cert/:sessionId)
    UI->>API: GET /certifications/:sessionId/resume
    API->>DB: Find session by UUID
    DB-->>API: Session (or null = new certifier)
    API-->>UI: Session data + project info

    Note over BU,UI: If no session: shows Join form

    BU->>UI: Fills in name, role, BU
    UI->>API: POST /certifications/join
    API->>DB: Create CertificationSession document
    DB-->>API: New session with UUID
    API-->>UI: Session created, timer starts

    loop During Testing
        BU->>UI: Logs defect
        UI->>API: PATCH /certifications/:id/defect
        API->>DB: Push defect to session.defects[]
        DB-->>API: Updated session
        API-->>UI: Defect confirmed

        BU->>UI: Checks off story
        UI->>API: PATCH /certifications/:id/verify-story
        API->>DB: Push to verifiedStoryKeys[]
    end

    BU->>UI: Clicks Complete & Certify
    UI->>API: POST /certifications/:id/complete
    API->>DB: Set status=Complete, completedAt=now
    API-->>UI: Session complete

    BU->>UI: Reviews defects → Create Jira Issues
    UI->>API: POST /certifications/:id/create-jira-issues
    API->>DB: Update defect.jiraIssueKey per defect
    Note over API: JIRA_MOCK=true: simulates creation\nJIRA_MOCK=false: calls Jira REST API
    API-->>UI: Issue keys returned

    RM->>UI: Views Active Sessions page
    UI->>API: GET /certifications/active
    API->>DB: Find all In Progress sessions
    API-->>UI: Live session list (auto-refreshes 30s)
```

---

## Data Flow: Jira Sync

```mermaid
sequenceDiagram
    participant UI as React UI
    participant API as Express API
    participant DB as MongoDB
    participant JIRA as Jira Cloud API

    UI->>API: POST /jira/sync/:projectId
    API->>DB: Set project.syncStatus = 'syncing'

    alt JIRA_MOCK=true (local dev)
        API->>API: Generate mock story payload
        Note over API: Mirrors real Jira API response shape
    else JIRA_MOCK=false (FIT/IAT/PROD)
        API->>JIRA: GET /rest/api/3/search?jql=project={key} AND fixVersion={label}
        JIRA-->>API: Issue list (paginated, up to 500)
        Note over API: Retry up to 3x on failure
    end

    API->>DB: bulkWrite upsert JiraStory documents
    API->>DB: bulkWrite upsert JiraFixVersion per team
    API->>DB: project.syncStatus = 'synced', lastJiraSync = now
    API->>DB: Create Activity record

    API-->>UI: { storyCount, syncedAt }
    UI->>UI: Invalidate React Query cache
    UI->>API: GET /jira/stories/:projectId
    API->>DB: Find stories (with filters)
    DB-->>API: Stories array
    API-->>UI: Stories + label counts
```

---

## MongoDB Collections

```mermaid
erDiagram
    Project {
        string projectId PK
        string name
        string type
        string releaseLabel
        string jiraKey
        object copadoConfig
        boolean isLive
        string syncStatus
        date lastJiraSync
    }

    CertificationSession {
        string sessionId PK
        string projectId FK
        string releaseVersion
        string certifierEmail
        string certifierRole
        string status
        array defects
        array verifiedStoryKeys
        number durationSeconds
        boolean jiraIssuesCreated
    }

    JiraStory {
        string key PK
        string projectId FK
        string releaseVersion
        string team
        string status
        array labels
        boolean hasCopadoCICD
        boolean hasReleaseLabel
        string bundle
    }

    JiraFixVersion {
        string team
        string projectId FK
        string versionName
        number storyCount
        number doneCount
        number inProgressCount
    }

    CopadoBundle {
        string name
        string projectId FK
        number bundleNumber
        string status
        array promotions
        object apexResults
        object validationResult
    }

    User {
        string email PK
        string role
        string azureOid
        array projectAdminOf
    }

    AdminRequest {
        string requestId PK
        string projectId FK
        string requesterEmail
        string status
    }

    ErrorLog {
        string context
        string message
        string projectId FK
        string level
        boolean resolved
    }

    Activity {
        string projectId FK
        string type
        string message
        string actorEmail
    }

    Project ||--o{ CertificationSession : "has"
    Project ||--o{ JiraStory : "syncs"
    Project ||--o{ JiraFixVersion : "tracks"
    Project ||--o{ CopadoBundle : "deploys"
    Project ||--o{ AdminRequest : "receives"
    Project ||--o{ Activity : "logs"
    Project ||--o{ ErrorLog : "records"
```

---

## Environment Architecture

```mermaid
graph LR
    LOCAL["LOCAL\nDev Laptop\n:4000 + :3000\nMock Auth\nMock Jira\nMock Copado"]
    DIT["DIT\nDev Integration\nAzure SSO\nMock Jira\nMock Copado"]
    FIT["FIT\nFunctional Integration\nAzure SSO\nReal Jira\nReal Copado"]
    IAT["IAT\nAcceptance Testing\nAzure SSO\nReal Jira\nReal Copado"]
    PROD["PROD\nProduction\nAzure SSO\nReal Jira\nReal Copado\nKey Vault Secrets"]

    LOCAL --> DIT --> FIT --> IAT --> PROD

    style LOCAL fill:#d1fae5
    style DIT fill:#dbeafe
    style FIT fill:#fef3c7
    style IAT fill:#ede9fe
    style PROD fill:#fee2e2
```

---

## API Endpoint Map

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/mock-login` | None | Local dev login |
| POST | `/api/auth/azure/callback` | None | Azure AD token exchange |
| GET | `/api/auth/me` | JWT | Current user profile |
| GET | `/api/projects` | JWT | List all projects |
| GET | `/api/projects/:id` | JWT | Single project |
| POST | `/api/projects` | Main Admin | Create project |
| PATCH | `/api/projects/:id` | Project Admin | Update settings |
| POST | `/api/projects/:id/toggle-live` | Project Admin | Toggle LIVE status |
| GET | `/api/certifications/active` | JWT | All in-progress sessions |
| GET | `/api/certifications/project/:id` | JWT | Sessions for project |
| GET | `/api/certifications/:sessionId` | JWT | Single session |
| GET | `/api/certifications/:sessionId/resume` | **None** | Resume via share link |
| POST | `/api/certifications/join` | JWT | Create/join session |
| PATCH | `/api/certifications/:id/defect` | JWT | Log a defect |
| PATCH | `/api/certifications/:id/verify-story` | JWT | Mark story verified |
| POST | `/api/certifications/:id/complete` | JWT | Complete session |
| POST | `/api/certifications/:id/create-jira-issues` | JWT | Bulk create Jira bugs |
| POST | `/api/jira/sync/:projectId` | JWT | Trigger Jira sync |
| GET | `/api/jira/stories/:projectId` | JWT | Get synced stories |
| GET | `/api/jira/fix-versions/:projectId` | JWT | Fix version breakdown |
| PATCH | `/api/jira/story/:id/:key/label` | Project Admin | Add Jira label |
| GET | `/api/copado/bundles/:projectId` | JWT | Get Copado bundles |
| POST | `/api/copado/sync/:projectId` | Project Admin | Sync from Copado |
| POST | `/api/copado/test-connection` | Project Admin | Test Copado credentials |
| GET | `/api/admin/requests` | Main Admin | List access requests |
| POST | `/api/admin/requests` | JWT | Submit access request |
| PATCH | `/api/admin/requests/:id/approve` | Main Admin | Approve request |
| PATCH | `/api/admin/requests/:id/deny` | Main Admin | Deny request |
| GET | `/api/admin/errors` | JWT | Error log |
| DELETE | `/api/admin/errors` | Main Admin | Clear error log |
| GET | `/api/admin/users` | Main Admin | List all users |
| GET | `/api/activity` | JWT | Activity feed |

---

## Security Model

| Role | Can Do |
|------|--------|
| **Main Admin** | Everything — create/delete projects, manage all users, approve access requests, view all error logs |
| **Project Admin** | Configure their project(s), trigger syncs, manage Copado config, view project error logs |
| **User** | View all projects, join certification sessions (via link or auth) |
| **Unauthenticated** | Resume cert session via UUID share link only (`/cert/:sessionId`) |

**Certification link security model:** The session UUID (`/cert/:sessionId`) is the credential for BU testers. No SSO required to land on the join screen. This is intentional — external BU testers who may not have Azure AD need to join. The join form collects their name + email + role as the identity.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| API Framework | Express.js + TypeScript | 4.18 / 5.2 |
| Database | MongoDB + Mongoose | 7.0 / 7.6 |
| Auth (Prod) | Azure AD MSAL + JWT | MSAL v3 |
| Auth (Dev) | Mock JWT | — |
| Frontend | React + Vite | 18 / 5.0 |
| State (Server) | TanStack React Query | v5 |
| State (Client) | Zustand | v4 |
| HTTP Client | Axios | v1.6 |
| Routing | React Router | v6 |
| Logging | Winston | v3 |
| Cron | node-cron | v3 |

---

## Local Development Quick Start

```bash
# 1. Clone and setup
git clone <repo>
cd releaseiq
chmod +x scripts/setup.sh
./scripts/setup.sh       # installs deps, seeds DB

# 2. Start API (Terminal 1)
cd api && npm run dev     # http://localhost:4000

# 3. Start UI (Terminal 2)
cd ui && npm run dev      # http://localhost:3000

# 4. Login with demo account
# Go to http://localhost:3000
# Use: john.doe@adp.com (Main Admin)
#      jane.smith@adp.com (Project Admin)
#      tester.bu@adp.com (BU Tester)
```

---

## Connecting Real APIs

See [`docs/CONNECTING_REAL_APIS.md`](./CONNECTING_REAL_APIS.md) for step-by-step instructions on connecting Jira, Copado, and Azure AD.
