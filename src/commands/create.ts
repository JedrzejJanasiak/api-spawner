import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { createSpinner } from 'nanospinner';
import { ApiGatewayManager } from '../services/api-gateway-manager';
import { ConfigManager } from '../services/config-manager';

export const createApiCommand = new Command('create')
  .description('Create a new API Gateway')
  .option('-n, --name <name>', 'API Gateway name')
  .option('-r, --region <region>', 'AWS region')
  .option('-a, --account <account>', 'AWS account alias')
  .option('-d, --description <description>', 'API Gateway description')
  .action(async (options) => {
    try {
      const configManager = new ConfigManager();
      const config = await configManager.loadConfig();

      if (!config.accounts || Object.keys(config.accounts).length === 0) {
        console.log(chalk.yellow('No accounts configured. Please run "api-spawner configure" first.'));
        return;
      }

      // Interactive prompts for missing options
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'account',
          message: 'Select AWS account:',
          choices: Object.keys(config.accounts),
          when: !options.account
        },
        {
          type: 'list',
          name: 'region',
          message: 'Select AWS region:',
          choices: [
            'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
            'eu-west-1', 'eu-central-1', 'ap-southeast-1', 'ap-northeast-1'
          ],
          when: !options.region
        },
        {
          type: 'input',
          name: 'name',
          message: 'Enter API Gateway name:',
          validate: (input: string) => {
            if (!input.trim()) return 'Name is required';
            if (input.length < 3) return 'Name must be at least 3 characters';
            return true;
          },
          when: !options.name
        },
        {
          type: 'input',
          name: 'description',
          message: 'Enter API Gateway description (optional):',
          when: !options.description
        }
      ]);

      const finalOptions = {
        name: options.name || answers.name,
        region: options.region || answers.region,
        account: options.account || answers.account,
        description: options.description || answers.description || ''
      };

      const spinner = createSpinner('Creating API Gateway...').start();

      const apiManager = new ApiGatewayManager(config);
      const result = await apiManager.createApiGateway(finalOptions);

      spinner.success({ text: `API Gateway "${finalOptions.name}" created successfully!` });
      
      console.log(chalk.green('\nAPI Gateway Details:'));
      console.log(chalk.cyan(`  Name: ${result.name}`));
      console.log(chalk.cyan(`  ID: ${result.id}`));
      console.log(chalk.cyan(`  Region: ${finalOptions.region}`));
      console.log(chalk.cyan(`  Account: ${finalOptions.account}`));
      console.log(chalk.cyan(`  URL: ${result.url}`));
    } catch (error) {
      console.error(chalk.red('Error creating API Gateway:'), error);
    }
  });