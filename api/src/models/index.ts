import mongoose, { Schema } from 'mongoose';
import {
  IUser, IProject, IJiraStory, IJiraFixVersion,
  ICopadoBundle, ICertificationSession, IAdminRequest,
  IErrorLog, IActivity
} from '../types';

// ─── User Model ──────────────────────────────────────────────

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  initials: { type: String, required: true, maxlength: 3 },
  azureOid: { type: String, sparse: true },
  role: { type: String, enum: ['main-admin', 'project-admin', 'user'], default: 'user' },
  projectAdminOf: [{ type: String }],
  lastLogin: { type: Date },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

UserSchema.index({ email: 1 });
UserSchema.index({ azureOid: 1 });

// ─── Project Model ───────────────────────────────────────────

const CopadoConfigSchema = new Schema({
  url: { type: String, default: '' },
  apiToken: { type: String, default: '' },
  pipelineName: { type: String, default: '' },
  trackedEnvs: [{ type: String }],
  bundleNamingConvention: { type: String, default: 'Bundle_{n}' },
  apexCoverageThreshold: { type: Number, default: 75 },
}, { _id: false });

const ProjectSchema = new Schema<IProject>({
  projectId: { type: String, required: true, unique: true, lowercase: true },
  name: { type: String, required: true, trim: true },
  shortName: { type: String, required: true },
  type: { type: String, enum: ['salesforce', 'react', 'other'], required: true },
  icon: { type: String, default: '📋' },
  color: { type: String, default: '#2060d8' },
  status: { type: String, enum: ['Planning', 'In Progress', 'Complete', 'On Hold'], default: 'Planning' },
  healthScore: { type: Number, default: 0, min: 0, max: 100 },
  currentSprint: { type: String, default: '1.0' },
  currentRelease: { type: String, default: '' },
  releaseAnchorDate: { type: Date, default: Date.now },
  cadence: { type: String, enum: ['biweekly', 'monthly', 'weekly', 'ondemand'], default: 'biweekly' },
  description: { type: String, default: '' },
  tags: [{ type: String }],
  jiraKey: { type: String, required: true, uppercase: true },
  jiraBaseUrl: { type: String, default: '' },
  jiraApiToken: { type: String, default: '' },
  releaseLabel: { type: String, default: '' },
  copadoCICD: { type: String, default: 'CopadoCICD' },
  copadoConfig: { type: CopadoConfigSchema },
  isLive: { type: Boolean, default: false },
  teamCount: { type: Number, default: 7 },
  ownerEmail: { type: String, required: true },
  adminEmails: [{ type: String }],
  storyCount: { type: Number, default: 0 },
  doneCount: { type: Number, default: 0 },
  defectCount: { type: Number, default: 0 },
  lastJiraSync: { type: Date },
  syncStatus: { type: String, enum: ['never', 'syncing', 'synced', 'error', 'stale'], default: 'never' },
  lastSyncError: { type: String },
  retrySyncCount: { type: Number, default: 0 },
}, { timestamps: true });

ProjectSchema.index({ projectId: 1 });
ProjectSchema.index({ isLive: 1 });

// ─── Jira Story Model ────────────────────────────────────────

const SubTaskSchema = new Schema({
  key: String,
  title: String,
  status: String,
  assignee: String,
  jiraUrl: String,
}, { _id: false });

const JiraStorySchema = new Schema<IJiraStory>({
  projectId: { type: String, required: true, index: true },
  releaseVersion: { type: String, required: true },
  key: { type: String, required: true },
  title: { type: String, required: true },
  type: { type: String, enum: ['Story', 'Bug', 'Task', 'Epic', 'Sub-task'], default: 'Story' },
  status: { type: String, default: 'To Do' },
  team: { type: String, required: true },
  assignee: { type: String, default: 'Unassigned' },
  labels: [{ type: String }],
  bundle: { type: String },
  jiraUrl: { type: String, required: true },
  subtasks: [SubTaskSchema],
  commentCount: { type: Number, default: 0 },
  attachmentCount: { type: Number, default: 0 },
  hasCopadoCICD: { type: Boolean, default: false },
  hasReleaseLabel: { type: Boolean, default: false },
  isBlocker: { type: Boolean, default: false },
  priority: { type: String },
  storyPoints: { type: Number },
  epicLink: { type: String },
  lastSyncedAt: { type: Date, default: Date.now },
}, { timestamps: true });

