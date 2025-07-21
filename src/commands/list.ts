import { Command } from 'commander';
import chalk from 'chalk';
import { createSpinner } from 'nanospinner';
import { ApiGatewayManager, ApiGatewayInfo } from '../services/api-gateway-manager';
import { ConfigManager } from '../services/config-manager';
import { ProgressBar } from '../utils/progress-bar';

export const listApiCommand = new Command('list')
  .description('List all API Gateways across accounts and regions')
  .option('-a, --account <account>', 'Filter by AWS account alias')
  .option('-r, --region <region>', 'Filter by AWS region')
  .action(async (options: { account?: string; region?: string }) => {
    try {
      const configManager = new ConfigManager();
      const config = await configManager.loadConfig();

      if (!config.accounts || Object.keys(config.accounts).length === 0) {
        console.log(chalk.yellow('No accounts configured. Please run "api-spawner configure" first.'));
        return;
      }

      const apiManager = new ApiGatewayManager(config);
      let apis: ApiGatewayInfo[] = [];

      // Show progress bar only when fetching from multiple regions/accounts
      const shouldShowProgress = !options.region && !options.account;
      
      if (shouldShowProgress) {
        const totalAccounts = Object.keys(config.accounts).length;
        const totalRegions = 8; // Default regions
        const totalOperations = totalAccounts * totalRegions;
        
        const progressBar = new ProgressBar(totalOperations, { 
          title: 'Fetching API Gateways',
          hideCursor: true 
        });

        let completedOperations = 0;

        // Override the listApiGateways method to track progress
        const originalListApiGateways = apiManager.listApiGateways.bind(apiManager);
        apiManager.listApiGateways = async (listOptions) => {
          const result = await originalListApiGateways(listOptions);
          completedOperations += totalRegions; // Approximate progress
          progressBar.update(completedOperations, `Found ${result.length} API Gateways`);
          return result;
        };

        apis = await apiManager.listApiGateways(options);
        progressBar.complete(`Found ${apis.length} API Gateways`);
      } else {
        const spinner = createSpinner('Fetching API Gateways...').start();
        apis = await apiManager.listApiGateways(options);
        spinner.success({ text: `Found ${apis.length} API Gateway(s)` });
      }

      if (apis.length === 0) {
        console.log(chalk.yellow('No API Gateways found.'));
        return;
      }

      // Group by account and region
      const grouped = apis.reduce((acc, api) => {
        const key = `${api.account}-${api.region}`;
        if (!acc[key]) {
          acc[key] = {
            account: api.account,
            region: api.region,
            apis: []
          };
        }
        acc[key].apis.push(api);
        return acc;
      }, {} as Record<string, { account: string; region: string; apis: ApiGatewayInfo[] }>);

      Object.values(grouped).forEach((group: { account: string; region: string; apis: ApiGatewayInfo[] }) => {
        console.log(chalk.blue(`\n${group.account} (${group.region})`));
        console.log(chalk.blue('─'.repeat(50)));
        
        group.apis.forEach((api: ApiGatewayInfo) => {
          console.log(chalk.green(`  ${api.name}`));
          console.log(chalk.gray(`    ID: ${api.id}`));
          console.log(chalk.gray(`    URL: ${api.url}`));
          console.log(chalk.gray(`    Created: ${new Date(api.createdDate).toLocaleDateString()}`));
          console.log('');
        });
      });

    } catch (error) {
      console.error(chalk.red('Error listing API Gateways:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }); 