import type { Command } from 'commander';
import { select, input } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import type { Services } from './index.js';

export function registerGitCommands(program: Command, services: Services): void {
  program
    .command('use')
    .argument('<alias>', 'Identity alias to use')
    .option('-r, --remote <remote>', 'Git remote name', 'origin')
    .description('Switch current repository to use specified identity')
    .action(async (alias, options) => {
      const spinner = ora('Switching identity...').start();
      
      try {
        await services.git.useIdentity(alias, options.remote);
        const identity = services.identityService.get(alias);
        
        spinner.succeed(chalk.green(`Switched to identity '${alias}'`));
        
        if (identity.gitUserName || identity.gitUserEmail) {
          console.log(chalk.dim('Git config updated:'));
          if (identity.gitUserName) {
            console.log(chalk.dim(`  Name: ${identity.gitUserName}`));
          }
          if (identity.gitUserEmail) {
            console.log(chalk.dim(`  Email: ${identity.gitUserEmail}`));
          }
        }
      } catch (error: any) {
        spinner.fail(chalk.red('Failed to switch identity'));
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  program
    .command('current')
    .option('-r, --remote <remote>', 'Git remote name', 'origin')
    .description('Show current identity in use')
    .action(async (options) => {
      try {
        const currentAlias = await services.git.getCurrentIdentity(options.remote);
        
        if (currentAlias) {
          const identity = services.identityService.get(currentAlias);
          console.log(chalk.bold(`Current identity: ${chalk.cyan(currentAlias)}`));
          console.log(chalk.dim(`Host: ${identity.hostName}`));
          
          const gitConfig = services.git.getGitConfig();
          if (gitConfig.name || gitConfig.email) {
            console.log(chalk.dim('\nGit config:'));
            if (gitConfig.name) console.log(chalk.dim(`  Name: ${gitConfig.name}`));
            if (gitConfig.email) console.log(chalk.dim(`  Email: ${gitConfig.email}`));
          }
        } else {
          console.log(chalk.yellow('No gitid identity in use'));
          
          const url = services.git.getRemoteUrl(options.remote);
          const parsed = services.git.parseRemote(url);
          
          if (parsed.type === 'ssh') {
            console.log(chalk.dim(`Using SSH with host: ${parsed.host}`));
          } else if (parsed.type === 'https') {
            console.log(chalk.dim(`Using HTTPS with host: ${parsed.host}`));
          }
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  program
    .command('clone')
    .argument('<alias>', 'Identity alias to use')
    .argument('<repository>', 'Repository URL or shorthand (owner/repo)')
    .argument('[directory]', 'Destination directory')
    .option('-b, --branch <branch>', 'Clone specific branch')
    .option('-d, --depth <depth>', 'Create shallow clone with history depth')
    .option('--recursive', 'Clone submodules recursively')
    .description('Clone a repository using specified identity')
    .action(async (alias, repository, directory, options) => {
      const spinner = ora('Cloning repository...').start();
      
      try {
        await services.git.clone({
          alias,
          repository,
          directory,
          branch: options.branch,
          depth: options.depth ? parseInt(options.depth) : undefined,
          recursive: options.recursive
        });
        
        spinner.succeed(chalk.green('Repository cloned successfully'));
        
        const identity = services.identityService.get(alias);
        if (identity.gitUserName || identity.gitUserEmail) {
          console.log(chalk.dim('Git config applied:'));
          if (identity.gitUserName) {
            console.log(chalk.dim(`  Name: ${identity.gitUserName}`));
          }
          if (identity.gitUserEmail) {
            console.log(chalk.dim(`  Email: ${identity.gitUserEmail}`));
          }
        }
      } catch (error: any) {
        spinner.fail(chalk.red('Clone failed'));
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  program
    .command('apply')
    .argument('<alias>', 'Identity alias')
    .description('Apply identity git config to current repository')
    .action(async (alias) => {
      try {
        services.git.applyIdentityConfig(alias);
        
        const identity = services.identityService.get(alias);
        console.log(chalk.green('Git config applied:'));
        if (identity.gitUserName) {
          console.log(`  Name: ${identity.gitUserName}`);
        }
        if (identity.gitUserEmail) {
          console.log(`  Email: ${identity.gitUserEmail}`);
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  program
    .command('status')
    .description('Show repository and identity status')
    .action(async () => {
      try {
        if (!services.git.isGitRepository()) {
          console.log(chalk.yellow('Not in a git repository'));
          return;
        }

        const branch = services.git.getBranch();
        const hasChanges = services.git.hasUncommittedChanges();
        const lastCommit = services.git.getLastCommit();
        const currentIdentity = await services.git.getCurrentIdentity();
        const gitConfig = services.git.getGitConfig();

        console.log(chalk.bold('Repository Status:'));
        console.log(chalk.dim('─'.repeat(50)));
        console.log(`Branch: ${chalk.cyan(branch)}`);
        console.log(`Changes: ${hasChanges ? chalk.yellow('Uncommitted changes') : chalk.green('Clean')}`);
        
        if (lastCommit) {
          console.log(`Last commit: ${chalk.dim(lastCommit.hash.substring(0, 7))} - ${lastCommit.message}`);
          console.log(`  by ${lastCommit.author} on ${new Date(lastCommit.date).toLocaleDateString()}`);
        }

        console.log('\n' + chalk.bold('Identity Status:'));
        console.log(chalk.dim('─'.repeat(50)));
        
        if (currentIdentity) {
          const identity = services.identityService.get(currentIdentity);
          console.log(`Active identity: ${chalk.cyan(currentIdentity)}`);
          console.log(`Host: ${identity.hostName}`);
        } else {
          console.log(chalk.yellow('No gitid identity active'));
        }

        if (gitConfig.name || gitConfig.email) {
          console.log('\n' + chalk.bold('Git Config:'));
          if (gitConfig.name) console.log(`Name: ${gitConfig.name}`);
          if (gitConfig.email) console.log(`Email: ${gitConfig.email}`);
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  program
    .command('switch')
    .description('Interactive identity switcher')
    .action(async () => {
      try {
        if (!services.git.isGitRepository()) {
          console.log(chalk.yellow('Not in a git repository'));
          process.exit(1);
        }

        const identities = services.identityService.getAll();
        
        if (identities.length === 0) {
          console.log(chalk.yellow('No identities available'));
          process.exit(1);
        }

        const currentIdentity = await services.git.getCurrentIdentity();
        
        const choices = identities.map(id => ({
          name: `${id.alias} (${id.hostName})${id.alias === currentIdentity ? ' [current]' : ''}`,
          value: id.alias,
          description: id.gitUserEmail
        }));

        const selected = await select({
          message: 'Select identity to use:',
          choices
        });

        if (selected === currentIdentity) {
          console.log(chalk.yellow('Already using this identity'));
          return;
        }

        const spinner = ora('Switching identity...').start();
        await services.git.useIdentity(selected);
        spinner.succeed(chalk.green(`Switched to identity '${selected}'`));
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });
}