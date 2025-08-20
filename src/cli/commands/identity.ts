import type { Command } from 'commander';
import { input, password, confirm, select } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import type { Services } from './index.js';
import { CreateIdentityInput, KeyType } from '../../models/identity.js';
import { formatTable } from '../utils/format.js';

export function registerIdentityCommands(program: Command, services: Services): void {
  const identity = program.command('identity').alias('id').description('Manage identities');

  identity
    .command('new')
    .alias('create')
    .argument('[alias]', 'Identity alias')
    .option('-h, --host <host>', 'Git provider host')
    .option('-t, --type <type>', 'Key type (ed25519, rsa, ecdsa)', 'ed25519')
    .option('-p, --passphrase', 'Use passphrase for key')
    .option('-n, --name <name>', 'Git user name')
    .option('-e, --email <email>', 'Git user email')
    .option('--tag <tags...>', 'Tags for the identity')
    .option('--team <team>', 'Team name')
    .option('--project <project>', 'Project name')
    .option('--expires <days>', 'Key expiration in days')
    .description('Create a new identity')
    .action(async (aliasArg, options) => {
      const spinner = ora();
      
      try {
        const alias = aliasArg || await input({
          message: 'Enter identity alias:',
          validate: (value) => value.length > 0 || 'Alias is required'
        });

        const host = options.host || await input({
          message: 'Enter git provider host:',
          default: 'github.com'
        });

        const keyType = options.type as KeyType;
        
        let passphrase: string | undefined;
        if (options.passphrase) {
          passphrase = await password({
            message: 'Enter passphrase for SSH key:',
            mask: '*'
          });
          
          const confirmPass = await password({
            message: 'Confirm passphrase:',
            mask: '*'
          });
          
          if (passphrase !== confirmPass) {
            console.error(chalk.red('Passphrases do not match'));
            process.exit(1);
          }
        }

        const gitUserName = options.name || await input({
          message: 'Git user name (optional):',
          default: undefined
        });

        const gitUserEmail = options.email || await input({
          message: 'Git user email (optional):',
          default: undefined
        });

        const createInput: CreateIdentityInput = {
          alias,
          hostName: host,
          keyType,
          passphrase,
          gitUserName: gitUserName || undefined,
          gitUserEmail: gitUserEmail || undefined,
          metadata: {
            tags: options.tag,
            team: options.team,
            project: options.project,
            expiresAt: options.expires 
              ? new Date(Date.now() + parseInt(options.expires) * 24 * 60 * 60 * 1000).toISOString()
              : undefined,
            usageCount: 0
          }
        };

        spinner.start('Creating identity...');
        const identity = await services.identityService.create(createInput);
        spinner.succeed(chalk.green(`Identity '${identity.alias}' created successfully`));

        console.log('\n' + chalk.bold('Public Key:'));
        const publicKey = await services.identityService.getPublicKey(alias);
        console.log(chalk.cyan(publicKey.trim()));
        
        console.log('\n' + chalk.yellow('Add this public key to your Git provider'));
        console.log(chalk.dim(`Host: ${identity.hostName}`));
        
        if (identity.publicKeyFingerprint) {
          console.log(chalk.dim(`Fingerprint: ${identity.publicKeyFingerprint}`));
        }
      } catch (error: any) {
        spinner.fail(chalk.red('Failed to create identity'));
        throw error;
      }
    });

  identity
    .command('list')
    .alias('ls')
    .option('--json', 'Output in JSON format')
    .option('--verbose', 'Show detailed information')
    .description('List all identities')
    .action(async (options) => {
      const identities = services.identityService.getAll();
      
      if (identities.length === 0) {
        console.log(chalk.yellow('No identities found'));
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(identities, null, 2));
        return;
      }

      if (options.verbose) {
        identities.forEach(id => {
          console.log(chalk.bold(`\n${id.alias}`));
          console.log(chalk.dim('─'.repeat(40)));
          console.log(`  Host: ${id.hostName}`);
          console.log(`  Type: ${id.keyType}`);
          console.log(`  Created: ${new Date(id.createdAt).toLocaleDateString()}`);
          if (id.gitUserName) console.log(`  Name: ${id.gitUserName}`);
          if (id.gitUserEmail) console.log(`  Email: ${id.gitUserEmail}`);
          if (id.metadata?.tags) console.log(`  Tags: ${id.metadata.tags.join(', ')}`);
          if (id.metadata?.lastUsed) {
            console.log(`  Last used: ${new Date(id.metadata.lastUsed).toLocaleDateString()}`);
          }
          if (id.metadata?.usageCount) {
            console.log(`  Usage count: ${id.metadata.usageCount}`);
          }
          console.log(`  Status: ${id.isActive ? chalk.green('Active') : chalk.red('Inactive')}`);
        });
      } else {
        const table = identities.map(id => ({
          Alias: id.alias,
          Host: id.hostName,
          Type: id.keyType,
          Email: id.gitUserEmail || '-',
          Status: id.isActive ? chalk.green('✓') : chalk.red('✗')
        }));
        console.log(formatTable(table));
      }
    });

  identity
    .command('show')
    .argument('<alias>', 'Identity alias')
    .option('--public-key', 'Show only public key')
    .option('--json', 'Output in JSON format')
    .description('Show identity details')
    .action(async (alias, options) => {
      try {
        const id = services.identityService.get(alias);
        
        if (options.publicKey) {
          const publicKey = await services.identityService.getPublicKey(alias);
          console.log(publicKey.trim());
          return;
        }

        if (options.json) {
          console.log(JSON.stringify(id, null, 2));
          return;
        }

        console.log(chalk.bold(`\nIdentity: ${id.alias}`));
        console.log(chalk.dim('─'.repeat(50)));
        console.log(`Host: ${id.hostName}`);
        console.log(`Key Type: ${id.keyType}`);
        console.log(`Created: ${new Date(id.createdAt).toLocaleString()}`);
        console.log(`Updated: ${new Date(id.updatedAt).toLocaleString()}`);
        
        if (id.gitUserName) console.log(`Git Name: ${id.gitUserName}`);
        if (id.gitUserEmail) console.log(`Git Email: ${id.gitUserEmail}`);
        
        console.log(`Status: ${id.isActive ? chalk.green('Active') : chalk.red('Inactive')}`);
        console.log(`Encrypted: ${id.isEncrypted ? chalk.green('Yes') : chalk.yellow('No')}`);
        
        if (id.publicKeyFingerprint) {
          console.log(`Fingerprint: ${id.publicKeyFingerprint}`);
        }

        if (id.metadata) {
          console.log('\n' + chalk.bold('Metadata:'));
          if (id.metadata.tags) console.log(`  Tags: ${id.metadata.tags.join(', ')}`);
          if (id.metadata.team) console.log(`  Team: ${id.metadata.team}`);
          if (id.metadata.project) console.log(`  Project: ${id.metadata.project}`);
          if (id.metadata.lastUsed) {
            console.log(`  Last Used: ${new Date(id.metadata.lastUsed).toLocaleString()}`);
          }
          if (id.metadata.usageCount) {
            console.log(`  Usage Count: ${id.metadata.usageCount}`);
          }
          if (id.metadata.expiresAt) {
            const expiryDate = new Date(id.metadata.expiresAt);
            const isExpired = expiryDate < new Date();
            console.log(`  Expires: ${expiryDate.toLocaleDateString()} ${isExpired ? chalk.red('(EXPIRED)') : ''}`);
          }
        }

        console.log('\n' + chalk.bold('Public Key:'));
        const publicKey = await services.identityService.getPublicKey(alias);
        console.log(chalk.cyan(publicKey.trim()));
      } catch (error: any) {
        console.error(chalk.red(`Failed to show identity: ${error.message}`));
        process.exit(1);
      }
    });

  identity
    .command('remove')
    .alias('rm')
    .argument('<alias>', 'Identity alias')
    .option('--delete-keys', 'Also delete SSH key files')
    .option('--force', 'Skip confirmation')
    .description('Remove an identity')
    .action(async (alias, options) => {
      try {
        const shouldDelete = options.force || await confirm({
          message: `Remove identity '${alias}'?`,
          default: false
        });

        if (!shouldDelete) {
          console.log(chalk.yellow('Cancelled'));
          return;
        }

        const spinner = ora(`Removing identity '${alias}'...`).start();
        await services.identityService.remove(alias, options.deleteKeys);
        spinner.succeed(chalk.green(`Identity '${alias}' removed`));
        
        if (options.deleteKeys) {
          console.log(chalk.dim('SSH keys deleted'));
        }
      } catch (error: any) {
        console.error(chalk.red(`Failed to remove identity: ${error.message}`));
        process.exit(1);
      }
    });

  identity
    .command('rename')
    .argument('<old-alias>', 'Current alias')
    .argument('<new-alias>', 'New alias')
    .description('Rename an identity')
    .action(async (oldAlias, newAlias) => {
      const spinner = ora(`Renaming identity '${oldAlias}' to '${newAlias}'...`).start();
      
      try {
        await services.identityService.rename(oldAlias, newAlias);
        spinner.succeed(chalk.green(`Identity renamed: ${oldAlias} → ${newAlias}`));
      } catch (error: any) {
        spinner.fail(chalk.red('Failed to rename identity'));
        throw error;
      }
    });

  identity
    .command('update')
    .argument('<alias>', 'Identity alias')
    .option('-n, --name <name>', 'Update git user name')
    .option('-e, --email <email>', 'Update git user email')
    .option('--tag <tags...>', 'Update tags')
    .option('--team <team>', 'Update team')
    .option('--project <project>', 'Update project')
    .option('--activate', 'Activate identity')
    .option('--deactivate', 'Deactivate identity')
    .description('Update identity metadata')
    .action(async (alias, options) => {
      try {
        const updates: any = {};
        
        if (options.name) updates.gitUserName = options.name;
        if (options.email) updates.gitUserEmail = options.email;
        if (options.activate) updates.isActive = true;
        if (options.deactivate) updates.isActive = false;
        
        if (options.tag || options.team || options.project) {
          updates.metadata = {};
          if (options.tag) updates.metadata.tags = options.tag;
          if (options.team) updates.metadata.team = options.team;
          if (options.project) updates.metadata.project = options.project;
        }

        const spinner = ora(`Updating identity '${alias}'...`).start();
        await services.identityService.update(alias, updates);
        spinner.succeed(chalk.green(`Identity '${alias}' updated`));
      } catch (error: any) {
        console.error(chalk.red(`Failed to update identity: ${error.message}`));
        process.exit(1);
      }
    });

  identity
    .command('rotate')
    .argument('<alias>', 'Identity alias')
    .option('-p, --passphrase', 'Use new passphrase')
    .description('Rotate SSH keys for an identity')
    .action(async (alias, options) => {
      try {
        const shouldRotate = await confirm({
          message: `Rotate keys for identity '${alias}'? The old keys will be backed up.`,
          default: false
        });

        if (!shouldRotate) {
          console.log(chalk.yellow('Cancelled'));
          return;
        }

        let passphrase: string | undefined;
        if (options.passphrase) {
          passphrase = await password({
            message: 'Enter new passphrase:',
            mask: '*'
          });
        }

        const spinner = ora(`Rotating keys for '${alias}'...`).start();
        const identity = await services.identityService.rotateKey(alias, passphrase);
        spinner.succeed(chalk.green('Keys rotated successfully'));
        
        console.log('\n' + chalk.bold('New Public Key:'));
        const publicKey = await services.identityService.getPublicKey(alias);
        console.log(chalk.cyan(publicKey.trim()));
        
        console.log('\n' + chalk.yellow('Remember to update this key on your Git provider'));
        if (identity.publicKeyFingerprint) {
          console.log(chalk.dim(`New Fingerprint: ${identity.publicKeyFingerprint}`));
        }
      } catch (error: any) {
        console.error(chalk.red(`Failed to rotate keys: ${error.message}`));
        process.exit(1);
      }
    });
}