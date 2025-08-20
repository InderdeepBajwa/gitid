import type { Command } from 'commander';
import { input, select, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import yaml from 'yaml';
import type { Services } from './index.js';

export function registerConfigCommands(program: Command, services: Services): void {
  const config = program.command('config').description('Manage gitid configuration');

  config
    .command('show')
    .option('--json', 'Output in JSON format')
    .description('Show current configuration')
    .action(async (options) => {
      const currentConfig = services.config.getConfig();
      
      if (options.json) {
        console.log(JSON.stringify(currentConfig, null, 2));
      } else {
        console.log(chalk.bold('GitID Configuration:'));
        console.log(chalk.dim('─'.repeat(50)));
        console.log(yaml.stringify(currentConfig));
      }
    });

  config
    .command('set')
    .argument('<key>', 'Configuration key (e.g., security.requirePassphrase)')
    .argument('<value>', 'Configuration value')
    .description('Set a configuration value')
    .action(async (key, value) => {
      try {
        const keys = key.split('.');
        const currentConfig = services.config.getConfig();
        let configRef: any = currentConfig;
        
        for (let i = 0; i < keys.length - 1; i++) {
          if (!configRef[keys[i]!]) {
            configRef[keys[i]!] = {};
          }
          configRef = configRef[keys[i]!];
        }
        
        const lastKey = keys[keys.length - 1]!;
        
        // Parse boolean and number values
        let parsedValue: any = value;
        if (value === 'true') parsedValue = true;
        else if (value === 'false') parsedValue = false;
        else if (!isNaN(Number(value))) parsedValue = Number(value);
        
        configRef[lastKey] = parsedValue;
        
        await services.config.updateConfig(currentConfig);
        console.log(chalk.green(`Configuration updated: ${key} = ${parsedValue}`));
      } catch (error: any) {
        console.error(chalk.red(`Failed to update configuration: ${error.message}`));
        process.exit(1);
      }
    });

  config
    .command('reset')
    .option('--force', 'Skip confirmation')
    .description('Reset configuration to defaults')
    .action(async (options) => {
      const shouldReset = options.force || await confirm({
        message: chalk.yellow('Reset all configuration to defaults?'),
        default: false
      });

      if (!shouldReset) {
        console.log(chalk.yellow('Cancelled'));
        return;
      }

      try {
        const defaultConfig = services.config.getConfig();
        await services.config.saveConfig(defaultConfig);
        console.log(chalk.green('Configuration reset to defaults'));
      } catch (error: any) {
        console.error(chalk.red(`Failed to reset configuration: ${error.message}`));
        process.exit(1);
      }
    });

  config
    .command('security')
    .description('Configure security settings interactively')
    .action(async () => {
      try {
        const currentConfig = services.config.getConfig();
        
        const requirePassphrase = await confirm({
          message: 'Require passphrase for all new keys?',
          default: currentConfig.security.requirePassphrase
        });

        const autoRotateKeys = await confirm({
          message: 'Enable automatic key rotation?',
          default: currentConfig.security.autoRotateKeys
        });

        let rotationInterval = currentConfig.security.rotationIntervalDays;
        if (autoRotateKeys) {
          const intervalStr = await input({
            message: 'Key rotation interval (days):',
            default: rotationInterval.toString()
          });
          rotationInterval = parseInt(intervalStr);
        }

        const enforceExpiration = await confirm({
          message: 'Enforce key expiration?',
          default: currentConfig.security.enforceKeyExpiration
        });

        currentConfig.security = {
          ...currentConfig.security,
          requirePassphrase,
          autoRotateKeys,
          rotationIntervalDays: rotationInterval,
          enforceKeyExpiration: enforceExpiration
        };

        await services.config.updateConfig(currentConfig);
        console.log(chalk.green('Security configuration updated'));
      } catch (error: any) {
        console.error(chalk.red(`Failed to update security settings: ${error.message}`));
        process.exit(1);
      }
    });

  config
    .command('paths')
    .description('Show configured paths')
    .action(() => {
      console.log(chalk.bold('Configured Paths:'));
      console.log(chalk.dim('─'.repeat(50)));
      console.log(`Config directory: ${services.config.configDir}`);
      console.log(`SSH directory: ${services.config.sshDir}`);
      console.log(`Keys directory: ${services.config.keysDir}`);
      console.log(`Backup directory: ${services.config.backupDir}`);
      console.log(`Log directory: ${services.config.logDir}`);
    });

  config
    .command('validate')
    .description('Validate configuration and environment')
    .action(async () => {
      console.log(chalk.bold('Validating configuration...'));
      
      const checks = [
        {
          name: 'Configuration file',
          check: () => services.config.getConfig() !== null
        },
        {
          name: 'SSH directory',
          check: () => {
            const fs = require('fs');
            return fs.existsSync(services.config.sshDir);
          }
        },
        {
          name: 'Keys directory',
          check: () => {
            const fs = require('fs');
            return fs.existsSync(services.config.keysDir);
          }
        },
        {
          name: 'SSH config writable',
          check: () => {
            const fs = require('fs');
            const path = require('path');
            const sshConfig = path.join(services.config.sshDir, 'config');
            try {
              fs.accessSync(sshConfig, fs.constants.W_OK);
              return true;
            } catch {
              return false;
            }
          }
        },
        {
          name: 'Git installed',
          check: () => {
            try {
              require('child_process').execSync('git --version', { stdio: 'pipe' });
              return true;
            } catch {
              return false;
            }
          }
        },
        {
          name: 'SSH installed',
          check: () => {
            try {
              require('child_process').execSync('ssh -V', { stdio: 'pipe' });
              return true;
            } catch {
              return false;
            }
          }
        }
      ];

      let allPassed = true;
      
      for (const check of checks) {
        try {
          const passed = check.check();
          if (passed) {
            console.log(chalk.green('✓'), check.name);
          } else {
            console.log(chalk.red('✗'), check.name);
            allPassed = false;
          }
        } catch (error) {
          console.log(chalk.red('✗'), check.name, chalk.dim(`(${error})`));
          allPassed = false;
        }
      }

      if (allPassed) {
        console.log('\n' + chalk.green('All checks passed!'));
      } else {
        console.log('\n' + chalk.yellow('Some checks failed. Please review the issues above.'));
        process.exit(1);
      }
    });
}