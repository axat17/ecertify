// ============================================================
// ReleaseIQ - Shared TypeScript Types
// ============================================================

import { Document, Types } from 'mongoose';

// ─── Enums ──────────────────────────────────────────────────

export type ProjectType = 'salesforce' | 'react' | 'other';
export type ProjectStatus = 'Planning' | 'In Progress' | 'Complete' | 'On Hold';
export type ReleaseCadence = 'biweekly' | 'monthly' | 'weekly' | 'ondemand';
export type UserRole = 'main-admin' | 'project-admin' | 'user';
export type CertRole = 'bu' | 'qa' | 'rm' | 'dev';
export type CertStatus = 'Waiting' | 'In Progress' | 'Complete' | 'Blocked';
export type DefectSeverity = 'Critical' | 'Major' | 'Minor';
export type JiraPriority = 'Highest' | 'High' | 'Medium' | 'Low';
export type StoryStatus = 'To Do' | 'In Progress' | 'Done' | 'Accepted' | 'Completed' | 'Draft' | 'Blocked';
export type StoryType = 'Story' | 'Bug' | 'Task' | 'Epic' | 'Sub-task';
export type SyncStatus = 'never' | 'syncing' | 'synced' | 'error' | 'stale';
export type BundleStatus = 'Pending' | 'In Progress' | 'Deployed' | 'Failed' | 'Rolled Back';
export type EnvStatus = 'Pending' | 'In Progress' | 'Passed' | 'Failed' | 'Skipped';
export type AdminRequestStatus = 'pending' | 'approved' | 'denied';

// ─── User ────────────────────────────────────────────────────

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  name: string;
  initials: string;
  azureOid?: string; // Azure AD Object ID
  role: UserRole;
  projectAdminOf: string[]; // Project IDs
  lastLogin?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Project ─────────────────────────────────────────────────

export interface CopadoConfig {
  url: string;
  apiToken: string; // stored masked, decrypted at runtime
  pipelineName: string;
  trackedEnvs: string[];
  bundleNamingConvention: string;
  apexCoverageThreshold: number;
}

