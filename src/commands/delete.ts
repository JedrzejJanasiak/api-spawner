import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { createSpinner } from 'nanospinner';
import { ApiGatewayManager } from '../services/api-gateway-manager';
import { ConfigManager } from '../services/config-manager';

export const deleteApiCommand = new Command('delete')
  .description('Delete an API Gateway')
  .option('-i, --id <id>', 'API Gateway ID')
  .option('-n, --name <name>', 'API Gateway name')
  .option('-r, --region <region>', 'AWS region')
  .option('-a, --account <account>', 'AWS account alias')
  .option('-f, --force', 'Skip confirmation prompt')
  .action(async (options: { id?: string; name?: string; region?: string; account?: string; force?: boolean }) => {
    try {
      const configManager = new ConfigManager();
      const config = await configManager.loadConfig();

      if (!config.accounts || Object.keys(config.accounts).length === 0) {
        console.log(chalk.yellow('No accounts configured. Please run "api-spawner configure" first.'));
        return;
      }

      const apiManager = new ApiGatewayManager(config);

      // If no ID provided, list available APIs for selection
      if (!options.id) {
        const apis = await apiManager.listApiGateways({
          account: options.account,
          region: options.region
        });

        if (apis.length === 0) {
          console.log(chalk.yellow('No API Gateways found to delete.'));
          return;
        }

        const choices = apis.map(api => ({
          name: `${api.name} (${api.account}/${api.region}) - ${api.id}`,
          value: api
        }));

        const answer = await inquirer.prompt([
          {
            type: 'list',
            name: 'api',
            message: 'Select API Gateway to delete:',
            choices
          }
        ]);

        options.id = answer.api.id;
        options.name = answer.api.name;
        options.region = answer.api.region;
        options.account = answer.api.account;
      }

      // Confirmation prompt
      if (!options.force) {
        const confirm = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmed',
            message: `Are you sure you want to delete API Gateway "${options.name}" (${options.id})?`,
            default: false
          }
        ]);

        if (!confirm.confirmed) {
          console.log(chalk.yellow('Deletion cancelled.'));
          return;
        }
      }

      const spinner = createSpinner('Deleting API Gateway...').start();

      await apiManager.deleteApiGateway(options.id!);

      spinner.success({ text: `API Gateway "${options.name}" deleted successfully!` });

    } catch (error) {
      console.error(chalk.red('Error deleting API Gateway:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }); 