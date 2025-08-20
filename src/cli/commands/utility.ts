import type { Command } from 'commander';
import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'node:child_process';
import type { Services } from './index.js';

export function registerUtilityCommands(program: Command, services: Services): void {
  program
    .command('doctor')
    .description('Diagnose and fix common issues')
    .action(async () => {
      console.log(chalk.bold('Running GitID diagnostics...\n'));
      
      const checks = [
        {
          name: 'SSH Agent',
          check: async () => {
            try {
              execSync('ssh-add -l', { stdio: 'pipe' });
              return { passed: true, message: 'SSH agent is running' };
            } catch {
              return { passed: false, message: 'SSH agent not running or no keys loaded' };
            }
          }
        },
        {
          name: 'Git Installation',
          check: async () => {
            try {
              const version = execSync('git --version', { encoding: 'utf8' }).trim();
              return { passed: true, message: version };
            } catch {
              return { passed: false, message: 'Git not found' };
            }
          }
        },
        {
          name: 'SSH Installation',
          check: async () => {
            try {
              execSync('ssh -V', { stdio: 'pipe', encoding: 'utf8' });
              return { passed: true, message: 'SSH is installed' };
            } catch {
              return { passed: false, message: 'SSH not found' };
            }
          }
        },
        {
          name: 'Configuration',
          check: async () => {
            try {
              const config = services.config.getConfig();
              return { passed: true, message: 'Configuration loaded' };
            } catch {
              return { passed: false, message: 'Configuration error' };
            }
          }
        },
        {
          name: 'Identity Database',
          check: async () => {
            try {
              const identities = services.identityService.getAll();
              return { 
                passed: true, 
                message: `${identities.length} identities found` 
              };
            } catch {
              return { passed: false, message: 'Cannot read identities' };
            }
          }
        },
        {
          name: 'SSH Config',
          check: async () => {
            try {
              const fs = await import('node:fs/promises');
              const path = await import('node:path');
              const sshConfig = path.join(services.config.sshDir, 'config');
              await fs.access(sshConfig);
              return { passed: true, message: 'SSH config accessible' };
            } catch {
              return { passed: false, message: 'SSH config not accessible' };
            }
          }
        }
      ];

      let allPassed = true;
      const results: Array<{ name: string; passed: boolean; message: string }> = [];

      for (const check of checks) {
        const spinner = ora(check.name).start();
        const result = await check.check();
        
        if (result.passed) {
          spinner.succeed(`${check.name}: ${chalk.dim(result.message)}`);
        } else {
          spinner.fail(`${check.name}: ${chalk.red(result.message)}`);
          allPassed = false;
        }
        
        results.push({ name: check.name, ...result });
      }

      console.log('\n' + chalk.bold('Diagnostics Summary:'));
      console.log(chalk.dim('─'.repeat(50)));
      
      if (allPassed) {
        console.log(chalk.green('✓ All checks passed!'));
      } else {
        console.log(chalk.yellow('⚠ Some checks failed'));
        
        const shouldFix = await confirm({
          message: 'Would you like to attempt automatic fixes?',
          default: true
        });

        if (shouldFix) {
          await attemptFixes(results, services);
        }
      }
    });

  program
    .command('version')
    .description('Show detailed version information')
    .action(() => {
      const packageJson = require('../../../package.json');
      
      console.log(chalk.bold('GitID Version Information:'));
      console.log(chalk.dim('─'.repeat(50)));
      console.log(`Version: ${chalk.cyan(packageJson.version)}`);
      console.log(`Node: ${chalk.cyan(process.version)}`);
      console.log(`Platform: ${chalk.cyan(process.platform)}`);
      console.log(`Architecture: ${chalk.cyan(process.arch)}`);
      
      try {
        const gitVersion = execSync('git --version', { encoding: 'utf8' }).trim();
        console.log(`Git: ${chalk.cyan(gitVersion.replace('git version ', ''))}`);
      } catch {
        console.log(`Git: ${chalk.red('Not found')}`);
      }
      
      try {
        execSync('ssh -V', { stdio: 'pipe' });
        console.log(`SSH: ${chalk.cyan('Installed')}`);
      } catch {
        console.log(`SSH: ${chalk.red('Not found')}`);
      }
    });

  program
    .command('clean')
    .option('--force', 'Skip confirmation')
    .description('Clean up orphaned keys and invalid identities')
    .action(async (options) => {
      const shouldClean = options.force || await confirm({
        message: chalk.yellow('This will remove orphaned keys and invalid identities. Continue?'),
        default: false
      });

      if (!shouldClean) {
        console.log(chalk.yellow('Cancelled'));
        return;
      }

      const spinner = ora('Cleaning up...').start();
      
      try {
        const identities = services.identityService.getAll();
        let cleaned = 0;
        
        for (const identity of identities) {
          try {
            await services.identityService.getPublicKey(identity.alias);
          } catch {
            await services.identityService.remove(identity.alias, false);
            cleaned++;
          }
        }
        
        spinner.succeed(chalk.green(`Cleanup complete. Removed ${cleaned} invalid identities`));
      } catch (error: any) {
        spinner.fail(chalk.red('Cleanup failed'));
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  program
    .command('test-connection')
    .argument('<alias>', 'Identity alias to test')
    .description('Test SSH connection for an identity')
    .action(async (alias) => {
      const spinner = ora(`Testing connection for '${alias}'...`).start();
      
      try {
        const identity = services.identityService.get(alias);
        const result = await services.ssh.testConnection(identity);
        
        if (result) {
          spinner.succeed(chalk.green(`Connection successful for '${alias}'`));
          console.log(chalk.dim(`Host: ${identity.hostName}`));
        } else {
          spinner.fail(chalk.red(`Connection failed for '${alias}'`));
          console.log(chalk.yellow('\nTroubleshooting tips:'));
          console.log('1. Ensure your public key is added to the Git provider');
          console.log('2. Check network connectivity');
          console.log('3. Verify the host is correct');
        }
      } catch (error: any) {
        spinner.fail(chalk.red('Test failed'));
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });
}

async function attemptFixes(
  results: Array<{ name: string; passed: boolean; message: string }>,
  services: Services
): Promise<void> {
  const spinner = ora('Attempting fixes...').start();
  
  for (const result of results) {
    if (!result.passed) {
      switch (result.name) {
        case 'SSH Agent':
          try {
            execSync('eval $(ssh-agent -s)', { shell: '/bin/bash' });
            spinner.info('Started SSH agent');
          } catch {
            spinner.warn('Could not start SSH agent automatically');
          }
          break;
          
        case 'SSH Config':
          try {
            const fs = await import('node:fs/promises');
            const path = await import('node:path');
            const sshConfig = path.join(services.config.sshDir, 'config');
            await fs.writeFile(sshConfig, '', { mode: 0o600 });
            spinner.info('Created SSH config file');
          } catch {
            spinner.warn('Could not create SSH config');
          }
          break;
      }
    }
  }
  
  spinner.succeed('Fix attempts complete');
}