JiraStorySchema.index({ projectId: 1, releaseVersion: 1 });
JiraStorySchema.index({ projectId: 1, team: 1 });
JiraStorySchema.index({ key: 1, projectId: 1 }, { unique: true });

// ─── Fix Version Model ───────────────────────────────────────

const JiraFixVersionSchema = new Schema<IJiraFixVersion>({
  projectId: { type: String, required: true },
  team: { type: String, required: true },
  versionName: { type: String, required: true },
  releaseDate: { type: Date },
  storyCount: { type: Number, default: 0 },
  doneCount: { type: Number, default: 0 },
  inProgressCount: { type: Number, default: 0 },
  todoCount: { type: Number, default: 0 },
  hotfix: { type: Boolean, default: false },
  stagingRelease: { type: Boolean, default: false },
  lastSyncedAt: { type: Date, default: Date.now },
}, { timestamps: true });

JiraFixVersionSchema.index({ projectId: 1, team: 1, versionName: 1 }, { unique: true });

// ─── Copado Bundle Model ─────────────────────────────────────

const EnvPromotionSchema = new Schema({
  env: String,
  status: String,
  promotedAt: Date,
  errorMessage: String,
}, { _id: false });

const ApexResultsSchema = new Schema({
  totalTests: { type: Number, default: 0 },
  passed: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  skipped: { type: Number, default: 0 },
  coveragePercent: { type: Number, default: 0 },
  runAt: Date,
}, { _id: false });

const ValidationResultSchema = new Schema({
  status: { type: String, default: 'Pending' },
  checks: [String],
  runAt: Date,
  warnings: [String],
}, { _id: false });

const BackPromoSchema = new Schema({
  fromEnv: String,
  toEnv: String,
  performedAt: Date,
  reason: String,
  performedBy: String,
}, { _id: false });

const CopadoBundleSchema = new Schema<ICopadoBundle>({
  projectId: { type: String, required: true },
  releaseVersion: { type: String, required: true },
  name: { type: String, required: true },
  bundleNumber: { type: Number, required: true },
  status: { type: String, enum: ['Pending', 'In Progress', 'Deployed', 'Failed', 'Rolled Back'], default: 'Pending' },
  deployedAt: { type: Date },
  storyCount: { type: Number, default: 0 },
  teams: [{ type: String }],
  componentSummary: { type: String, default: '' },
  promotions: [EnvPromotionSchema],
  apexResults: { type: ApexResultsSchema, default: () => ({}) },
  validationResult: { type: ValidationResultSchema, default: () => ({}) },
  backPromoHistory: [BackPromoSchema],
  lastSyncedAt: { type: Date, default: Date.now },
}, { timestamps: true });

CopadoBundleSchema.index({ projectId: 1, releaseVersion: 1 });

// ─── Certification Session Model ─────────────────────────────

const DefectSchema = new Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  severity: { type: String, enum: ['Critical', 'Major', 'Minor'], required: true },
  jiraPriority: { type: String, enum: ['Highest', 'High', 'Medium', 'Low'], required: true },
  linkedStoryKey: { type: String },
  environment: { type: String, required: true },
  functionalArea: { type: String, default: 'General' },
  screenshotUrl: { type: String },
  reporterName: { type: String, required: true },
  reporterEmail: { type: String, required: true },
  reporterRole: { type: String, enum: ['bu', 'qa', 'rm', 'dev'], required: true },
  businessUnit: { type: String },
  queuedForJira: { type: Boolean, default: true },
  jiraIssueKey: { type: String },
  jiraIssueUrl: { type: String },
  loggedAt: { type: Date, default: Date.now },
}, { _id: false });

