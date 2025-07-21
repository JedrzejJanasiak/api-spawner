import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { createSpinner } from 'nanospinner';
import { ApiGatewayManager } from '../services/api-gateway-manager';
import { RoleDiscoveryService } from '../services/role-discovery';
import { ConfigManager } from '../services/config-manager';
import { ProgressBar } from '../utils/progress-bar';

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
  .action(async (options: BulkDeleteOptions) => {
    try {
      console.log(chalk.blue('🗑️  Bulk API Gateway Deletion'));
      console.log(chalk.blue('============================\n'));

      // Interactive prompts for missing options
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'mode',
          message: 'Select deployment mode:',
          choices: [
            { name: 'Role Discovery Mode - Find assumable roles by pattern', value: 'discovery' },
            { name: 'Configured Accounts Mode - Use pre-configured accounts', value: 'configured' }
          ],
          when: !options.mode
        },
        {
          type: 'list',
          name: 'deleteMode',
          message: 'How would you like to select API Gateways for deletion?',
          choices: [
            { name: 'By name pattern (e.g., "my-api-*")', value: 'pattern' },
            { name: 'By base name (e.g., "my-api")', value: 'name' },
            { name: 'Interactive selection from all API Gateways', value: 'interactive' }
          ],
          when: !options.pattern && !options.name
        },
        {
          type: 'input',
          name: 'pattern',
          message: 'Enter pattern to match API Gateway names (e.g., "my-api-*", "test-api-123456789012-*"):',
          when: (answers) => answers.deleteMode === 'pattern' && !options.pattern
        },
        {
          type: 'input',
          name: 'name',
          message: 'Enter base name of APIs to delete (e.g., "my-api"):',
          when: (answers) => answers.deleteMode === 'name' && !options.name
        },
        {
          type: 'checkbox',
          name: 'regions',
          message: 'Select AWS regions to search (leave empty for all):',
          choices: [
            { name: 'US East (N. Virginia) - us-east-1', value: 'us-east-1' },
            { name: 'US East (Ohio) - us-east-2', value: 'us-east-2' },
            { name: 'US West (N. California) - us-west-1', value: 'us-west-1' },
            { name: 'US West (Oregon) - us-west-2', value: 'us-west-2' },
            { name: 'Europe (Ireland) - eu-west-1', value: 'eu-west-1' },
            { name: 'Europe (Frankfurt) - eu-central-1', value: 'eu-central-1' },
            { name: 'Asia Pacific (Singapore) - ap-southeast-1', value: 'ap-southeast-1' },
            { name: 'Asia Pacific (Tokyo) - ap-northeast-1', value: 'ap-northeast-1' }
          ],
          when: !options.regions
        },
        {
          type: 'input',
          name: 'rolePattern',
          message: 'Enter role name pattern to match (e.g., "api-deploy"):',
          when: (answers: any) => (!options.rolePattern && (options.mode || answers.mode) === 'discovery')
        },
        {
          type: 'input',
          name: 'externalId',
          message: 'Enter External ID (optional):',
          when: !options.externalId
        },
        {
          type: 'confirm',
          name: 'parallel',
          message: 'Delete API Gateways in parallel? (faster but more resource intensive)',
          default: false,
          when: options.parallel === undefined
        },
        {
          type: 'confirm',
          name: 'dryRun',
          message: 'Dry run mode? (show what would be deleted without actually deleting)',
          default: true,
          when: !options.dryRun && !options.force
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
        mode: options.mode || answers.mode || 'discovery'
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

      if (finalOptions.parallel) {
        // Parallel deletion with progress bar
        const progressBar = new ProgressBar(apisToDelete.length, { 
          title: 'Deleting API Gateways (Parallel)',
          hideCursor: true 
        });

        const promises = apisToDelete.map(async (api, index) => {
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
            await apiManager.deleteApiGateway(api.id);

            progressBar.increment(`Deleted ${api.name}`);
            return { success: true, api };
          } catch (error) {
            progressBar.increment(`Failed ${api.name}`);
            return { success: false, error, api };
          }
        });

        const parallelResults = await Promise.all(promises);
        
        parallelResults.forEach(result => {
          if (result.success) {
            results.push(result.api);
          } else {
            errors.push(result);
          }
        });

        progressBar.complete(`Deleted ${results.length} API Gateways successfully`);
      } else {
        // Sequential deletion with progress bar
        const progressBar = new ProgressBar(apisToDelete.length, { 
          title: 'Deleting API Gateways (Sequential)',
          hideCursor: true 
        });

        for (let i = 0; i < apisToDelete.length; i++) {
          const api = apisToDelete[i];
          progressBar.setStatus(`Deleting ${api.name} (${i + 1}/${apisToDelete.length})`);

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
            await apiManager.deleteApiGateway(api.id);

            results.push(api);
            progressBar.increment(`Deleted ${api.name}`);
          } catch (error) {
            errors.push({ error, api });
            progressBar.increment(`Failed ${api.name}`);
          }
        }

        progressBar.complete(`Deleted ${results.length} API Gateways successfully`);
      }

      // Display results
      if (results.length > 0) {
        console.log(chalk.green('\n✅ Successfully Deleted:'));
        results.forEach(api => {
          console.log(chalk.cyan(`  ${api.name} (${api.account}/${api.region})`));
        });
      }

      if (errors.length > 0) {
        console.log(chalk.red('\n❌ Failed to Delete:'));
        errors.forEach(({ error, api }) => {
          console.log(chalk.red(`  ${api.name} (${api.account}/${api.region}): ${error.message || error}`));
        });
      }

      console.log(chalk.blue(`\nSummary: ${results.length} deleted, ${errors.length} failed`));

    } catch (error) {
      console.error(chalk.red('Error in bulk deletion:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }); 