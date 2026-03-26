# ReleaseIQ — Feature Reference
This document describes every feature, its data flow, and where the code lives.
Written for an LLM or developer picking up this codebase.

---

## 1. Project Management

**What it does:** Stores and displays Salesforce and React projects with their release schedules, health scores, Jira labels, and team info.

**Key fields:**
- `projectId` — URL-safe slug (e.g. `ecertify`, `sf1`)
- `releaseLabel` — must match Jira fix version exactly (e.g. `Salesforce_26.14`)
- `copadoCICD` — the Copado Jira label (e.g. `CopadoCICD`)
- `releaseAnchorDate` — used to compute bi-weekly schedule
- `syncStatus` — `never | syncing | synced | error | stale`
- `isLive` — shown as red LIVE badge, gates cert link prominence

**Release schedule calculation:** The bi-weekly dates are computed in the UI from `releaseAnchorDate` by offsetting ±N×14 days. This is pure client-side math — no date storage per release.

**API:** `GET /api/projects`, `POST /api/projects`, `PATCH /api/projects/:id`

**Models:** `Project` in `api/src/models/index.ts`

**UI:** `HomePage.tsx` (tile + list views), `ProjectPage.tsx` (detail)

---

## 2. Jira Sync Engine

**What it does:** Pulls all Jira stories for a project's current fix version and stores them in MongoDB. Stories are then served from MongoDB — no Jira calls at read time.

**Sync trigger:** Manual (button in UI or `POST /api/jira/sync/:projectId`). Background auto-sync is scaffolded via `node-cron` but not enabled by default.

**Mock mode (`JIRA_MOCK=true`):**
- Generates realistic story payloads in `jira.routes.ts` → `buildMockJiraPayload()`
- Mirrors the real Jira Cloud REST API v3 response shape exactly
- Stories have random label assignments to show missing label warnings

**Real mode (`JIRA_MOCK=false`):**
- Calls `GET /rest/api/3/search?jql=project="{key}" AND fixVersion="{label}"&maxResults=500`
- Auth: `Basic base64({JIRA_USER_EMAIL}:{JIRA_API_TOKEN})`
- Retries 3× with exponential backoff

**Stale detection:** If `lastJiraSync` is older than `SYNC_STALE_THRESHOLD_MINUTES` (default 30), the UI shows a yellow banner. The project's `syncStatus` is set to `stale` by a cron job (scaffolded in `server.ts`).

**Two required Jira labels rule:**
Every story needs two labels to appear in Copado bundles:
1. `CopadoCICD` — links story to Copado pipeline
2. `Salesforce_26.14` (the release label) — scopes the story to this release

Stories missing either label are flagged in the Jira Labels tab with "Fix All" button which calls `PATCH /api/jira/story/:projectId/:key/label`.

**Fix versions per team:** After syncing stories, the engine aggregates done/in-progress/todo counts per team and upserts `JiraFixVersion` documents. These power the Team View consolidated + drill-down display.

**API:** `POST /api/jira/sync/:id`, `GET /api/jira/stories/:id`, `GET /api/jira/fix-versions/:id`, `PATCH /api/jira/story/:id/:key/label`

**Models:** `JiraStory`, `JiraFixVersion` in `api/src/models/index.ts`

---

## 3. Copado Bundle Tracking

**What it does:** Tracks Copado deployment bundles including promotion status per environment (DEV→SIT→UAT→STG→PROD), Apex test results, and validation checks.

**Bundle structure:** 1–3 bundles per release. Each bundle covers a set of teams' stories. DevOps manually creates bundles in Copado — ReleaseIQ reads them via API.

**Mock mode:** Pre-seeded bundles in `seed.ts` with realistic promotion progressions.

**Real mode (`COPADO_MOCK=false`):** Calls Copado Salesforce REST API. See `CONNECTING_REAL_APIS.md` for endpoint details.

**Apex coverage threshold:** Stored in `project.copadoConfig.apexCoverageThreshold` (default 75%). Displayed as red/yellow/green in bundle detail. Salesforce requires ≥75% or deployment fails.

