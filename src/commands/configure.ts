import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { ConfigManager } from '../services/config-manager';

export const configureCommand = new Command('configure')
  .description('Configure AWS accounts for API Gateway management')
  .action(async () => {
    try {
      const configManager = new ConfigManager();
      const config = await configManager.loadConfig();

      let addMore = true;
      while (addMore) {
        console.log(chalk.blue('AWS Account Configuration'));
        console.log(chalk.blue('=======================\n'));

        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'alias',
            message: 'Enter account alias (e.g., prod, staging, dev):',
            validate: (input: string) => {
              if (!input.trim()) return 'Alias is required';
              if (input.length < 2) return 'Alias must be at least 2 characters';
              return true;
            }
          },
          {
            type: 'input',
            name: 'accountId',
            message: 'Enter AWS Account ID:',
            validate: (input: string) => {
              if (!input.trim()) return 'Account ID is required';
              if (!/^\d{12}$/.test(input)) return 'Account ID must be 12 digits';
              return true;
            }
          },
          {
            type: 'input',
            name: 'roleArn',
            message: 'Enter IAM Role ARN for AssumeRole:',
            validate: (input: string) => {
              if (!input.trim()) return 'Role ARN is required';
              if (!input.startsWith('arn:aws:iam::')) return 'Invalid Role ARN format';
              return true;
            }
          },
          {
            type: 'input',
            name: 'externalId',
            message: 'Enter External ID (optional):',
            default: ''
          },
          {
            type: 'input',
            name: 'sessionName',
            message: 'Enter session name:',
            default: 'api-spawner-session'
          }
        ]);

        // Add or update account configuration
        if (!config.accounts) {
          config.accounts = {};
        }

        config.accounts[answers.alias] = {
          accountId: answers.accountId,
          roleArn: answers.roleArn,
          externalId: answers.externalId || undefined,
          sessionName: answers.sessionName
        };

        await configManager.saveConfig(config);

        console.log(chalk.green(`\nAccount "${answers.alias}" configured successfully!`));
        console.log(chalk.cyan(`  Account ID: ${answers.accountId}`));
        console.log(chalk.cyan(`  Role ARN: ${answers.roleArn}`));
        if (answers.externalId) {
          console.log(chalk.cyan(`  External ID: ${answers.externalId}`));
        }
        console.log(chalk.cyan(`  Session Name: ${answers.sessionName}`));

        // Ask if user wants to add more accounts
        const addMoreAnswer = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmed',
            message: 'Would you like to add another account?',
            default: false
          }
        ]);
        addMore = addMoreAnswer.confirmed;
      }
    } catch (error) {
      console.error(chalk.red('Error configuring account:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }); 