import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager } from '../services/config-manager';

export const listAccountsCommand = new Command('list-accounts')
  .description('List configured AWS accounts')
  .action(async () => {
    try {
      const configManager = new ConfigManager();
      const config = await configManager.loadConfig();

      if (!config.accounts || Object.keys(config.accounts).length === 0) {
        console.log(chalk.yellow('No configured accounts found.'));
        console.log(chalk.cyan('Run "configure" command to add accounts.'));
        return;
      }

      console.log(chalk.blue('📋 Configured AWS Accounts'));
      console.log(chalk.blue('==========================\n'));

      const accounts = Object.entries(config.accounts);
      
      accounts.forEach(([alias, accountConfig], index) => {
        console.log(chalk.green(`${index + 1}. ${alias}`));
        console.log(chalk.cyan(`   Account ID: ${accountConfig.accountId}`));
        console.log(chalk.cyan(`   Role ARN: ${accountConfig.roleArn}`));
        if (accountConfig.externalId) {
          console.log(chalk.cyan(`   External ID: ${accountConfig.externalId}`));
        }
        console.log(chalk.cyan(`   Session Name: ${accountConfig.sessionName}`));
        console.log('');
      });

      console.log(chalk.blue(`Total: ${accounts.length} account(s) configured`));
      console.log(chalk.gray('\nUse these aliases with the --account-aliases option in bulk-create command'));

    } catch (error) {
      console.error(chalk.red('Error listing accounts:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }); 