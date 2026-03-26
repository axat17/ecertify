import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Determine which env file to load based on NODE_ENV
const nodeEnv = process.env.NODE_ENV || 'local';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(__dirname, 'env', envFile);

// Load env file - fall back to .env.local if specific file not found
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`[Config] Loaded environment: ${envFile}`);
} else {
  const fallback = path.resolve(__dirname, 'env', '.env.local');
  if (fs.existsSync(fallback)) {
    dotenv.config({ path: fallback });
    console.warn(`[Config] WARNING: ${envFile} not found, fell back to .env.local`);
  } else {
    dotenv.config(); // last resort: root .env
    console.warn('[Config] WARNING: No env file found, using process.env defaults');
  }
}

// Validate required config keys
const REQUIRED_KEYS = [
  'MONGODB_URI',
  'JWT_SECRET',
];

const missing = REQUIRED_KEYS.filter(key => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`[Config] FATAL: Missing required environment variables: ${missing.join(', ')}`);
}

export interface AppConfig {
  env: string;
  port: number;
  mongodb: {
    uri: string;
    dbName: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  azure: {
    clientId: string;
    tenantId: string;
    clientSecret: string;
    redirectUri: string;
  };
  authMode: 'azure' | 'mock';
  jira: {
    baseUrl: string;
    apiToken: string;
    userEmail: string;
    mock: boolean;
  };
  copado: {
    baseUrl: string;
    clientId: string;
    clientSecret: string;
    mock: boolean;
  };
  cors: {
    origins: string[];
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  logging: {
    level: string;
    toFile: boolean;
  };
  session: {
    pollIntervalMs: number;
    staleThresholdMinutes: number;
  };
}

const config: AppConfig = {
  env: nodeEnv,
  port: parseInt(process.env.PORT || '4000', 10),
  mongodb: {
    uri: process.env.MONGODB_URI!,
    dbName: process.env.MONGODB_DB_NAME || `releaseiq_${nodeEnv}`,
  },
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  azure: {
    clientId: process.env.AZURE_CLIENT_ID || '',
    tenantId: process.env.AZURE_TENANT_ID || '',
    clientSecret: process.env.AZURE_CLIENT_SECRET || '',
    redirectUri: process.env.AZURE_REDIRECT_URI || 'http://localhost:3000/auth/callback',
  },
  authMode: (process.env.AUTH_MODE as 'azure' | 'mock') || 'mock',
  jira: {
    baseUrl: process.env.JIRA_BASE_URL || 'https://your-org.atlassian.net',
    apiToken: process.env.JIRA_API_TOKEN || '',
    userEmail: process.env.JIRA_USER_EMAIL || '',
    mock: process.env.JIRA_MOCK !== 'false',
  },
  copado: {
    baseUrl: process.env.COPADO_BASE_URL || 'https://copado.my.salesforce.com',
    clientId: process.env.COPADO_CLIENT_ID || '',
    clientSecret: process.env.COPADO_CLIENT_SECRET || '',
    mock: process.env.COPADO_MOCK !== 'false',
  },
  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map(s => s.trim()),
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '200', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    toFile: process.env.LOG_TO_FILE === 'true',
  },
  session: {
    pollIntervalMs: parseInt(process.env.SESSION_POLL_INTERVAL || '30000', 10),
    staleThresholdMinutes: parseInt(process.env.SYNC_STALE_THRESHOLD_MINUTES || '30', 10),
  },
};

export default config;
