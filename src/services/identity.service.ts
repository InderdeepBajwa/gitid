import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { 
  Identity, 
  CreateIdentityInput, 
  UpdateIdentityInput,
  IdentitySchema 
} from '../models/identity.js';
import { ConfigService } from './config.service.js';
import { SSHService } from './ssh.service.js';
import { BackupService } from './backup.service.js';
import {
  IdentityNotFoundError,
  IdentityExistsError,
  SystemError,
  ValidationError
} from '../utils/errors.js';
import { Validator } from '../utils/validation.js';
import { CryptoService } from '../utils/crypto.js';
import { getLogger } from '../utils/logger.js';

export class IdentityService {
  private static instance: IdentityService;
  private identities: Map<string, Identity> = new Map();
  private dbPath: string;
  
  private constructor(
    private readonly config: ConfigService,
    private readonly ssh: SSHService,
    private readonly backup: BackupService
  ) {
    this.dbPath = path.join(config.configDir, 'identities.json');
  }

  static getInstance(
    config: ConfigService,
    ssh: SSHService,
    backup: BackupService
  ): IdentityService {
    if (!IdentityService.instance) {
      IdentityService.instance = new IdentityService(config, ssh, backup);
    }
    return IdentityService.instance;
  }

  async initialize(): Promise<void> {
    await this.loadIdentities();
    await this.validateIdentities();
  }

  private async loadIdentities(): Promise<void> {
    try {
      const exists = await this.dbExists();
      if (!exists) {
        await this.saveIdentities();
        return;
      }

      const data = await fs.readFile(this.dbPath, 'utf8');
      const identities = JSON.parse(data) as Identity[];
      
      this.identities.clear();
      for (const identity of identities) {
        const validated = IdentitySchema.parse(identity);
        this.identities.set(validated.alias, validated);
      }
    } catch (error) {
      throw new SystemError('Failed to load identities', { error });
    }
  }

  private async dbExists(): Promise<boolean> {
    try {
      await fs.access(this.dbPath);
      return true;
    } catch {
      return false;
    }
  }

  private async saveIdentities(): Promise<void> {
    try {
      const identities = Array.from(this.identities.values());
      const data = JSON.stringify(identities, null, 2);
      await fs.writeFile(this.dbPath, data, { mode: 0o600 });
      
      if (this.config.backup.autoBackup) {
        await this.backup.backupIdentities(identities);
      }
    } catch (error) {
      throw new SystemError('Failed to save identities', { error });
    }
  }

  private async validateIdentities(): Promise<void> {
    const logger = getLogger();
    const invalidIdentities: string[] = [];

    for (const [alias, identity] of this.identities) {
      try {
        await this.validateIdentity(identity);
      } catch (error) {
        logger.warn(`Invalid identity: ${alias}`, { error });
        invalidIdentities.push(alias);
      }
    }

    if (invalidIdentities.length > 0) {
      logger.warn(`Found ${invalidIdentities.length} invalid identities`, { 
        identities: invalidIdentities 
      });
    }
  }

  private async validateIdentity(identity: Identity): Promise<void> {
    const keyPath = identity.keyPath;
    const publicKeyPath = `${keyPath}.pub`;

    try {
      await fs.access(keyPath);
      await fs.access(publicKeyPath);
    } catch {
      throw new ValidationError(`Key files not found for identity: ${identity.alias}`);
    }

    if (identity.metadata?.expiresAt) {
      const expiryDate = new Date(identity.metadata.expiresAt);
      if (expiryDate < new Date() && this.config.security.enforceKeyExpiration) {
        throw new ValidationError(`Identity expired: ${identity.alias}`);
      }
    }
  }

  async create(input: CreateIdentityInput): Promise<Identity> {
    const logger = getLogger();
    
    if (!Validator.isValidAlias(input.alias)) {
      throw new ValidationError('Invalid alias format');
    }

    if (this.identities.has(input.alias)) {
      throw new IdentityExistsError(input.alias);
    }

    try {
      const keyPath = path.join(this.config.keysDir, input.alias);
      
      await this.ssh.generateKey({
        path: keyPath,
        type: input.keyType,
        passphrase: input.passphrase,
        comment: `${input.alias}@gitid`
      });

      const publicKey = await fs.readFile(`${keyPath}.pub`, 'utf8');
      const fingerprint = CryptoService.generateFingerprint(publicKey);

      const identity: Identity = {
        id: randomUUID(),
        alias: input.alias,
        hostName: input.hostName,
        keyType: input.keyType,
        keyPath,
        publicKeyFingerprint: fingerprint,
        gitUserName: input.gitUserName,
        gitUserEmail: input.gitUserEmail,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: input.metadata,
        isActive: true,
        isEncrypted: !!input.passphrase
      };

      await this.ssh.addIdentityToConfig(identity);
      
      this.identities.set(identity.alias, identity);
      await this.saveIdentities();

      logger.info('Identity created', { 
        alias: identity.alias,
        host: identity.hostName,
        fingerprint 
      });

      logger.audit('IDENTITY_CREATED', {
        alias: identity.alias,
        hostName: identity.hostName,
        keyType: identity.keyType
      });

      return identity;
    } catch (error) {
      logger.error('Failed to create identity', error);
      throw new SystemError('Failed to create identity', { error });
    }
  }