const CertificationSessionSchema = new Schema<ICertificationSession>({
  sessionId: { type: String, required: true, unique: true },
  projectId: { type: String, required: true },
  releaseVersion: { type: String, required: true },
  certifierName: { type: String, required: true },
  certifierEmail: { type: String, required: true },
  certifierRole: { type: String, enum: ['bu', 'qa', 'rm', 'dev'], required: true },
  businessUnit: { type: String },
  environment: { type: String, required: true },
  status: { type: String, enum: ['Waiting', 'In Progress', 'Complete', 'Blocked'], default: 'In Progress' },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  durationSeconds: { type: Number, default: 0 },
  defects: [DefectSchema],
  defectCount: { type: Number, default: 0 },
  verifiedStoryKeys: [{ type: String }],
  blockedReason: { type: String },
  jiraIssuesCreated: { type: Boolean, default: false },
  jiraIssueKeys: [{ type: String }],
}, { timestamps: true });

CertificationSessionSchema.index({ projectId: 1, status: 1 });
CertificationSessionSchema.index({ sessionId: 1 });
CertificationSessionSchema.index({ certifierEmail: 1, projectId: 1 });
CertificationSessionSchema.index({ releaseVersion: 1, projectId: 1 });

// ─── Admin Request Model ─────────────────────────────────────

const AdminRequestSchema = new Schema<IAdminRequest>({
  requestId: { type: String, required: true, unique: true },
  projectId: { type: String, required: true },
  projectName: { type: String, required: true },
  requesterEmail: { type: String, required: true },
  requesterName: { type: String, required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'denied'], default: 'pending' },
  reviewedBy: { type: String },
  reviewedAt: { type: Date },
}, { timestamps: true });

// ─── Error Log Model ─────────────────────────────────────────

const ErrorLogSchema = new Schema<IErrorLog>({
  context: { type: String, required: true },
  message: { type: String, required: true },
  stack: { type: String },
  projectId: { type: String },
  userId: { type: String },
  level: { type: String, enum: ['error', 'warn', 'info'], default: 'error' },
  resolved: { type: Boolean, default: false },
}, { timestamps: true });

ErrorLogSchema.index({ createdAt: -1 });
ErrorLogSchema.index({ projectId: 1, createdAt: -1 });

// ─── Activity Model ──────────────────────────────────────────

const ActivitySchema = new Schema<IActivity>({
  projectId: { type: String, required: true },
  type: { type: String, required: true },
  message: { type: String, required: true },
  icon: { type: String, default: '📋' },
  actorEmail: { type: String },
  actorName: { type: String },
  metadata: { type: Schema.Types.Mixed },
}, { timestamps: true });

ActivitySchema.index({ projectId: 1, createdAt: -1 });
ActivitySchema.index({ createdAt: -1 });

// ─── Exports ─────────────────────────────────────────────────

export const User = mongoose.model<IUser>('User', UserSchema);
export const Project = mongoose.model<IProject>('Project', ProjectSchema);
export const JiraStory = mongoose.model<IJiraStory>('JiraStory', JiraStorySchema);
export const JiraFixVersion = mongoose.model<IJiraFixVersion>('JiraFixVersion', JiraFixVersionSchema);
export const CopadoBundle = mongoose.model<ICopadoBundle>('CopadoBundle', CopadoBundleSchema);
export const CertificationSession = mongoose.model<ICertificationSession>('CertificationSession', CertificationSessionSchema);
export const AdminRequest = mongoose.model<IAdminRequest>('AdminRequest', AdminRequestSchema);
export const ErrorLog = mongoose.model<IErrorLog>('ErrorLog', ErrorLogSchema);
export const Activity = mongoose.model<IActivity>('Activity', ActivitySchema);