export interface IProject extends Document {
  _id: Types.ObjectId;
  projectId: string; // human-readable slug e.g. 'ecertify', 'sf1'
  name: string;
  shortName: string;
  type: ProjectType;
  icon: string;
  color: string;
  status: ProjectStatus;
  healthScore: number; // 0-100
  currentSprint: string;
  currentRelease: string;
  releaseAnchorDate: Date;
  cadence: ReleaseCadence;
  description: string;
  tags: string[];
  jiraKey: string; // e.g. "SF", "COM"
  jiraBaseUrl: string;
  jiraApiToken: string; // masked
  releaseLabel: string; // e.g. "Salesforce_26.14"
  copadoCICD: string; // e.g. "CopadoCICD"
  copadoConfig?: CopadoConfig; // only for salesforce type
  isLive: boolean;
  teamCount: number;
  ownerEmail: string;
  adminEmails: string[];
  storyCount: number;
  doneCount: number;
  defectCount: number;
  lastJiraSync?: Date;
  syncStatus: SyncStatus;
  lastSyncError?: string;
  retrySyncCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Jira Story ──────────────────────────────────────────────

export interface ISubTask {
  key: string;
  title: string;
  status: StoryStatus;
  assignee?: string;
  jiraUrl: string;
}

export interface IJiraStory extends Document {
  _id: Types.ObjectId;
  projectId: string;
  releaseVersion: string; // fix version name e.g. "Salesforce 26.14"
  key: string; // e.g. "SF-1001"
  title: string;
  type: StoryType;
  status: StoryStatus;
  team: string; // e.g. "TEAM-A"
  assignee: string;
  labels: string[]; // ["CopadoCICD", "Salesforce_26.14"]
  bundle?: string; // e.g. "Bundle 1"
  jiraUrl: string;
  subtasks: ISubTask[];
  commentCount: number;
  attachmentCount: number;
  hasCopadoCICD: boolean;
  hasReleaseLabel: boolean;
  isBlocker: boolean;
  priority?: JiraPriority;
  storyPoints?: number;
  epicLink?: string;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Jira Fix Version (per team) ─────────────────────────────

export interface IJiraFixVersion extends Document {
  _id: Types.ObjectId;
  projectId: string;
  team: string;
  versionName: string; // "Salesforce 26.14"
  releaseDate?: Date;
  storyCount: number;
  doneCount: number;
  inProgressCount: number;
  todoCount: number;
  hotfix: boolean;
  stagingRelease: boolean;
  lastSyncedAt: Date;
}

// ─── Copado Bundle ───────────────────────────────────────────

export interface IEnvPromotion {
  env: string;
  status: EnvStatus;
  promotedAt?: Date;
  errorMessage?: string;
}

export interface IApexResults {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  coveragePercent: number;
  runAt?: Date;
}

export interface IValidationResult {
  status: string; // 'Passed' | 'Passed with Warnings' | 'Failed' | 'In Progress'
  checks: string[];
  runAt?: Date;
  warnings?: string[];
}

export interface IBackPromo {
  fromEnv: string;
  toEnv: string;
  performedAt: Date;
  reason: string;
  performedBy?: string;
}

export interface ICopadoBundle extends Document {
  _id: Types.ObjectId;
  projectId: string;
  releaseVersion: string;
  name: string;
  bundleNumber: number; // 1, 2, or 3
  status: BundleStatus;
  deployedAt?: Date;
  storyCount: number;
  teams: string[];
  componentSummary: string;
  promotions: IEnvPromotion[];
  apexResults: IApexResults;
  validationResult: IValidationResult;
  backPromoHistory: IBackPromo[];
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Certification Session ────────────────────────────────────

export interface IDefect {
  id: string;
  title: string;
  description: string;
  severity: DefectSeverity;
  jiraPriority: JiraPriority;
  linkedStoryKey?: string;
  environment: string;
  functionalArea: string;
  screenshotUrl?: string;
  reporterName: string;
  reporterEmail: string;
  reporterRole: CertRole;
  businessUnit?: string;
  queuedForJira: boolean;
  jiraIssueKey?: string; // populated after Jira creation
  jiraIssueUrl?: string;
  loggedAt: Date;
}

export interface ICertificationSession extends Document {
  _id: Types.ObjectId;
  sessionId: string; // UUID - used in share links
  projectId: string;
  releaseVersion: string;
  certifierName: string;
  certifierEmail: string;
  certifierRole: CertRole;
  businessUnit?: string; // for bu role
  environment: string; // UAT | PROD | STG
  status: CertStatus;
  startedAt: Date;
  completedAt?: Date;
  durationSeconds: number;
  defects: IDefect[];
  defectCount: number;
  verifiedStoryKeys: string[]; // stories checked off
  blockedReason?: string;
  jiraIssuesCreated: boolean;
  jiraIssueKeys: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Admin Access Request ─────────────────────────────────────

export interface IAdminRequest extends Document {
  _id: Types.ObjectId;
  requestId: string;
  projectId: string;
  projectName: string;
  requesterEmail: string;
  requesterName: string;
  reason: string;
  status: AdminRequestStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Error Log ────────────────────────────────────────────────

export interface IErrorLog extends Document {
  _id: Types.ObjectId;
  context: string; // e.g. 'jira_sync', 'copado_sync', 'cert_session'
  message: string;
  stack?: string;
  projectId?: string;
  userId?: string;
  level: 'error' | 'warn' | 'info';
  resolved: boolean;
  createdAt: Date;
}

// ─── Activity Feed ────────────────────────────────────────────

export interface IActivity extends Document {
  _id: Types.ObjectId;
  projectId: string;
  type: 'cert_started' | 'cert_complete' | 'defect_logged' | 'bundle_deployed' | 'jira_synced' | 'admin_change' | 'session_joined' | 'jira_created';
  message: string;
  icon: string;
  actorEmail?: string;
  actorName?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// ─── API Response Types ───────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    env?: string;
    timestamp?: string;
  };
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// ─── Request Augmentation ────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        role: UserRole;
        projectAdminOf: string[];
      };
    }
  }
}
