// Re-export all shared types from the API service layer.
// Feature components should import types from here, not directly from services/api.
// This keeps the import path consistent and makes future refactoring easier.

export type {
  User,
  Project,
  CopadoConfig,
  JiraStory,
  FixVersionData,
  CopadoBundle,
  Defect,
  CertSession,
  JoinSessionPayload,
  DefectPayload,
  AdminRequest,
  ErrorLogEntry,
  ActivityItem,
  ApiResponse,
} from '@/services/api';
