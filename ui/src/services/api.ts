// ─── src/services/api.ts ─────────────────────────────────────────────────────
// Central Axios instance with auth headers, error handling, and retry logic

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/authStore';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const RETRY_COUNT = 2;

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor: attach JWT ─────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Response interceptor: handle 401 and retries ─────────────
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retryCount?: number };

    // Handle token expiry
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login?reason=session_expired';
      return Promise.reject(error);
    }

    // Retry on 502/503/504 (API or Jira/Copado downstream failures)
    const retryable = [502, 503, 504].includes(error.response?.status || 0);
    if (retryable) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      if (originalRequest._retryCount <= RETRY_COUNT) {
        await new Promise(r => setTimeout(r, 1000 * originalRequest._retryCount!));
        return api(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);

// ─── Typed API helpers ────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: Record<string, unknown>;
  resumed?: boolean;
}

function extractData<T>(response: { data: ApiResponse<T> }): T {
  if (!response.data.success) throw new Error(response.data.error || 'API error');
  return response.data.data as T;
}

function extractResponse<T>(response: { data: ApiResponse<T> }): ApiResponse<T> {
  return response.data;
}

// ─── Auth ─────────────────────────────────────────────────────
export const authApi = {
  mockLogin: (email: string) =>
    api.post<ApiResponse<{ token: string; user: User }>>('/auth/mock-login', { email }).then(extractData),
  azureCallback: (idToken: string) =>
    api.post<ApiResponse<{ token: string; user: User }>>('/auth/azure/callback', { idToken }).then(extractData),
  me: () => api.get<ApiResponse<User>>('/auth/me').then(extractData),
  logout: () => api.post('/auth/logout'),
};

// ─── Projects ─────────────────────────────────────────────────
export const projectApi = {
  list: () => api.get<ApiResponse<Project[]>>('/projects').then(extractData),
  get: (id: string) => api.get<ApiResponse<Project>>(`/projects/${id}`).then(extractData),
  create: (data: Partial<Project>) =>
    api.post<ApiResponse<Project>>('/projects', data).then(extractResponse),
  update: (id: string, data: Partial<Project>) =>
    api.patch<ApiResponse<Project>>(`/projects/${id}`, data).then(extractResponse),
  delete: (id: string) => api.delete(`/projects/${id}`).then(extractResponse),
  toggleLive: (id: string) => api.post(`/projects/${id}/toggle-live`).then(extractResponse),
};

// ─── Certification Sessions ───────────────────────────────────
export const certApi = {
  getActive: (projectId?: string) =>
    api.get<ApiResponse<CertSession[]>>('/certifications/active', { params: { projectId } }).then(extractResponse),
  getByProject: (projectId: string, filters?: Record<string, string>) =>
    api.get<ApiResponse<CertSession[]>>(`/certifications/project/${projectId}`, { params: filters }).then(extractData),
  getBySession: (sessionId: string) =>
    api.get<ApiResponse<CertSession>>(`/certifications/${sessionId}`).then(extractData),
  resume: (sessionId: string) =>
    api.get<ApiResponse<{ session: CertSession; project: Pick<Project, 'name' | 'currentRelease' | 'icon'> }>>(`/certifications/${sessionId}/resume`).then(extractResponse),
  join: (data: JoinSessionPayload) =>
    api.post<ApiResponse<CertSession & { shareLink: string }>>('/certifications/join', data).then(extractResponse),
  logDefect: (sessionId: string, defect: DefectPayload) =>
    api.patch<ApiResponse<Defect>>(`/certifications/${sessionId}/defect`, defect).then(extractData),
  verifyStory: (sessionId: string, storyKey: string, verified: boolean) =>
    api.patch(`/certifications/${sessionId}/verify-story`, { storyKey, verified }),
  block: (sessionId: string, reason: string) =>
    api.patch(`/certifications/${sessionId}/block`, { reason }),
  complete: (sessionId: string) =>
    api.post<ApiResponse<CertSession>>(`/certifications/${sessionId}/complete`).then(extractResponse),
  createJiraIssues: (sessionId: string, selectedDefectIds?: string[]) =>
    api.post<ApiResponse<{ created: number; issues: Array<{ defectId: string; jiraKey: string; url: string }> }>>(
      `/certifications/${sessionId}/create-jira-issues`,
      { selectedDefectIds }
    ).then(extractResponse),
};

