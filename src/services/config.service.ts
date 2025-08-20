import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import yaml from 'yaml';
import { z } from 'zod';
import { AppConfig, AppConfigSchema } from '../models/config.js';
import { SystemError } from '../utils/errors.js';
import { getLogger } from '../utils/logger.js';

export class ConfigService {
  private static instance: ConfigService;
  private config!: AppConfig;
  private configPath: string;

  private constructor() {
    const homeDir = os.homedir();
    this.configPath = path.join(homeDir, '.config', 'gitid', 'config.yaml');
  }

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  async initialize(): Promise<void> {
    try {
      await this.ensureConfigDirectory();
      this.config = await this.loadConfig();
      await this.ensureDirectories();
    } catch (error) {
      throw new SystemError('Failed to initialize configuration', { error });
    }
  }

  private async ensureConfigDirectory(): Promise<void> {
    const configDir = path.dirname(this.configPath);
    await fs.mkdir(configDir, { recursive: true, mode: 0o700 });
  }

  private async ensureDirectories(): Promise<void> {
    const dirs = [
      this.config.configDir,
      this.config.sshDir,
      this.config.keysDir,
      this.config.backupDir,
      this.config.logDir
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    }
  }

  private async loadConfig(): Promise<AppConfig> {
    try {
      const configExists = await this.configExists();
      
      if (!configExists) {
        const defaultConfig = this.getDefaultConfig();
        await this.saveConfig(defaultConfig);
        return defaultConfig;
      }

      const configContent = await fs.readFile(this.configPath, 'utf8');
      const rawConfig = yaml.parse(configContent);
      
      return AppConfigSchema.parse(rawConfig);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new SystemError('Invalid configuration format', { errors: error.errors });
      }
      throw new SystemError('Failed to load configuration', { error });
    }
  }

  private async configExists(): Promise<boolean> {
    try {
      await fs.access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  private getDefaultConfig(): AppConfig {
    const homeDir = os.homedir();
    const configDir = path.join(homeDir, '.config', 'gitid');
    
    return {
      configDir,
      sshDir: path.join(homeDir, '.ssh'),
      keysDir: path.join(homeDir, '.ssh', 'gitid'),
      backupDir: path.join(configDir, 'backups'),
      logDir: path.join(configDir, 'logs'),
      security: {
        requirePassphrase: false,
        autoRotateKeys: false,
        rotationIntervalDays: 90,
        maxKeyAgeDays: 365,
        enforceKeyExpiration: false
      },
      logging: {
        level: 'info',
        file: 'gitid.log',
        maxFiles: 10,
        maxSize: '10m',
        format: 'json',
        auditLog: true
      },
      backup: {
        enabled: true,
        encryption: true,
        autoBackup: true,
        retentionDays: 30
      },
      defaultKeyType: 'ed25519',
      defaultProvider: 'github.com',
      autoUpdate: true,
      telemetry: false
    };
  }

  async saveConfig(config: AppConfig): Promise<void> {
    try {
      const configYaml = yaml.stringify(config);
      await fs.writeFile(this.configPath, configYaml, { mode: 0o600 });
    } catch (error) {
      throw new SystemError('Failed to save configuration', { error });
    }
  }

  getConfig(): AppConfig {
    if (!this.config) {
      throw new SystemError('Configuration not initialized');
    }
    return this.config;
  }

  async updateConfig(updates: Partial<AppConfig>): Promise<void> {
    try {
      this.config = { ...this.config, ...updates };
      await this.saveConfig(this.config);
    } catch (error) {
      throw new SystemError('Failed to update configuration', { error });
    }
  }

  get sshDir(): string {
    return this.config.sshDir;
  }

  get keysDir(): string {
    return this.config.keysDir;
  }

  get configDir(): string {
    return this.config.configDir;
  }

  get backupDir(): string {
    return this.config.backupDir;
  }

  get logDir(): string {
    return this.config.logDir;
  }

  get security(): AppConfig['security'] {
    return this.config.security;
  }

  get logging(): AppConfig['logging'] {
    return this.config.logging;
  }

  get backup(): AppConfig['backup'] {
    return this.config.backup;
  }
}