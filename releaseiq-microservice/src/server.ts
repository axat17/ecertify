import 'express-async-errors';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import config from './config';
import { connectDB } from './utils/db';
import logger from './utils/logger';
import routes from './routes';
import { ErrorLog } from './models';

const app = express();

// ─── Security middleware ──────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false, // React app handles its own CSP
}));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || config.cors.origins.includes(origin) || config.env === 'local') {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Rate limiting ────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please wait and try again.' },
  skip: (req) => config.env === 'local', // no rate limit in local dev
});
app.use('/api', limiter);

// ─── Body parsing ─────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// ─── HTTP logging ─────────────────────────────────────────────
app.use(morgan(config.env === 'local' ? 'dev' : 'combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
  skip: (req) => req.url === '/api/health', // skip health check logs
}));

// ─── API Routes ───────────────────────────────────────────────
app.use('/api', routes);

// ─── 404 handler ─────────────────────────────────────────────
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.url}`,
    meta: { env: config.env, timestamp: new Date().toISOString() },
  });
});

// ─── Global error handler ─────────────────────────────────────
app.use(async (err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack, url: req.url, method: req.method });

  // Log to DB (best-effort, don't await to avoid infinite loops)
  ErrorLog.create({
    context: 'unhandled_error',
    message: err.message,
    stack: err.stack,
    level: 'error',
  }).catch(() => {});

  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode).json({
    success: false,
    error: config.env === 'production' ? 'An internal error occurred' : err.message,
    ...(config.env !== 'production' && { stack: err.stack }),
  });
});

// ─── Process error handlers ───────────────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { reason });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception — shutting down', { error: err });
  process.exit(1);
});

// ─── Graceful shutdown ────────────────────────────────────────
function gracefulShutdown(signal: string) {
  logger.info(`[Server] ${signal} received — shutting down gracefully`);
  server.close(() => {
    logger.info('[Server] HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('[Server] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

// ─── Start server ─────────────────────────────────────────────
let server: ReturnType<typeof app.listen>;

async function start() {
  try {
    await connectDB();
    server = app.listen(config.port, () => {
      logger.info(`[Server] ReleaseIQ API running on port ${config.port} [${config.env}]`);
      logger.info(`[Server] Auth mode: ${config.authMode}`);
      logger.info(`[Server] Jira mock: ${config.jira.mock} | Copado mock: ${config.copado.mock}`);
      if (config.authMode === 'mock') {
        logger.info('[Server] Mock login available at POST /api/auth/mock-login');
      }
    });
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (err) {
    logger.error('[Server] Failed to start', { error: err });
    process.exit(1);
  }
}

start();

export default app;
