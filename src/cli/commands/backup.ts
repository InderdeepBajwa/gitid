import type { Command } from 'commander';
import { confirm, select } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import path from 'node:path';
import type { Services } from './index.js';

export function registerBackupCommands(program: Command, services: Services): void {
  const backup = program.command('backup').description('Backup and restore operations');

  backup
    .command('create')
    .option('--full', 'Create full backup including all files')
    .description('Create a backup of identities')
    .action(async (options) => {
      const spinner = ora('Creating backup...').start();
      
      try {
        if (options.full) {
          const backupPath = await services.backup.createFullBackup();
          spinner.succeed(chalk.green('Full backup created'));
          console.log(chalk.dim(`Location: ${backupPath}`));
        } else {
          const identities = services.identityService.getAll();
          const backupPath = await services.backup.backupIdentities(identities);
          spinner.succeed(chalk.green(`Backup created (${identities.length} identities)`));
          console.log(chalk.dim(`Location: ${backupPath}`));
        }
      } catch (error: any) {
        spinner.fail(chalk.red('Backup failed'));
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  backup
    .command('list')
    .option('--json', 'Output in JSON format')
    .description('List available backups')
    .action(async (options) => {
      try {
        const backups = await services.backup.listBackups();
        
        if (backups.length === 0) {
          console.log(chalk.yellow('No backups found'));
          return;
        }

        if (options.json) {
          console.log(JSON.stringify(backups, null, 2));
          return;
        }

        console.log(chalk.bold('Available Backups:'));
        console.log(chalk.dim('─'.repeat(60)));
        
        backups.forEach((backup, index) => {
          const date = new Date(backup.metadata.timestamp);
          console.log(`\n${index + 1}. ${chalk.cyan(backup.name)}`);
          console.log(`   Date: ${date.toLocaleString()}`);
          console.log(`   Identities: ${backup.metadata.identityCount}`);
          console.log(`   Encrypted: ${backup.metadata.encrypted ? chalk.green('Yes') : chalk.yellow('No')}`);
        });
      } catch (error: any) {
        console.error(chalk.red(`Failed to list backups: ${error.message}`));
        process.exit(1);
      }
    });

  backup
    .command('restore')
    .argument('[backup-name]', 'Backup name to restore')
    .option('--force', 'Skip confirmation')
    .description('Restore identities from backup')
    .action(async (backupName, options) => {
      try {
        let selectedBackup = backupName;
        
        if (!selectedBackup) {
          const backups = await services.backup.listBackups();
          
          if (backups.length === 0) {
            console.log(chalk.yellow('No backups available'));
            return;
          }

          const choices = backups.map(b => ({
            name: `${b.name} (${new Date(b.metadata.timestamp).toLocaleDateString()})`,
            value: b.name,
            description: `${b.metadata.identityCount} identities`
          }));

          selectedBackup = await select({
            message: 'Select backup to restore:',
            choices
          });
        }

        const shouldRestore = options.force || await confirm({
          message: chalk.yellow('⚠️  This will overwrite existing identities. Continue?'),
          default: false
        });

        if (!shouldRestore) {
          console.log(chalk.yellow('Cancelled'));
          return;
        }

        const spinner = ora('Restoring backup...').start();
        const backupPath = path.join(
          services.config.backupDir,
          `${selectedBackup}.backup.gz`
        );
        
        const identities = await services.backup.restoreIdentities(backupPath);
        spinner.succeed(chalk.green(`Restored ${identities.length} identities`));
      } catch (error: any) {
        console.error(chalk.red(`Restore failed: ${error.message}`));
        process.exit(1);
      }
    });

  backup
    .command('export')
    .argument('<alias>', 'Identity alias to export')
    .argument('<output-dir>', 'Output directory')
    .description('Export identity keys to directory')
    .action(async (alias, outputDir) => {
      const spinner = ora('Exporting keys...').start();
      
      try {
        await services.backup.exportKeys(alias, outputDir);
        spinner.succeed(chalk.green(`Keys exported to ${outputDir}`));
        console.log(chalk.yellow('⚠️  Keep these files secure!'));
      } catch (error: any) {
        spinner.fail(chalk.red('Export failed'));
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  backup
    .command('import')
    .argument('<alias>', 'Identity alias')
    .argument('<private-key>', 'Path to private key')
    .argument('<public-key>', 'Path to public key')
    .description('Import identity keys from files')
    .action(async (alias, privateKeyPath, publicKeyPath) => {
      const spinner = ora('Importing keys...').start();
      
      try {
        await services.backup.importKeys(alias, privateKeyPath, publicKeyPath);
        spinner.succeed(chalk.green(`Keys imported for identity '${alias}'`));
      } catch (error: any) {
        spinner.fail(chalk.red('Import failed'));
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });
}