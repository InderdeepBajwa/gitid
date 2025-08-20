import { z } from 'zod';

export const SecurityConfigSchema = z.object({
  requirePassphrase: z.boolean().default(false),
  autoRotateKeys: z.boolean().default(false),
  rotationIntervalDays: z.number().int().positive().default(90),
  maxKeyAgeDays: z.number().int().positive().default(365),
  enforceKeyExpiration: z.boolean().default(false),
  allowedHosts: z.array(z.string()).optional(),
  blockedHosts: z.array(z.string()).optional()
});

export const LoggingConfigSchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'debug', 'verbose']).default('info'),
  file: z.string().optional(),
  maxFiles: z.number().int().positive().default(10),
  maxSize: z.string().default('10m'),
  format: z.enum(['json', 'text']).default('json'),
  auditLog: z.boolean().default(true)
});

export const BackupConfigSchema = z.object({
  enabled: z.boolean().default(true),
  location: z.string().optional(),
  encryption: z.boolean().default(true),
  autoBackup: z.boolean().default(true),
  retentionDays: z.number().int().positive().default(30)
});

export const AppConfigSchema = z.object({
  configDir: z.string(),
  sshDir: z.string(),
  keysDir: z.string(),
  backupDir: z.string(),
  logDir: z.string(),
  security: SecurityConfigSchema,
  logging: LoggingConfigSchema,
  backup: BackupConfigSchema,
  defaultKeyType: z.enum(['ed25519', 'rsa', 'ecdsa']).default('ed25519'),
  defaultProvider: z.string().default('github.com'),
  autoUpdate: z.boolean().default(true),
  telemetry: z.boolean().default(false)
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type BackupConfig = z.infer<typeof BackupConfigSchema>;