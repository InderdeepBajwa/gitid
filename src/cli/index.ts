#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigService } from '../services/config.service.js';
import { SSHService } from '../services/ssh.service.js';
import { IdentityService } from '../services/identity.service.js';
import { GitService } from '../services/git.service.js';
import { BackupService } from '../services/backup.service.js';
import { Logger } from '../utils/logger.js';
import { isGitIdError, handleError } from '../utils/errors.js';
import { registerCommands } from './commands/index.js';

async function main() {
  try {
    const config = ConfigService.getInstance();
    await config.initialize();

    Logger.initialize(config.logging, config.logDir);

    const ssh = SSHService.getInstance(config);
    await ssh.initialize();

    const backup = BackupService.getInstance(config);
    const identityService = IdentityService.getInstance(config, ssh, backup);
    await identityService.initialize();

    const git = GitService.getInstance(identityService);

    const program = new Command();
    
    program
      .name('gitid')
      .description('Enterprise-grade Git identity management system')
      .version('2.0.0')
      .option('-v, --verbose', 'Enable verbose output')
      .option('--json', 'Output in JSON format')
      .hook('preAction', (thisCommand) => {
        const options = thisCommand.opts();
        if (options.verbose) {
          const logger = Logger.getInstance();
          logger.info('Verbose mode enabled');
        }
      });

    registerCommands(program, {
      config,
      ssh,
      identityService,
      git,
      backup
    });

    await program.parseAsync(process.argv);
  } catch (error) {
    handleErrorOutput(error);
    process.exit(1);
  }
}

function handleErrorOutput(error: unknown) {
  const gitIdError = handleError(error);
  
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--verbose')) {
    console.error(chalk.red('Error Details:'));
    console.error(gitIdError.toJSON());
  } else {
    console.error(chalk.red('Error:'), gitIdError.message);
    
    if (gitIdError.recoverable) {
      console.error(chalk.yellow('\nThis error may be recoverable. Try running with --verbose for more details.'));
    }
  }

  const logger = Logger.getInstance();
  logger.error('Command failed', gitIdError);
}

main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});