// ─── Jira ─────────────────────────────────────────────────────
export const jiraApi = {
  sync: (projectId: string) =>
    api.post<ApiResponse<{ storyCount: number; syncedAt: string }>>(`/jira/sync/${projectId}`).then(extractResponse),
  stories: (projectId: string, filters?: Record<string, string | boolean>) =>
    api.get<ApiResponse<JiraStory[]>>(`/jira/stories/${projectId}`, { params: filters }).then(extractResponse),
  fixVersions: (projectId: string) =>
    api.get<ApiResponse<FixVersionData>>(`/jira/fix-versions/${projectId}`).then(extractData),
  addLabel: (projectId: string, storyKey: string, label: string) =>
    api.patch(`/jira/story/${projectId}/${storyKey}/label`, { label }).then(extractResponse),
};

// ─── Copado ───────────────────────────────────────────────────
export const copadoApi = {
  bundles: (projectId: string) =>
    api.get<ApiResponse<CopadoBundle[]>>(`/copado/bundles/${projectId}`).then(extractData),
  sync: (projectId: string) =>
    api.post(`/copado/sync/${projectId}`).then(extractResponse),
  testConnection: (data: { url: string; apiToken: string; pipelineName: string }) =>
    api.post('/copado/test-connection', data).then(extractResponse),
};

// ─── Admin ────────────────────────────────────────────────────
export const adminApi = {
  getRequests: () => api.get<ApiResponse<AdminRequest[]>>('/admin/requests').then(extractResponse),
  submitRequest: (projectId: string, reason: string) =>
    api.post('/admin/requests', { projectId, reason }).then(extractResponse),
  approveRequest: (requestId: string) =>
    api.patch(`/admin/requests/${requestId}/approve`).then(extractResponse),
  denyRequest: (requestId: string) =>
    api.patch(`/admin/requests/${requestId}/deny`).then(extractResponse),
  getErrors: (projectId?: string) =>
    api.get<ApiResponse<ErrorLogEntry[]>>('/admin/errors', { params: { projectId } }).then(extractData),
  clearErrors: () => api.delete('/admin/errors').then(extractResponse),
  resolveError: (id: string) => api.patch(`/admin/errors/${id}/resolve`).then(extractResponse),
  getUsers: () => api.get<ApiResponse<User[]>>('/admin/users').then(extractData),
  updateUserRole: (email: string, role: string) =>
    api.patch(`/admin/users/${email}/role`, { role }).then(extractResponse),
};

// ─── Activity ─────────────────────────────────────────────────
export const activityApi = {
  list: (projectId?: string, limit = 20) =>
    api.get<ApiResponse<ActivityItem[]>>('/activity', { params: { projectId, limit } }).then(extractData),
};

// ─── Shared Types ─────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  name: string;
  initials: string;
  role: 'main-admin' | 'project-admin' | 'user';
  projectAdminOf: string[];
}

export interface Project {
  projectId: string;
  name: string;
  shortName: string;
  type: 'salesforce' | 'react' | 'other';
  icon: string;
  color: string;
  status: string;
  healthScore: number;
  currentSprint: string;
  currentRelease: string;
  releaseAnchorDate: string;
  cadence: string;
  description: string;
  tags: string[];
  jiraKey: string;
  releaseLabel: string;
  copadoCICD: string;
  copadoConfig?: CopadoConfig;
  isLive: boolean;
  teamCount: number;
  ownerEmail: string;
  adminEmails: string[];
  storyCount: number;
  doneCount: number;
  defectCount: number;
  lastJiraSync?: string;
  syncStatus: 'never' | 'syncing' | 'synced' | 'error' | 'stale';
  lastSyncError?: string;
}

