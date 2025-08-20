import winston from 'winston';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LoggingConfig } from '../models/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class Logger {
  private static instance: Logger;
  private logger: winston.Logger;
  private auditLogger?: winston.Logger;

  private constructor(config: LoggingConfig, logDir: string) {
    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ];

    if (config.file) {
      transports.push(
        new winston.transports.File({
          filename: path.join(logDir, config.file),
          maxsize: parseInt(config.maxSize) * 1024 * 1024,
          maxFiles: config.maxFiles,
          format: config.format === 'json' 
            ? winston.format.json()
            : winston.format.simple()
        })
      );
    }

    this.logger = winston.createLogger({
      level: config.level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.metadata()
      ),
      transports,
      exitOnError: false
    });

    if (config.auditLog) {
      this.auditLogger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
        transports: [
          new winston.transports.File({
            filename: path.join(logDir, 'audit.log'),
            maxsize: 50 * 1024 * 1024,
            maxFiles: 20
          })
        ]
      });
    }
  }

  static initialize(config: LoggingConfig, logDir: string): void {
    if (!Logger.instance) {
      Logger.instance = new Logger(config, logDir);
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      throw new Error('Logger not initialized. Call Logger.initialize() first.');
    }
    return Logger.instance;
  }

  error(message: string, error?: Error | unknown): void {
    this.logger.error(message, { error });
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, meta);
  }

  verbose(message: string, meta?: Record<string, unknown>): void {
    this.logger.verbose(message, meta);
  }

  audit(action: string, details: Record<string, unknown>): void {
    if (this.auditLogger) {
      this.auditLogger.info(action, {
        timestamp: new Date().toISOString(),
        ...details
      });
    }
  }
}

export const getLogger = (): Logger => Logger.getInstance();