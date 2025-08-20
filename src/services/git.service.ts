import { execSync } from 'node:child_process';
import path from 'node:path';
import type { Identity } from '../models/identity.js';
import { IdentityService } from './identity.service.js';
import { GitError, SystemError } from '../utils/errors.js';
import { getLogger } from '../utils/logger.js';

interface ParsedRemote {
  host: string;
  path: string;
  type: 'ssh' | 'https' | 'other';
}

interface CloneOptions {
  alias: string;
  repository: string;
  directory?: string;
  depth?: number;
  branch?: string;
  recursive?: boolean;
}

export class GitService {
  private static instance: GitService;

  private constructor(private readonly identityService: IdentityService) {}

  static getInstance(identityService: IdentityService): GitService {
    if (!GitService.instance) {
      GitService.instance = new GitService(identityService);
    }
    return GitService.instance;
  }

  isGitRepository(): boolean {
    try {
      const result = execSync('git rev-parse --is-inside-work-tree', {
        stdio: 'pipe',
        encoding: 'utf8'
      }).trim();
      return result === 'true';
    } catch {
      return false;
    }
  }

  assertGitRepository(): void {
    if (!this.isGitRepository()) {
      throw new GitError(
        'Not a git repository',
        'Current directory is not inside a git repository'
      );
    }
  }

  getRemoteUrl(remote: string = 'origin'): string {
    try {
      return execSync(`git remote get-url ${remote}`, {
        stdio: 'pipe',
        encoding: 'utf8'
      }).trim();
    } catch (error) {
      throw new GitError(
        `Remote '${remote}' not found`,
        `Failed to get URL for remote '${remote}'`,
        { remote, error }
      );
    }
  }

  setRemoteUrl(remote: string, url: string): void {
    try {
      execSync(`git remote set-url ${remote} ${this.shellEscape(url)}`, {
        stdio: 'pipe'
      });
    } catch (error) {
      throw new GitError(
        'Failed to set remote URL',
        `Could not update remote '${remote}'`,
        { remote, url, error }
      );
    }
  }

  parseRemote(url: string): ParsedRemote {
    const sshMatch = url.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
    if (sshMatch) {
      return {
        host: sshMatch[1]!,
        path: sshMatch[2]!,
        type: 'ssh'
      };
    }

    const httpsMatch = url.match(/^https?:\/\/([^/]+)\/(.+?)(?:\.git)?$/);
    if (httpsMatch) {
      return {
        host: httpsMatch[1]!,
        path: httpsMatch[2]!,
        type: 'https'
      };
    }

    return { host: '', path: url, type: 'other' };
  }

  async useIdentity(alias: string, remote: string = 'origin'): Promise<void> {
    const logger = getLogger();
    this.assertGitRepository();

    const identity = this.identityService.get(alias);
    const currentUrl = this.getRemoteUrl(remote);
    const parsed = this.parseRemote(currentUrl);

    if (parsed.type === 'other') {
      throw new GitError(
        'Unsupported remote URL',
        'Remote URL format is not supported'
      );
    }

    const newUrl = `git@${alias}:${parsed.path.replace(/\.git$/, '')}.git`;
    this.setRemoteUrl(remote, newUrl);

    if (identity.gitUserName || identity.gitUserEmail) {
      this.updateGitConfig({
        name: identity.gitUserName,
        email: identity.gitUserEmail
      });
    }

    await this.updateIdentityUsage(alias);

    logger.info('Switched to identity', { 
      alias,
      remote,
      url: newUrl 
    });
  }