**API:** `GET /api/copado/bundles/:id`, `POST /api/copado/sync/:id`, `POST /api/copado/test-connection`

**Models:** `CopadoBundle` in `api/src/models/index.ts`

---

## 4. Certification Session (Core Feature)

**What it does:** Manages structured release night testing sessions. BU Reps, QA Teams, and Release Managers join sessions via a shared link, log defects, verify stories, then complete and optionally bulk-create Jira bugs.

**Session persistence:** Sessions are stored in MongoDB as `CertificationSession` documents with a UUID `sessionId`. The session survives:
- Page refresh
- Browser close
- Tab switch
- Loss of the share link (Release Manager can recover from Active Sessions page)

**Share link format:** `{origin}/cert/{sessionId}`
- No auth required to land on this URL — the UUID IS the credential
- Landing shows a Join form (name, role, BU, environment)
- If the certifier already has an In Progress session for this release + email, the API returns their existing session (resume behavior)

**Join flow:**
1. `POST /api/certifications/join` with `{projectId, releaseVersion, certifierName, certifierEmail, certifierRole, businessUnit, environment}`
2. Server checks for existing active session for this email+project+release
3. If exists → returns it with `resumed: true`
4. If not → creates new `CertificationSession` document
5. UI starts elapsed timer from `session.startedAt`

**Defect logging:**
- `PATCH /api/certifications/:id/defect`
- Severity → Jira Priority mapping: Critical→Highest, Major→High, Minor→Medium
- `queuedForJira: true` marks defect for bulk Jira creation at session end
- Defect is pushed to `session.defects[]` array in MongoDB — atomic update

**Story verification:**
- `PATCH /api/certifications/:id/verify-story`
- Pushes `storyKey` to `session.verifiedStoryKeys[]`
- Stories loaded from Jira sync — filtered to those with both required labels

**Session completion:**
- `POST /api/certifications/:id/complete`
- Sets `status=Complete`, `completedAt=now`, calculates `durationSeconds`
- Increments `project.defectCount`
- Creates activity record

**Jira bulk create:**
- `POST /api/certifications/:id/create-jira-issues`
- Takes optional `selectedDefectIds[]` — if omitted, creates all queued defects
- In mock mode: generates fake Jira keys (e.g. `SF-5001`)
- In real mode: calls `POST /rest/api/3/issue` per defect
- Updates `defect.jiraIssueKey` and `defect.jiraIssueUrl` in session document
- Sets `session.jiraIssuesCreated = true`

**Active Sessions page** (`/projects/:id/sessions`):
- Polls `GET /api/certifications/active` every 30 seconds
- Shows all In Progress sessions with live duration counter
- 🔗 Link button copies the session share link (to resend to a tester who lost it)
- Force Complete button for Release Manager to close stuck sessions

**Roles and responsibilities (enforced by join form, not auth):**
- `bu` — Business Unit Rep: tests features from their BU's perspective
- `qa` — QA Team: regression testing across all BUs
- `rm` — Release Manager: coordinates, monitors, provides final sign-off
- `dev` — Dev Lead: verifies specific stories and bundle deployments

**API:** All routes in `api/src/routes/certification.routes.ts`

**Models:** `CertificationSession` with embedded `defects[]` array

**UI:** `CertSessionPage.tsx` (join + active + complete views), `ActiveSessionsPage.tsx`

---

## 5. Team View (Consolidated + Drill-Down)

**What it does:** Shows all teams' Jira story counts under the same fix version. Default is consolidated (total across all 8 teams). Each team card expands to show individual stories with label status.

**Consolidation rule:** All teams share the same fix version name (e.g. `Salesforce 26.14`). The `JiraFixVersion` collection has one document per team per version, which are aggregated on the backend into a consolidated summary.

**Missing label highlighting:** Stories missing `CopadoCICD` or the release label are highlighted in red with a "⚠ Label" badge. Clicking "Fix All" calls the add-label endpoint.

