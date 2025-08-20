import fs from 'node:fs/promises';
import path from 'node:path';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGzip, createGunzip } from 'node:zlib';
import type { Identity } from '../models/identity.js';
import { ConfigService } from './config.service.js';
import { CryptoService } from '../utils/crypto.js';
import { SystemError } from '../utils/errors.js';
import { getLogger } from '../utils/logger.js';

interface BackupMetadata {
  version: string;
  timestamp: string;
  identityCount: number;
  encrypted: boolean;
  compressed: boolean;
}

export class BackupService {
  private static instance: BackupService;
  private readonly backupExtension = '.backup.gz';
  private readonly metadataFile = 'backup.meta.json';

  private constructor(private readonly config: ConfigService) {}

  static getInstance(config: ConfigService): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService(config);
    }
    return BackupService.instance;
  }

  async backupIdentities(identities: Identity[]): Promise<string> {
    const logger = getLogger();
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `identities-${timestamp}`;
      const backupPath = path.join(this.config.backupDir, backupName);

      const backupData = {
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        identities
      };

      let content = JSON.stringify(backupData, null, 2);

      if (this.config.backup.encryption) {
        const password = await this.getBackupPassword();
        content = await CryptoService.encryptData(content, password);
      }

      const finalPath = `${backupPath}${this.backupExtension}`;
      await this.compressAndSave(content, finalPath);

      const metadata: BackupMetadata = {
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        identityCount: identities.length,
        encrypted: this.config.backup.encryption,
        compressed: true
      };

      await this.saveMetadata(backupName, metadata);
      await this.cleanupOldBackups();

      logger.info('Backup created', {
        path: finalPath,
        identities: identities.length,
        encrypted: this.config.backup.encryption
      });

      return finalPath;
    } catch (error) {
      throw new SystemError('Backup failed', { error });
    }
  }

  async restoreIdentities(backupPath: string): Promise<Identity[]> {
    const logger = getLogger();
    
    try {
      let content = await this.decompressAndLoad(backupPath);

      if (this.config.backup.encryption) {
        const password = await this.getBackupPassword();
        content = await CryptoService.decryptData(content, password);
      }

      const backupData = JSON.parse(content);
      
      if (!Array.isArray(backupData.identities)) {
        throw new Error('Invalid backup format');
      }

      logger.info('Backup restored', {
        path: backupPath,
        identities: backupData.identities.length
      });

      return backupData.identities;
    } catch (error) {
      throw new SystemError('Restore failed', { error });
    }
  }

  async listBackups(): Promise<Array<{ name: string; metadata: BackupMetadata }>> {
    try {
      const files = await fs.readdir(this.config.backupDir);
      const backups: Array<{ name: string; metadata: BackupMetadata }> = [];

      for (const file of files) {
        if (file.endsWith(this.backupExtension)) {
          const name = file.replace(this.backupExtension, '');
          const metadata = await this.loadMetadata(name);
          if (metadata) {
            backups.push({ name, metadata });
          }
        }
      }

      return backups.sort((a, b) => 
        new Date(b.metadata.timestamp).getTime() - 
        new Date(a.metadata.timestamp).getTime()
      );
    } catch (error) {
      throw new SystemError('Failed to list backups', { error });
    }
  }

  async exportKeys(alias: string, outputDir: string): Promise<void> {
    const logger = getLogger();
    
    try {
      const keysDir = this.config.keysDir;
      const privateKeyPath = path.join(keysDir, alias);
      const publicKeyPath = `${privateKeyPath}.pub`;

      await fs.mkdir(outputDir, { recursive: true });

      await fs.copyFile(
        privateKeyPath,
        path.join(outputDir, `${alias}_private`)
      );
      await fs.copyFile(
        publicKeyPath,
        path.join(outputDir, `${alias}_public.pub`)
      );

      logger.info('Keys exported', { alias, outputDir });
    } catch (error) {
      throw new SystemError('Export failed', { error });
    }
  }

  async importKeys(
    alias: string,
    privateKeyPath: string,
    publicKeyPath: string
  ): Promise<void> {
    const logger = getLogger();
    
    try {
      const destPrivate = path.join(this.config.keysDir, alias);
      const destPublic = `${destPrivate}.pub`;

      await fs.copyFile(privateKeyPath, destPrivate);
      await fs.chmod(destPrivate, 0o600);
      
      await fs.copyFile(publicKeyPath, destPublic);
      await fs.chmod(destPublic, 0o644);

      logger.info('Keys imported', { alias });
    } catch (error) {
      throw new SystemError('Import failed', { error });
    }
  }

  private async compressAndSave(data: string, outputPath: string): Promise<void> {
    const tempPath = `${outputPath}.tmp`;
    await fs.writeFile(tempPath, data);

    await pipeline(
      createReadStream(tempPath),
      createGzip({ level: 9 }),
      createWriteStream(outputPath)
    );

    await fs.unlink(tempPath);
  }

  private async decompressAndLoad(inputPath: string): Promise<string> {
    const tempPath = `${inputPath}.tmp`;

    await pipeline(
      createReadStream(inputPath),
      createGunzip(),
      createWriteStream(tempPath)
    );

    const content = await fs.readFile(tempPath, 'utf8');
    await fs.unlink(tempPath);

    return content;
  }

  private async saveMetadata(name: string, metadata: BackupMetadata): Promise<void> {
    const metaPath = path.join(this.config.backupDir, `${name}.meta.json`);
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));
  }

  private async loadMetadata(name: string): Promise<BackupMetadata | null> {
    try {
      const metaPath = path.join(this.config.backupDir, `${name}.meta.json`);
      const content = await fs.readFile(metaPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    const logger = getLogger();
    const retentionDays = this.config.backup.retentionDays;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const backups = await this.listBackups();
    let deletedCount = 0;

    for (const backup of backups) {
      const backupDate = new Date(backup.metadata.timestamp);
      if (backupDate < cutoffDate) {
        const backupPath = path.join(
          this.config.backupDir,
          `${backup.name}${this.backupExtension}`
        );
        const metaPath = path.join(
          this.config.backupDir,
          `${backup.name}.meta.json`
        );

        try {
          await fs.unlink(backupPath);
          await fs.unlink(metaPath);
          deletedCount++;
        } catch (error) {
          logger.warn('Failed to delete old backup', { 
            backup: backup.name,
            error 
          });
        }
      }
    }

    if (deletedCount > 0) {
      logger.info('Old backups cleaned up', { count: deletedCount });
    }
  }

  private async getBackupPassword(): Promise<string> {
    const envPassword = process.env.GITID_BACKUP_PASSWORD;
    if (envPassword) {
      return envPassword;
    }

    const keyPath = path.join(this.config.configDir, '.backup.key');
    try {
      return await fs.readFile(keyPath, 'utf8');
    } catch {
      const password = CryptoService.generateSecureToken(32);
      await fs.writeFile(keyPath, password, { mode: 0o600 });
      return password;
    }
  }

  async createFullBackup(): Promise<string> {
    const logger = getLogger();
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.join(this.config.backupDir, `full-${timestamp}`);
      
      await fs.mkdir(backupDir, { recursive: true });

      await this.copyDirectory(this.config.keysDir, path.join(backupDir, 'keys'));
      
      const sshConfigPath = path.join(this.config.sshDir, 'config');
      await fs.copyFile(sshConfigPath, path.join(backupDir, 'ssh_config'));
      
      const identitiesPath = path.join(this.config.configDir, 'identities.json');
      await fs.copyFile(identitiesPath, path.join(backupDir, 'identities.json'));
      
      const configPath = path.join(this.config.configDir, 'config.yaml');
      await fs.copyFile(configPath, path.join(backupDir, 'config.yaml'));

      logger.info('Full backup created', { path: backupDir });
      
      return backupDir;
    } catch (error) {
      throw new SystemError('Full backup failed', { error });
    }
  }

  private async copyDirectory(source: string, destination: string): Promise<void> {
    await fs.mkdir(destination, { recursive: true });
    
    const entries = await fs.readdir(source, { withFileTypes: true });
    
    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(sourcePath, destPath);
      } else {
        await fs.copyFile(sourcePath, destPath);
      }
    }
  }
}