  async getCurrentIdentity(remote: string = 'origin'): Promise<string | null> {
    try {
      this.assertGitRepository();
      const url = this.getRemoteUrl(remote);
      const parsed = this.parseRemote(url);

      if (parsed.type === 'ssh') {
        const alias = parsed.host;
        if (this.identityService.exists(alias)) {
          return alias;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  async clone(options: CloneOptions): Promise<void> {
    const logger = getLogger();
    const identity = this.identityService.get(options.alias);

    const parsed = this.parseRemote(options.repository);
    let repoPath: string;

    if (parsed.type === 'ssh' || parsed.type === 'https') {
      repoPath = parsed.path.replace(/\.git$/, '');
    } else {
      const shorthandMatch = options.repository.match(
        /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)+(?:\.git)?$/
      );
      if (shorthandMatch) {
        repoPath = options.repository.replace(/\.git$/, '');
      } else {
        throw new GitError(
          'Invalid repository format',
          'Repository must be a valid URL or shorthand (owner/repo)'
        );
      }
    }

    const cloneUrl = `git@${options.alias}:${repoPath}.git`;
    const destDir = options.directory || path.basename(repoPath);

    const args: string[] = ['clone', cloneUrl, destDir];
    
    if (options.depth) {
      args.push('--depth', options.depth.toString());
    }
    
    if (options.branch) {
      args.push('--branch', options.branch);
    }
    
    if (options.recursive) {
      args.push('--recursive');
    }

    try {
      execSync(`git ${args.map(arg => this.shellEscape(arg)).join(' ')}`, {
        stdio: 'inherit'
      });

      if (identity.gitUserName || identity.gitUserEmail) {
        const gitDir = path.join(destDir, '.git');
        if (identity.gitUserName) {
          execSync(
            `git --git-dir=${this.shellEscape(gitDir)} config user.name ${this.shellEscape(identity.gitUserName)}`,
            { stdio: 'pipe' }
          );
        }
        if (identity.gitUserEmail) {
          execSync(
            `git --git-dir=${this.shellEscape(gitDir)} config user.email ${this.shellEscape(identity.gitUserEmail)}`,
            { stdio: 'pipe' }
          );
        }
      }

      await this.updateIdentityUsage(options.alias);

      logger.info('Repository cloned', {
        alias: options.alias,
        repository: repoPath,
        directory: destDir
      });
    } catch (error) {
      throw new GitError(
        'Clone failed',
        `Failed to clone repository: ${options.repository}`,
        { error }
      );
    }
  }

  updateGitConfig(config: { name?: string; email?: string }): void {
    try {
      if (config.name) {
        execSync(`git config user.name ${this.shellEscape(config.name)}`, {
          stdio: 'pipe'
        });
      }
      if (config.email) {
        execSync(`git config user.email ${this.shellEscape(config.email)}`, {
          stdio: 'pipe'
        });
      }
    } catch (error) {
      throw new GitError(
        'Failed to update git config',
        'Could not update git user configuration',
        { error }
      );
    }
  }

  getGitConfig(): { name?: string; email?: string } {
    const config: { name?: string; email?: string } = {};
    
    try {
      config.name = execSync('git config user.name', {
        stdio: 'pipe',
        encoding: 'utf8'
      }).trim();
    } catch {}
    
    try {
      config.email = execSync('git config user.email', {
        stdio: 'pipe',
        encoding: 'utf8'
      }).trim();
    } catch {}
    
    return config;
  }

  applyIdentityConfig(alias: string): void {
    const identity = this.identityService.get(alias);
    
    if (!identity.gitUserName && !identity.gitUserEmail) {
      throw new GitError(
        'No git config',
        `Identity '${alias}' has no git user configuration`
      );
    }

    this.assertGitRepository();
    this.updateGitConfig({
      name: identity.gitUserName,
      email: identity.gitUserEmail
    });
  }

  private async updateIdentityUsage(alias: string): Promise<void> {
    try {
      const identity = this.identityService.get(alias);
      await this.identityService.update(alias, {
        metadata: {
          ...identity.metadata,
          usageCount: (identity.metadata?.usageCount || 0) + 1,
          lastUsed: new Date().toISOString()
        }
      });
    } catch (error) {
      getLogger().warn('Failed to update identity usage', { alias, error });
    }
  }

  private shellEscape(str: string): string {
    if (/^[A-Za-z0-9@._:\/+-]+$/.test(str)) {
      return str;
    }
    return `'${str.replace(/'/g, "'\\''")}'`;
  }

  getBranch(): string {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', {
        stdio: 'pipe',
        encoding: 'utf8'
      }).trim();
    } catch {
      return 'unknown';
    }
  }

  getStatus(): string {
    try {
      return execSync('git status --porcelain', {
        stdio: 'pipe',
        encoding: 'utf8'
      }).trim();
    } catch {
      return '';
    }
  }

  hasUncommittedChanges(): boolean {
    return this.getStatus().length > 0;
  }

  getLastCommit(): { hash: string; message: string; author: string; date: string } | null {
    try {
      const output = execSync(
        'git log -1 --format="%H|%s|%an|%ai"',
        { stdio: 'pipe', encoding: 'utf8' }
      ).trim();
      
      const [hash, message, author, date] = output.split('|');
      return { 
        hash: hash || '',
        message: message || '',
        author: author || '',
        date: date || ''
      };
    } catch {
      return null;
    }
  }
}