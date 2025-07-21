import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { createSpinner } from 'nanospinner';
import { ApiGatewayManager } from '../services/api-gateway-manager';
import { RoleDiscoveryService } from '../services/role-discovery';
import { ConfigManager } from '../services/config-manager';
import { ProgressBar } from '../utils/progress-bar';
import { awsRateLimiter } from '../utils/aws-rate-limiter';

export interface BulkDeleteOptions {
  pattern?: string;
  name?: string;
  regions?: string | string[];
  accounts?: string[];
  rolePattern?: string;
  externalId?: string;
  parallel?: boolean;
  force?: boolean;
  dryRun?: boolean;
  mode?: 'discovery' | 'configured';
  accountAliases?: string | string[];
  maxRetries?: number;
  retryDelay?: number;
  maxRetryDelay?: number;
}

export const bulkDeleteCommand = new Command('bulk-delete')
  .description('Delete multiple API Gateways created in bulk operations')
  .option('-p, --pattern <pattern>', 'Pattern to match API Gateway names (e.g., "my-api-*")')
  .option('-n, --name <name>', 'Base name of API Gateways to delete (e.g., "my-api")')
  .option('-r, --regions <regions>', 'Comma-separated list of AWS regions to search')
  .option('-a, --accounts <accounts>', 'Comma-separated list of AWS account IDs to search')
  .option('--role-pattern <pattern>', 'Pattern to match role names for discovery')
  .option('-e, --external-id <id>', 'External ID for role assumption')
  .option('--parallel', 'Delete API Gateways in parallel (faster but more resource intensive)')
  .option('-f, --force', 'Skip confirmation prompts')
  .option('--dry-run', 'Show what would be deleted without actually deleting')
  .option('-m, --mode <mode>', 'Mode: "discovery" (find roles by pattern) or "configured" (use pre-configured accounts)')
  .option('--account-aliases <aliases>', 'Comma-separated list of configured account aliases to use (for configured mode)')
  .option('--max-retries <number>', 'Maximum number of retries for failed operations (default: 5)')
  .option('--retry-delay <number>', 'Base delay in milliseconds for retries (default: 1000)')
  .option('--max-retry-delay <number>', 'Maximum delay in milliseconds for retries (default: 30000)')
  .action(async (options: BulkDeleteOptions) => {
    try {
      console.log(chalk.blue('🗑️  Bulk API Gateway Deletion'));
      console.log(chalk.blue('============================\n'));

      // Interactive prompts for missing options
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'deleteMode',
          message: 'How would you like to select API Gateways to delete?',
          choices: [
            { name: 'Pattern matching (e.g., "my-api-*")', value: 'pattern' },
            { name: 'Base name matching (e.g., "my-api")', value: 'name' },
            { name: 'Interactive selection', value: 'interactive' }
          ]
        },
        {
          type: 'input',
          name: 'pattern',
          message: 'Enter glob pattern to match API Gateway names:',
          when: (answers) => answers.deleteMode === 'pattern',
          validate: (input: string) => {
            if (!input.trim()) return 'Pattern cannot be empty';
            return true;
          }
        },
        {
          type: 'input',
          name: 'name',
          message: 'Enter base name for API Gateways:',
          when: (answers) => answers.deleteMode === 'name',
          validate: (input: string) => {
            if (!input.trim()) return 'Name cannot be empty';
            return true;
          }
        },
        {
          type: 'checkbox',
          name: 'regions',
          message: 'Select AWS regions to search:',
          choices: [
            { name: 'us-east-1 (N. Virginia)', value: 'us-east-1' },
            { name: 'us-east-2 (Ohio)', value: 'us-east-2' },
            { name: 'us-west-1 (N. California)', value: 'us-west-1' },
            { name: 'us-west-2 (Oregon)', value: 'us-west-2' },
            { name: 'eu-west-1 (Ireland)', value: 'eu-west-1' },
            { name: 'eu-central-1 (Frankfurt)', value: 'eu-central-1' },
            { name: 'ap-southeast-1 (Singapore)', value: 'ap-southeast-1' },
            { name: 'ap-northeast-1 (Tokyo)', value: 'ap-northeast-1' }
          ],
          default: ['us-east-1', 'us-west-2']
        },
        {
          type: 'list',
          name: 'mode',
          message: 'How would you like to access AWS accounts?',
          choices: [
            { name: 'Discover assumable roles in current account', value: 'discovery' },
            { name: 'Use configured accounts', value: 'configured' }
          ]
        },
        {
          type: 'input',
          name: 'rolePattern',
          message: 'Enter role name pattern to search for (e.g., "ApiGatewayRole*"):',
          when: (answers) => answers.mode === 'discovery',
          default: 'ApiGatewayRole*'
        },
        {
          type: 'input',
          name: 'externalId',
          message: 'External ID (optional, for enhanced security):',
          when: (answers) => answers.mode === 'discovery'
        },
        {
          type: 'confirm',
          name: 'parallel',
          message: 'Delete API Gateways in parallel? (faster but may hit rate limits)',
          default: false
        },
        {
          type: 'confirm',
          name: 'force',
          message: 'Skip confirmation and delete immediately?',
          default: false
        },
        {
          type: 'confirm',
          name: 'dryRun',
          message: 'Dry run (show what would be deleted without actually deleting)?',
          default: true
        },
        {
          type: 'number',
          name: 'maxRetries',
          message: 'Maximum number of retries for failed operations (adaptive system will use 10 for deletes):',
          default: 10,
          validate: (input: number) => {
            if (input < 1 || input > 20) return 'Retries must be between 1 and 20';
            return true;
          }
        },
        {
          type: 'number',
          name: 'retryDelay',
          message: 'Base delay in milliseconds for retries (adaptive system will adjust based on rate limits):',
          default: 3000,
          validate: (input: number) => {
            if (input < 100 || input > 10000) return 'Delay must be between 100 and 10000ms';
            return true;
          }
        },
        {
          type: 'number',
          name: 'maxRetryDelay',
          message: 'Maximum delay in milliseconds for retries (adaptive system will use 120000ms for deletes):',
          default: 120000,
          validate: (input: number) => {
            if (input < 1000 || input > 600000) return 'Max delay must be between 1000 and 600000ms';
            return true;
          }
        }
      ]);

      const finalOptions = {
        pattern: options.pattern || answers.pattern,
        name: options.name || answers.name,
        regions: options.regions ? (typeof options.regions === 'string' ? options.regions.split(',') : options.regions) : answers.regions,
        accounts: options.accounts,
        rolePattern: options.rolePattern || answers.rolePattern,
        externalId: options.externalId || answers.externalId,
        parallel: options.parallel !== undefined ? options.parallel : answers.parallel,
        force: options.force || false,
        dryRun: options.dryRun !== undefined ? options.dryRun : answers.dryRun,
        mode: options.mode || answers.mode || 'discovery',
        maxRetries: options.maxRetries || answers.maxRetries || 5,
        retryDelay: options.retryDelay || answers.retryDelay || 1000,
        maxRetryDelay: options.maxRetryDelay || answers.maxRetryDelay || 30000
      };

      console.log(chalk.blue(`Mode: ${finalOptions.mode}`));

      let discoveredRoles: any[] = [];
      let tempConfig: any = { accounts: {} };

      if (finalOptions.mode === 'discovery') {
        // Role discovery mode
        console.log(chalk.blue('\n🔍 Role Discovery Mode'));
        
        // Discover roles for API listing
        const spinner = createSpinner('Discovering assumable roles...').start();
        const roleDiscovery = new RoleDiscoveryService();
        
        discoveredRoles = await roleDiscovery.discoverRolesInCurrentAccount({
          roleNamePattern: finalOptions.rolePattern,
          maxRoles: 50
        });

        if (discoveredRoles.length === 0) {
          spinner.error({ text: 'No assumable roles found matching the pattern' });
          console.log(chalk.yellow('Try a different role pattern or ensure your credentials have IAM read permissions'));
          return;
        }

        spinner.success({ text: `Found ${discoveredRoles.length} assumable roles` });

        // Create temporary config for API listing
        const uniqueAccountIds = [...new Set(discoveredRoles.map(role => role.accountId))];
        for (const accountId of uniqueAccountIds) {
          const accountRole = discoveredRoles.find(role => role.accountId === accountId);
          if (accountRole) {
            tempConfig.accounts[accountId] = {
              accountId,
              roleArn: accountRole.roleArn,
              externalId: finalOptions.externalId,
              sessionName: 'api-spawner-bulk-delete-session'
            };
          }
        }

      } else {
        // Configured accounts mode
        console.log(chalk.blue('\n⚙️  Configured Accounts Mode'));
        
        const configManager = new ConfigManager();
        const config = await configManager.loadConfig();
        
        if (!config.accounts || Object.keys(config.accounts).length === 0) {
          console.log(chalk.red('No configured accounts found. Please run "configure" command first.'));
          return;
        }

        // Get account aliases to use
        let accountAliases: string[];
        if (options.accountAliases) {
          accountAliases = Array.isArray(options.accountAliases) ? options.accountAliases : options.accountAliases.split(',');
        } else {
          const aliasAnswers = await inquirer.prompt([
            {
              type: 'checkbox',
              name: 'selectedAliases',
              message: 'Select configured accounts to search:',
              choices: Object.keys(config.accounts).map(alias => ({
                name: `${alias} (${config.accounts![alias].accountId})`,
                value: alias
              })),
              validate: (input: string[]) => {
                if (input.length === 0) return 'Please select at least one account';
                return true;
              }
            }
          ]);
          accountAliases = aliasAnswers.selectedAliases;
        }

        // Validate selected aliases
        const invalidAliases = accountAliases.filter(alias => !config.accounts![alias]);
        if (invalidAliases.length > 0) {
          console.log(chalk.red(`Invalid account aliases: ${invalidAliases.join(', ')}`));
          return;
        }

        console.log(chalk.green(`\nUsing ${accountAliases.length} configured accounts: ${accountAliases.join(', ')}`));

        // Create temporary config for API listing
        for (const alias of accountAliases) {
          const accountConfig = config.accounts![alias];
          tempConfig.accounts[accountConfig.accountId] = {
            accountId: accountConfig.accountId,
            roleArn: accountConfig.roleArn,
            externalId: finalOptions.externalId || accountConfig.externalId,
            sessionName: 'api-spawner-bulk-delete-session'
          };
        }

        // Create discovered roles array for compatibility with existing code
        discoveredRoles = accountAliases.map(alias => {
          const accountConfig = config.accounts![alias];
          return {
            accountId: accountConfig.accountId,
            roleArn: accountConfig.roleArn,
            externalId: finalOptions.externalId || accountConfig.externalId
          };
        });
      }

      // List all API Gateways
      const listSpinner = createSpinner('Fetching API Gateways...').start();

      const apiManager = new ApiGatewayManager(tempConfig);
      const allApis = await apiManager.listApiGateways({
        account: finalOptions.accounts ? finalOptions.accounts.join(',') : undefined,
        region: finalOptions.regions ? finalOptions.regions.join(',') : undefined
      });

      listSpinner.success({ text: `Found ${allApis.length} API Gateways` });

      // Filter API Gateways based on selection criteria
      let apisToDelete = allApis;

      if (finalOptions.pattern) {
        // Convert glob pattern to regex
        const regexPattern = finalOptions.pattern
          .replace(/\./g, '\\.')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.');
        const regex = new RegExp(regexPattern, 'i');
        apisToDelete = allApis.filter(api => regex.test(api.name));
      } else if (finalOptions.name) {
        // Filter by base name
        apisToDelete = allApis.filter(api => api.name.startsWith(finalOptions.name));
      } else if (answers.deleteMode === 'interactive') {
        // Interactive selection
        const choices = allApis.map(api => ({
          name: `${api.name} (${api.account}/${api.region}) - ${api.id}`,
          value: api,
          checked: false
        }));

        const selection = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'selectedApis',
            message: 'Select API Gateways to delete:',
            choices
          }
        ]);

        apisToDelete = selection.selectedApis;
      }

      if (apisToDelete.length === 0) {
        console.log(chalk.yellow('No API Gateways found matching the criteria'));
        return;
      }

      // Group API Gateways for better display
      const groupedApis = apisToDelete.reduce((acc, api) => {
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
      }, {} as Record<string, { account: string; region: string; apis: any[] }>);

      console.log(chalk.blue(`\n📋 API Gateways to ${finalOptions.dryRun ? 'delete (DRY RUN)' : 'delete'}:`));
      Object.values(groupedApis).forEach(group => {
        console.log(chalk.blue(`\n${group.account} (${group.region})`));
        console.log(chalk.blue('─'.repeat(50)));
        
        group.apis.forEach(api => {
          console.log(chalk.red(`  ${api.name}`));
          console.log(chalk.gray(`    ID: ${api.id}`));
          console.log(chalk.gray(`    URL: ${api.url}`));
        });
      });

      console.log(chalk.red(`\nTotal: ${apisToDelete.length} API Gateway(s)`));

      // Confirmation
      if (!finalOptions.force && !finalOptions.dryRun) {
        const confirm = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmed',
            message: `Are you sure you want to delete ${apisToDelete.length} API Gateway(s)?`,
            default: false
          }
        ]);

        if (!confirm.confirmed) {
          console.log(chalk.yellow('Deletion cancelled'));
          return;
        }
      }

      if (finalOptions.dryRun) {
        console.log(chalk.green('\n✅ Dry run completed - no API Gateways were deleted'));
        return;
      }

      // Delete API Gateways
      const results: any[] = [];
      const errors: any[] = [];

      // Configure retry options
      const retryOptions = {
        maxRetries: finalOptions.maxRetries,
        baseDelay: finalOptions.retryDelay,
        maxDelay: finalOptions.maxRetryDelay,
        jitter: true
      };

      if (finalOptions.parallel) {
        // Parallel deletion with progress bar and conservative batching
        const progressBar = new ProgressBar(apisToDelete.length, { 
          title: 'Deleting API Gateways (Parallel)',
          hideCursor: true 
        });

        // Process in smaller batches to reduce rate limiting
        const batchSize = 2; // Reduced from 3 to 2 for more conservative approach
        const results: any[] = [];
        const errors: any[] = [];

        for (let i = 0; i < apisToDelete.length; i += batchSize) {
          const batch = apisToDelete.slice(i, i + batchSize);
          
          const batchPromises = batch.map(async (api, batchIndex) => {
            try {
              // Create temporary config for this API
              const tempConfig = {
                accounts: {
                  [api.account]: {
                    accountId: api.account,
                    roleArn: discoveredRoles.find(r => r.accountId === api.account)?.roleArn || '',
                    externalId: finalOptions.externalId,
                    sessionName: 'api-spawner-bulk-delete-session'
                  }
                }
              };

              const apiManager = new ApiGatewayManager(tempConfig);
              await apiManager.deleteApiGatewayDirect(api, { 
                retryOptions: {
                  ...retryOptions,
                  onRetry: (attempt, error, delay) => {
                    const retryAfter = error.$metadata?.httpHeaders?.['retry-after'] || 
                                      error.$metadata?.httpHeaders?.['Retry-After'];
                    const delayInfo = retryAfter ? `Retry-After: ${Math.round(parseInt(retryAfter) * 1000 / 1000)}s` : `Backoff: ${Math.round(delay / 1000)}s`;
                    progressBar.setStatus(`Retrying delete ${api.name} (attempt ${attempt}/${retryOptions.maxRetries + 1}) - ${delayInfo}`);
                  }
                }
              });

              progressBar.increment(`Deleted ${api.name}`);
              return { success: true, api };
            } catch (error) {
              progressBar.increment(`Failed ${api.name}`);
              return { success: false, error, api };
            }
          });

          const batchResults = await Promise.all(batchPromises);
          
          batchResults.forEach(result => {
            if (result.success) {
              results.push(result.api);
            } else {
              errors.push(result);
            }
          });

          // Add longer delay between batches for delete operations
          if (i + batchSize < apisToDelete.length) {
            const adaptiveDelay = awsRateLimiter.getOperationDelay('delete');
            await new Promise(resolve => setTimeout(resolve, adaptiveDelay));
          }
        }

        progressBar.complete(`Deleted ${results.length} API Gateways successfully`);
      } else {
        // Sequential deletion with progress bar
        const progressBar = new ProgressBar(apisToDelete.length, { 
          title: 'Deleting API Gateways (Sequential)',
          hideCursor: true 
        });

        for (const api of apisToDelete) {
          try {
            // Create temporary config for this API
            const tempConfig = {
              accounts: {
                [api.account]: {
                  accountId: api.account,
                  roleArn: discoveredRoles.find(r => r.accountId === api.account)?.roleArn || '',
                  externalId: finalOptions.externalId,
                  sessionName: 'api-spawner-bulk-delete-session'
                }
              }
            };

            const apiManager = new ApiGatewayManager(tempConfig);
            await apiManager.deleteApiGatewayDirect(api, { 
              retryOptions: {
                ...retryOptions,
                onRetry: (attempt, error, delay) => {
                  const retryAfter = error.$metadata?.httpHeaders?.['retry-after'] || 
                                    error.$metadata?.httpHeaders?.['Retry-After'];
                  const delayInfo = retryAfter ? `Retry-After: ${Math.round(parseInt(retryAfter) * 1000 / 1000)}s` : `Backoff: ${Math.round(delay / 1000)}s`;
                  progressBar.setStatus(`Retrying delete ${api.name} (attempt ${attempt}/${retryOptions.maxRetries + 1}) - ${delayInfo}`);
                }
              }
            });

            progressBar.increment(`Deleted ${api.name}`);
            results.push(api);
          } catch (error) {
            progressBar.increment(`Failed ${api.name}`);
            errors.push({ error, api });
          }

          // Add adaptive delay between sequential operations
          const adaptiveDelay = awsRateLimiter.getOperationDelay('delete');
          await new Promise(resolve => setTimeout(resolve, adaptiveDelay));
        }

        progressBar.complete(`Deleted ${results.length} API Gateways successfully`);
      }

      // Display results
      console.log(chalk.green(`\n✅ Successfully deleted ${results.length} API Gateway(s)`));
      
      if (errors.length > 0) {
        console.log(chalk.red(`\n❌ Failed to delete ${errors.length} API Gateway(s):`));
        errors.forEach(({ error, api }) => {
          console.log(chalk.red(`  • ${api.name} (${api.account}/${api.region}): ${error.message}`));
        });
      }

      // Display rate limit statistics
      const stats = awsRateLimiter.getStats();
      if (stats.totalRateLimits > 0) {
        console.log(chalk.yellow(`\n📊 Rate Limit Statistics:`));
        console.log(chalk.yellow(`  • Total rate limits hit: ${stats.totalRateLimits}`));
        console.log(chalk.yellow(`  • Average suggested delay: ${Math.round(stats.averageDelay / 1000)}s`));
      }

      // Reset rate limit history for next operation
      awsRateLimiter.resetHistory();

    } catch (error) {
      console.error(chalk.red('Error in bulk deletion:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }); 