export interface CopadoConfig {
  url: string;
  apiToken: string;
  pipelineName: string;
  trackedEnvs: string[];
  bundleNamingConvention: string;
  apexCoverageThreshold: number;
}

export interface JiraStory {
  _id: string;
  key: string;
  title: string;
  type: string;
  status: string;
  team: string;
  assignee: string;
  labels: string[];
  bundle?: string;
  jiraUrl: string;
  hasCopadoCICD: boolean;
  hasReleaseLabel: boolean;
  isBlocker: boolean;
  subtasks: Array<{ key: string; title: string; status: string; jiraUrl: string }>;
  commentCount: number;
  priority?: string;
  lastSyncedAt: string;
}

export interface FixVersionData {
  consolidated: { totalStories: number; done: number; inProgress: number; todo: number; teamCount: number };
  perTeam: Array<{ team: string; versionName: string; storyCount: number; doneCount: number; inProgressCount: number; todoCount: number }>;
  hotfixes: Array<{ name: string; storyCount: number }>;
  lastSyncedAt?: string;
}

export interface CopadoBundle {
  _id: string;
  name: string;
  bundleNumber: number;
  status: string;
  deployedAt?: string;
  storyCount: number;
  teams: string[];
  componentSummary: string;
  promotions: Array<{ env: string; status: string; promotedAt?: string; errorMessage?: string }>;
  apexResults: { totalTests: number; passed: number; failed: number; skipped: number; coveragePercent: number };
  validationResult: { status: string; checks: string[]; warnings?: string[] };
  backPromoHistory: Array<{ fromEnv: string; toEnv: string; performedAt: string; reason: string }>;
}

export interface Defect {
  id: string;
  title: string;
  description: string;
  severity: 'Critical' | 'Major' | 'Minor';
  jiraPriority: string;
  linkedStoryKey?: string;
  environment: string;
  functionalArea: string;
  screenshotUrl?: string;
  reporterName: string;
  reporterEmail: string;
  reporterRole: string;
  businessUnit?: string;
  queuedForJira: boolean;
  jiraIssueKey?: string;
  jiraIssueUrl?: string;
  loggedAt: string;
}

export interface CertSession {
  _id: string;
  sessionId: string;
  projectId: string;
  projectName?: string;
  releaseVersion: string;
  certifierName: string;
  certifierEmail: string;
  certifierRole: 'bu' | 'qa' | 'rm' | 'dev';
  businessUnit?: string;
  environment: string;
  status: 'Waiting' | 'In Progress' | 'Complete' | 'Blocked';
  startedAt: string;
  completedAt?: string;
  durationSeconds: number;
  defects: Defect[];
  defectCount: number;
  verifiedStoryKeys: string[];
  blockedReason?: string;
  jiraIssuesCreated: boolean;
  jiraIssueKeys: string[];
}

export interface JoinSessionPayload {
  projectId: string;
  releaseVersion: string;
  certifierName: string;
  certifierEmail: string;
  certifierRole: 'bu' | 'qa' | 'rm' | 'dev';
  businessUnit?: string;
  environment: string;
}

export interface DefectPayload {
  title: string;
  description?: string;
  severity: 'Critical' | 'Major' | 'Minor';
  linkedStoryKey?: string;
  environment?: string;
  functionalArea?: string;
  screenshotUrl?: string;
  queuedForJira?: boolean;
}

export interface AdminRequest {
  requestId: string;
  projectId: string;
  projectName: string;
  requesterEmail: string;
  requesterName: string;
  reason: string;
  status: 'pending' | 'approved' | 'denied';
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface ErrorLogEntry {
  _id: string;
  context: string;
  message: string;
  projectId?: string;
  level: string;
  resolved: boolean;
  createdAt: string;
}

export interface ActivityItem {
  _id: string;
  projectId: string;
  type: string;
  message: string;
  icon: string;
  actorName?: string;
  createdAt: string;
}

export default api;
