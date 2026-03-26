import mongoose from 'mongoose';
import config from '../config';
import logger from './logger';

const RETRY_DELAY_MS = 5000;
const MAX_RETRIES = 5;

export async function connectDB(retries = MAX_RETRIES): Promise<void> {
  try {
    await mongoose.connect(config.mongodb.uri, {
      dbName: config.mongodb.dbName,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    });
    logger.info(`[MongoDB] Connected: ${config.mongodb.uri} / ${config.mongodb.dbName}`);
  } catch (err) {
    if (retries > 0) {
      logger.warn(`[MongoDB] Connection failed. Retrying in ${RETRY_DELAY_MS / 1000}s... (${retries} retries left)`, { error: (err as Error).message });
      await new Promise(res => setTimeout(res, RETRY_DELAY_MS));
      return connectDB(retries - 1);
    }
    logger.error('[MongoDB] FATAL: Could not connect after all retries', { error: err });
    process.exit(1);
  }
}

mongoose.connection.on('error', (err) => {
  logger.error('[MongoDB] Connection error', { error: err });
});

mongoose.connection.on('disconnected', () => {
  logger.warn('[MongoDB] Disconnected — attempting reconnect...');
});

mongoose.connection.on('reconnected', () => {
  logger.info('[MongoDB] Reconnected');
});

export async function disconnectDB(): Promise<void> {
  await mongoose.connection.close();
  logger.info('[MongoDB] Connection closed');
}
