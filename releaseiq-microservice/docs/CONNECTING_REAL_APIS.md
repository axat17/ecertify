# Connecting Real APIs
How to swap from mock mode to live Jira, Copado, and Azure AD connections.

---

## 1. Jira Cloud

### Step 1 — Generate API Token
1. Log in to `https://your-org.atlassian.net`
2. Go to **Account Settings → Security → API Tokens**
3. Click **Create API token** → name it `releaseiq-service`
4. Copy the token (you won't see it again)

### Step 2 — Configure the environment file
Edit `api/src/config/env/.env.fit` (or `.env.iat`, `.env.production`):

```env
JIRA_BASE_URL=https://your-org.atlassian.net
JIRA_API_TOKEN=your-api-token-here
JIRA_USER_EMAIL=releaseiq-svc@adp.com
JIRA_MOCK=false
```

### Step 3 — Configure per-project Jira Key
In the Admin panel → Project Settings, set:
- **Jira Project Key**: e.g. `SF` for E-Certify, `COM` for Commerce Cloud
- **Release Label**: e.g. `Salesforce_26.14` — must match the Jira fix version name exactly

### What the sync does (real Jira calls)
When `JIRA_MOCK=false`, the sync endpoint calls:

```
GET {JIRA_BASE_URL}/rest/api/3/search
  ?jql=project="{key}" AND fixVersion="{releaseLabel}"
  &fields=summary,status,assignee,labels,issuetype,subtasks,comment,attachment,priority,customfield_team,fixVersions
  &maxResults=500
```

Authorization header: `Basic base64({email}:{token})`

**Custom field mapping**: The team name is read from `customfield_team`. If your Jira uses a different custom field ID for team, update line ~50 in `jira.routes.ts`:
```typescript
const team = fields.customfield_team || fields.customfield_XXXXX || 'TEAM-A';
```

### Jira issue creation (bulk create)
When `JIRA_MOCK=false`, `POST /certifications/:id/create-jira-issues` calls:
```
POST {JIRA_BASE_URL}/rest/api/3/issue
Content-Type: application/json
Authorization: Basic ...

{
  "fields": {
    "project": { "key": "SF" },
    "issuetype": { "name": "Bug" },
    "summary": "{defect.title}",
    "description": { "type": "doc", "version": 1, "content": [...] },
    "priority": { "name": "{defect.jiraPriority}" },
    "labels": ["CopadoCICD", "Salesforce_26.14", "{businessUnit}"]
  }
}
```

---

## 2. Copado

### Prerequisites
- Copado must be installed in your Salesforce org
- Create a Connected App in Salesforce for ReleaseIQ

### Step 1 — Create Salesforce Connected App
1. Go to Salesforce Setup → App Manager → New Connected App
2. Name: `ReleaseIQ`
3. Enable OAuth Settings:
   - Callback URL: `https://releaseiq.adp.com/copado/callback`
   - Selected OAuth Scopes: `api`, `refresh_token`
4. Save → copy **Consumer Key** (client ID) and **Consumer Secret**

### Step 2 — Configure environment
```env
COPADO_BASE_URL=https://your-org.my.salesforce.com
COPADO_CLIENT_ID=your-consumer-key
COPADO_CLIENT_SECRET=your-consumer-secret
COPADO_MOCK=false
```

### Step 3 — Configure per-project Copado settings
In Admin → Project Settings → Copado Config:
- **Copado API Base URL**: `https://your-org.my.salesforce.com`
- **Pipeline Name**: exact name from Copado → Pipelines
- **API Token**: Connected App consumer secret
- **Tracked Environments**: select DEV, SIT, UAT, STG, PROD
- **Bundle Naming Convention**: `Bundle_{n}_{release}` (use `{n}` for number)
- **Apex Coverage Threshold**: 75 (Salesforce minimum)

### Real Copado API calls (replace mock in `copado.routes.ts`)
```typescript
// Get promotion status
GET {COPADO_BASE_URL}/services/apexrest/copado/v1/pipelines/{pipelineId}/stages

// Get Apex test results
GET {COPADO_BASE_URL}/services/apexrest/copado/v1/deployments/{deploymentId}/testResults

// Get validation results
GET {COPADO_BASE_URL}/services/apexrest/copado/v1/deployments/{deploymentId}/validations
```

---

## 3. Azure AD (MSAL)

### Step 1 — Register App in Azure Portal
1. Go to `portal.azure.com` → Azure Active Directory → App Registrations
2. New Registration:
   - Name: `ReleaseIQ`
   - Supported account types: `Accounts in this organizational directory only (ADP)`
   - Redirect URI: `http://localhost:3000/auth/callback` (add prod URIs later)
3. Copy **Application (client) ID** and **Directory (tenant) ID**
4. Certificates & Secrets → New client secret → copy value

### Step 2 — Configure API permissions
Add the following Microsoft Graph permissions:
- `User.Read` (delegated) — read signed-in user profile
- `profile` (delegated)
- `email` (delegated)
- `openid` (delegated)

Grant admin consent for the organization.

### Step 3 — Configure environments
**API** (`api/src/config/env/.env.fit`):
```env
AUTH_MODE=azure
AZURE_CLIENT_ID=your-application-client-id
AZURE_TENANT_ID=your-directory-tenant-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_REDIRECT_URI=https://releaseiq-fit.adp.com/auth/callback
```

**UI** (`ui/.env.fit`):
```env
VITE_AUTH_MODE=azure
VITE_AZURE_CLIENT_ID=your-application-client-id
VITE_AZURE_TENANT_ID=your-directory-tenant-id
```

### Step 4 — Complete the MSAL implementation in LoginPage.tsx
The Azure SSO button in `LoginPage.tsx` needs to initialize MSAL and trigger a login popup/redirect. Replace the placeholder button handler:

```typescript
import { PublicClientApplication, Configuration } from '@azure/msal-browser';

const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
    redirectUri: window.location.origin + '/auth/callback',
  },
};

const msalInstance = new PublicClientApplication(msalConfig);

async function handleAzureLogin() {
  try {
    const result = await msalInstance.loginPopup({
      scopes: ['openid', 'profile', 'email', 'User.Read'],
    });
    // Send idToken to API
    const { token, user } = await authApi.azureCallback(result.idToken);
    setAuth(token, user);
    navigate('/');
  } catch (err) {
    setError('Azure login failed: ' + (err as Error).message);
  }
}
```

### Step 5 — Complete Azure token validation in auth.ts
In `api/src/middleware/auth.ts`, the `azureCallback` function currently decodes without verification. For production, add proper JWT validation:

```typescript
import jwksClient from 'jwks-rsa';
import jwt from 'jsonwebtoken';

const client = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${config.azure.tenantId}/discovery/v2.0/keys`,
});

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  client.getSigningKey(header.kid!, (err, key) => {
    callback(err, key?.getPublicKey());
  });
}

// In azureCallback:
const decoded = await new Promise((resolve, reject) => {
  jwt.verify(idToken, getKey, {
    audience: config.azure.clientId,
    issuer: `https://login.microsoftonline.com/${config.azure.tenantId}/v2.0`,
  }, (err, payload) => {
    if (err) reject(err);
    else resolve(payload);
  });
});
```

Install: `npm install jwks-rsa @types/jwks-rsa`

---

## Switching Environments

```bash
# Start API in DIT mode
NODE_ENV=dit npm run start

# Start API in FIT mode
NODE_ENV=fit npm run start

# Start API in IAT mode
NODE_ENV=iat npm run start

# Start API in production
NODE_ENV=production npm run start
```

The config loader (`src/config/index.ts`) automatically reads the matching `.env.{NODE_ENV}` file.
