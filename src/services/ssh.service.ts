import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import type { Identity, KeyType } from '../models/identity.js';
import { ConfigService } from './config.service.js';
import { SystemError } from '../utils/errors.js';
import { getLogger } from '../utils/logger.js';

interface GenerateKeyOptions {
  path: string;
  type: KeyType;
  passphrase?: string;
  comment?: string;
}

export class SSHService {
  private static instance: SSHService;
  private readonly sshConfigPath: string;
  private readonly markerBegin = (alias: string) => `# >>> gitid: ${alias} BEGIN`;
  private readonly markerEnd = (alias: string) => `# <<< gitid: ${alias} END`;

  private constructor(private readonly config: ConfigService) {
    this.sshConfigPath = path.join(config.sshDir, 'config');
  }

  static getInstance(config: ConfigService): SSHService {
    if (!SSHService.instance) {
      SSHService.instance = new SSHService(config);
    }
    return SSHService.instance;
  }

  async initialize(): Promise<void> {
    await this.ensureSSHDirectory();
    await this.ensureSSHConfig();
  }

  private async ensureSSHDirectory(): Promise<void> {
    await fs.mkdir(this.config.sshDir, { recursive: true, mode: 0o700 });
    await fs.mkdir(this.config.keysDir, { recursive: true, mode: 0o700 });
  }

  private async ensureSSHConfig(): Promise<void> {
    try {
      await fs.access(this.sshConfigPath);
    } catch {
      await fs.writeFile(this.sshConfigPath, '', { mode: 0o600 });
    }
  }

  async generateKey(options: GenerateKeyOptions): Promise<void> {
    const logger = getLogger();
    
    try {
      const args: string[] = [
        '-t', options.type,
        '-f', options.path,
        '-N', options.passphrase || '',
        '-C', options.comment || ''
      ];

      if (options.type === 'rsa') {
        args.push('-b', '4096');
      } else if (options.type === 'ecdsa') {
        args.push('-b', '521');
      }

      const command = `ssh-keygen ${args.map(arg => this.shellEscape(arg)).join(' ')}`;
      
      execSync(command, { 
        stdio: 'pipe',
        encoding: 'utf8'
      });

      await fs.chmod(options.path, 0o600);
      await fs.chmod(`${options.path}.pub`, 0o644);

      logger.debug('SSH key generated', { 
        path: options.path,
        type: options.type 
      });
    } catch (error) {
      throw new SystemError('Failed to generate SSH key', { error });
    }
  }

  async addIdentityToConfig(identity: Identity): Promise<void> {
    const logger = getLogger();
    
    try {
      const config = await this.readSSHConfig();
      
      if (this.hasIdentityBlock(config, identity.alias)) {
        await this.removeIdentityFromConfig(identity.alias);
      }

      const block = this.createConfigBlock(identity);
      const newConfig = config + '\n' + block;
      
      await this.writeSSHConfig(newConfig);
      
      logger.debug('Identity added to SSH config', { alias: identity.alias });
    } catch (error) {
      throw new SystemError('Failed to add identity to SSH config', { error });
    }
  }

  async removeIdentityFromConfig(alias: string): Promise<void> {
    const logger = getLogger();
    
    try {
      const config = await this.readSSHConfig();
      
      if (!this.hasIdentityBlock(config, alias)) {
        return;
      }

      const begin = this.markerBegin(alias);
      const end = this.markerEnd(alias);
      const regex = new RegExp(
        `\n?${this.escapeRegex(begin)}[\\s\\S]*?${this.escapeRegex(end)}\n?`,
        'g'
      );
      
      const newConfig = config.replace(regex, '');
      await this.writeSSHConfig(newConfig);
      
      logger.debug('Identity removed from SSH config', { alias });
    } catch (error) {
      throw new SystemError('Failed to remove identity from SSH config', { error });
    }
  }

  private createConfigBlock(identity: Identity): string {
    const lines = [
      this.markerBegin(identity.alias),
      `Host ${identity.alias}`,
      `  HostName ${identity.hostName}`,
      `  User git`,
      `  IdentityFile ${identity.keyPath}`,
      `  IdentitiesOnly yes`,
      `  AddKeysToAgent yes`,
      `  UseKeychain yes`,
      `  StrictHostKeyChecking accept-new`,
      `  LogLevel ERROR`,
      this.markerEnd(identity.alias)
    ];

    return lines.join('\n');
  }

  private async readSSHConfig(): Promise<string> {
    try {
      return await fs.readFile(this.sshConfigPath, 'utf8');
    } catch {
      return '';
    }
  }

  private async writeSSHConfig(content: string): Promise<void> {
    await fs.writeFile(this.sshConfigPath, content, { mode: 0o600 });
  }

  private hasIdentityBlock(config: string, alias: string): boolean {
    return config.includes(this.markerBegin(alias));
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private shellEscape(str: string): string {
    if (/^[A-Za-z0-9@._:\/+-]+$/.test(str)) {
      return str;
    }
    return `'${str.replace(/'/g, "'\\''")}'`;
  }

  async testConnection(identity: Identity): Promise<boolean> {
    try {
      const command = `ssh -T -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new git@${identity.alias}`;
      execSync(command, { stdio: 'pipe' });
      return true;
    } catch (error: any) {
      return error?.status === 1;
    }
  }

  async getFingerprint(keyPath: string): Promise<string> {
    try {
      const output = execSync(
        `ssh-keygen -lf ${this.shellEscape(keyPath)}`,
        { encoding: 'utf8' }
      );
      const parts = output.trim().split(' ');
      return parts[1] || '';
    } catch (error) {
      throw new SystemError('Failed to get key fingerprint', { error });
    }
  }

  async validateKey(keyPath: string): Promise<boolean> {
    try {
      execSync(`ssh-keygen -y -f ${this.shellEscape(keyPath)}`, { 
        stdio: 'pipe' 
      });
      return true;
    } catch {
      return false;
    }
  }

  async addToAgent(keyPath: string, passphrase?: string): Promise<void> {
    try {
      if (passphrase) {
        const command = `echo ${this.shellEscape(passphrase)} | ssh-add ${this.shellEscape(keyPath)}`;
        execSync(command, { stdio: 'pipe' });
      } else {
        execSync(`ssh-add ${this.shellEscape(keyPath)}`, { stdio: 'pipe' });
      }
    } catch (error) {
      throw new SystemError('Failed to add key to SSH agent', { error });
    }
  }

  async removeFromAgent(keyPath: string): Promise<void> {
    try {
      execSync(`ssh-add -d ${this.shellEscape(keyPath)}`, { stdio: 'pipe' });
    } catch (error) {
      throw new SystemError('Failed to remove key from SSH agent', { error });
    }
  }

  async listAgentKeys(): Promise<string[]> {
    try {
      const output = execSync('ssh-add -l', { encoding: 'utf8' });
      return output.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }
}