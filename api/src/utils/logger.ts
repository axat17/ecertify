import winston from 'winston';
import path from 'path';
import config from '../config';

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const devFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  let log = `${ts} [${level}] ${message}`;
  if (Object.keys(meta).length > 0) log += ` ${JSON.stringify(meta)}`;
  if (stack) log += `\n${stack}`;
  return log;
});

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: 'HH:mm:ss' }),
      errors({ stack: true }),
      devFormat
    ),
  }),
];

if (config.logging.toFile) {
  transports.push(
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      format: combine(timestamp(), errors({ stack: true }), json()),
    }),
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      format: combine(timestamp(), errors({ stack: true }), json()),
    })
  );
}

const logger = winston.createLogger({
  level: config.logging.level,
  transports,
  exitOnError: false,
});

export default logger;