  async update(alias: string, input: UpdateIdentityInput): Promise<Identity> {
    const logger = getLogger();
    const identity = this.get(alias);

    const updated: Identity = {
      ...identity,
      ...input,
      updatedAt: new Date().toISOString()
    };

    if (input.metadata) {
      updated.metadata = { ...identity.metadata, ...input.metadata };
    }

    this.identities.set(alias, updated);
    await this.saveIdentities();

    logger.info('Identity updated', { alias });
    logger.audit('IDENTITY_UPDATED', { alias, changes: input });

    return updated;
  }

  async remove(alias: string, deleteKeys: boolean = false): Promise<void> {
    const logger = getLogger();
    const identity = this.get(alias);

    try {
      await this.ssh.removeIdentityFromConfig(alias);

      if (deleteKeys) {
        try {
          await fs.unlink(identity.keyPath);
          await fs.unlink(`${identity.keyPath}.pub`);
        } catch (error) {
          logger.warn('Failed to delete key files', { alias, error });
        }
      }

      this.identities.delete(alias);
      await this.saveIdentities();

      logger.info('Identity removed', { alias, keysDeleted: deleteKeys });
      logger.audit('IDENTITY_REMOVED', { alias, keysDeleted: deleteKeys });
    } catch (error) {
      throw new SystemError('Failed to remove identity', { error });
    }
  }

  async rename(oldAlias: string, newAlias: string): Promise<Identity> {
    const logger = getLogger();
    
    if (!Validator.isValidAlias(newAlias)) {
      throw new ValidationError('Invalid new alias format');
    }

    if (this.identities.has(newAlias)) {
      throw new IdentityExistsError(newAlias);
    }

    const identity = this.get(oldAlias);

    try {
      const oldKeyPath = identity.keyPath;
      const newKeyPath = path.join(this.config.keysDir, newAlias);

      await fs.rename(oldKeyPath, newKeyPath);
      await fs.rename(`${oldKeyPath}.pub`, `${newKeyPath}.pub`);

      await this.ssh.removeIdentityFromConfig(oldAlias);

      const updatedIdentity: Identity = {
        ...identity,
        alias: newAlias,
        keyPath: newKeyPath,
        updatedAt: new Date().toISOString()
      };

      await this.ssh.addIdentityToConfig(updatedIdentity);

      this.identities.delete(oldAlias);
      this.identities.set(newAlias, updatedIdentity);
      await this.saveIdentities();

      logger.info('Identity renamed', { from: oldAlias, to: newAlias });
      logger.audit('IDENTITY_RENAMED', { from: oldAlias, to: newAlias });

      return updatedIdentity;
    } catch (error) {
      throw new SystemError('Failed to rename identity', { error });
    }
  }

  get(alias: string): Identity {
    const identity = this.identities.get(alias);
    if (!identity) {
      throw new IdentityNotFoundError(alias);
    }
    return identity;
  }

  getAll(): Identity[] {
    return Array.from(this.identities.values());
  }

  exists(alias: string): boolean {
    return this.identities.has(alias);
  }

  async getPublicKey(alias: string): Promise<string> {
    const identity = this.get(alias);
    try {
      return await fs.readFile(`${identity.keyPath}.pub`, 'utf8');
    } catch (error) {
      throw new SystemError('Failed to read public key', { error });
    }
  }

  async rotateKey(alias: string, passphrase?: string): Promise<Identity> {
    const logger = getLogger();
    const identity = this.get(alias);

    try {
      const backupPath = `${identity.keyPath}.backup`;
      await fs.rename(identity.keyPath, backupPath);
      await fs.rename(`${identity.keyPath}.pub`, `${backupPath}.pub`);

      await this.ssh.generateKey({
        path: identity.keyPath,
        type: identity.keyType,
        passphrase,
        comment: `${alias}@gitid`
      });

      const publicKey = await fs.readFile(`${identity.keyPath}.pub`, 'utf8');
      const fingerprint = CryptoService.generateFingerprint(publicKey);

      const updated: Identity = {
        ...identity,
        publicKeyFingerprint: fingerprint,
        isEncrypted: !!passphrase,
        updatedAt: new Date().toISOString(),
        metadata: {
          ...identity.metadata,
          lastRotated: new Date().toISOString()
        }
      };

      this.identities.set(alias, updated);
      await this.saveIdentities();

      logger.info('Key rotated', { alias, fingerprint });
      logger.audit('KEY_ROTATED', { alias, fingerprint });

      return updated;
    } catch (error) {
      throw new SystemError('Failed to rotate key', { error });
    }
  }

  async export(alias: string): Promise<string> {
    const identity = this.get(alias);
    const publicKey = await this.getPublicKey(alias);
    
    return JSON.stringify({
      identity,
      publicKey
    }, null, 2);
  }

  async import(data: string): Promise<Identity> {
    try {
      const parsed = JSON.parse(data);
      const identity = IdentitySchema.parse(parsed.identity);
      
      if (this.identities.has(identity.alias)) {
        throw new IdentityExistsError(identity.alias);
      }

      await fs.writeFile(identity.keyPath, parsed.privateKey, { mode: 0o600 });
      await fs.writeFile(`${identity.keyPath}.pub`, parsed.publicKey, { mode: 0o644 });

      await this.ssh.addIdentityToConfig(identity);
      
      this.identities.set(identity.alias, identity);
      await this.saveIdentities();

      return identity;
    } catch (error) {
      throw new SystemError('Failed to import identity', { error });
    }
  }
}