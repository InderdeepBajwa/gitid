import type { Command } from 'commander';
import type { ConfigService } from '../../services/config.service.js';
import type { SSHService } from '../../services/ssh.service.js';
import type { IdentityService } from '../../services/identity.service.js';
import type { GitService } from '../../services/git.service.js';
import type { BackupService } from '../../services/backup.service.js';

import { registerIdentityCommands } from './identity.js';
import { registerGitCommands } from './git.js';
import { registerBackupCommands } from './backup.js';
import { registerConfigCommands } from './config.js';
import { registerUtilityCommands } from './utility.js';

export interface Services {
  config: ConfigService;
  ssh: SSHService;
  identityService: IdentityService;
  git: GitService;
  backup: BackupService;
}

export function registerCommands(program: Command, services: Services): void {
  registerIdentityCommands(program, services);
  registerGitCommands(program, services);
  registerBackupCommands(program, services);
  registerConfigCommands(program, services);
  registerUtilityCommands(program, services);
}