**Blockers:** Stories with `isBlocker=true` (flagged by having a `blocker` label in Jira) show a 🚧 badge.

**API:** `GET /api/jira/fix-versions/:projectId` returns consolidated + perTeam + hotfixes

---

## 6. Admin Panel

**What it does:** Two-tier admin system — Main Admin (platform-wide) and Project Admin (per-project).

**Main Admin capabilities:**
- Create/delete projects
- View and manage all projects
- Approve/deny admin access requests
- View all users and change roles
- View and clear the error log

**Project Admin capabilities:**
- Configure project name, Jira key, release label, cadence, team count
- Configure Copado integration (URL, token, pipeline, envs, Apex threshold)
- Manage project admin emails
- Toggle project LIVE status

**Access request flow:**
1. User submits `POST /api/admin/requests` with projectId + reason
2. Main Admin sees pending badge in sidebar
3. Main Admin approves → user's `role` updated to `project-admin`, `projectAdminOf` updated
4. Main Admin denies → status set to `denied`, user notified on next visit

**Secret field masking:** API tokens are stored in MongoDB but masked as `••••••••` when returned to the client. The frontend only sends the real token if the user types a new value (not the masked placeholder).

**Error Log:** All API failures (Jira sync failures, Copado errors, unhandled exceptions) are logged to the `ErrorLog` collection. The UI shows them with resolve button. Retry policy: 3 attempts with 1s/2s/3s backoff.

**API:** All routes in `api/src/routes/admin.routes.ts`

**UI:** `AdminPage.tsx`

---

## 7. Authentication

**Mock mode (`AUTH_MODE=mock`):**
- `POST /api/auth/mock-login` with `{ email }` — any ADP email works
- Server finds or creates user in MongoDB, assigns role from seed data
- Returns JWT valid for 8h

**Azure mode (`AUTH_MODE=azure`):**
- Frontend uses MSAL.js to get Azure AD ID token
- `POST /api/auth/azure/callback` with `{ idToken }` — server validates and extracts email/name/OID
- Server finds or creates user in MongoDB (OID as primary key, email as fallback)
- Returns JWT valid for 8h
- **For production**: add proper JWKS validation (see `CONNECTING_REAL_APIS.md`)

**JWT payload:** `{ id, email, name, role, projectAdminOf }`

**Route protection:** `authenticate` middleware on all routes except `/auth/mock-login`, `/auth/azure/callback`, and `/certifications/:id/resume` (cert resume is intentionally unauthenticated)

---

## 8. Activity Feed

**What it does:** Logs platform events (cert started, defect logged, bundle deployed, Jira synced, admin changes) and shows them on the home page.

**Events are created by:**
- Jira sync completion
- Session join/complete
- Defect logged
- Jira issues created
- Project admin changes
- Bundle sync

**API:** `GET /api/activity?projectId=X&limit=20`

**Model:** `Activity` in `api/src/models/index.ts`

---

## Edge Cases Covered

| Scenario | Handling |
|----------|----------|
| Certifier closes browser mid-session | Session persists in MongoDB; rejoin via same link resumes it |
| Certifier lost their share link | Release Manager uses Active Sessions page → 🔗 Link button |
| Two people submit join with same email | Second join returns existing session (`resumed: true`) |
| Jira sync fails | 3 retries, then `syncStatus=error`, error logged, stale data still served |
| Copado API down | Same retry pattern, cached bundle data served |
| Token expires during session | Axios interceptor catches 401, redirects to login with `reason=session_expired` |
| Admin requests for same project duplicated | API returns 409 if pending request already exists |
| Project deleted while session active | Session still accessible via direct UUID link; project lookup returns null gracefully |
| MongoDB connection lost | Auto-reconnect with retry, graceful server shutdown on fatal failure |
| Jira bulk create partially fails | Per-defect error handling; successfully created keys still stored |
| Large story count (>200) | Jira API called with `maxResults=500`; MongoDB bulkWrite handles upserts efficiently |
