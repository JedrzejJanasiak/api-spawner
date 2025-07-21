import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { createSpinner } from 'nanospinner';
import { ApiGatewayManager } from '../services/api-gateway-manager';
import { RoleDiscoveryService, DiscoveredRole } from '../services/role-discovery';
import { ConfigManager } from '../services/config-manager';
import { ProgressBar } from '../utils/progress-bar';

export interface BulkCreateOptions {
  name?: string;
  description?: string;
  regions?: string | string[];
  accounts?: string[];
  rolePattern?: string;
  externalId?: string;
  parallel?: boolean;
  totalGateways?: number;
  mode?: 'discovery' | 'configured';
  accountAliases?: string | string[];
}

export interface BulkCreateTarget {
  accountId: string;
  roleArn: string;
  region: string;
  externalId?: string;
  gatewayIndex: number;
}

export const bulkCreateCommand = new Command('bulk-create')
  .description('Create multiple API Gateways across accounts and regions in one run')
  .option('-n, --name <name>', 'Base API Gateway name (will be suffixed with account/region)')
  .option('-d, --description <description>', 'API Gateway description')
  .option('-r, --regions <regions>', 'Comma-separated list of AWS regions')
  .option('-a, --accounts <accounts>', 'Comma-separated list of AWS account IDs')
  .option('-p, --role-pattern <pattern>', 'Pattern to match role names (for discovery mode)')
  .option('-e, --external-id <id>', 'External ID for role assumption')
  .option('--parallel', 'Create API Gateways in parallel (faster but more resource intensive)')
  .option('-t, --total-gateways <number>', 'Total number of API Gateways to create across all regions')
  .option('-m, --mode <mode>', 'Mode: "discovery" (find roles by pattern) or "configured" (use pre-configured accounts)')
  .option('--account-aliases <aliases>', 'Comma-separated list of configured account aliases to use (for configured mode)')
  .action(async (options: BulkCreateOptions) => {
    try {
      console.log(chalk.blue('🚀 Bulk API Gateway Creation'));
      console.log(chalk.blue('===========================\n'));

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
          type: 'input',
          name: 'name',
          message: 'Enter base API Gateway name:',
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
        },
        {
          type: 'checkbox',
          name: 'regions',
          message: 'Select AWS regions:',
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
          message: 'Enter role name pattern to match (e.g., "api-deploy", "cross-account"):',
          when: (answers: any) => (!options.rolePattern && (options.mode || answers.mode) === 'discovery')
        },
        {
          type: 'input',
          name: 'externalId',
          message: 'Enter External ID (optional):',
          when: !options.externalId
        },
        {
          type: 'number',
          name: 'totalGateways',
          message: 'Enter total number of API Gateways to create:',
          validate: (input: number) => {
            if (!input || input < 1) return 'Total API Gateways must be at least 1';
            if (input > 1000) return 'Total API Gateways cannot exceed 1,000';
            return true;
          },
          when: !options.totalGateways
        },
        {
          type: 'confirm',
          name: 'parallel',
          message: 'Create API Gateways in parallel? (faster but more resource intensive)',
          default: false,
          when: options.parallel === undefined
        }
      ]);

      const finalOptions = {
        name: options.name || answers.name,
        description: options.description || answers.description || '',
        regions: options.regions ? (typeof options.regions === 'string' ? options.regions.split(',') : options.regions) : answers.regions,
        rolePattern: options.rolePattern || answers.rolePattern,
        externalId: options.externalId || answers.externalId,
        totalGateways: options.totalGateways || answers.totalGateways,
        parallel: options.parallel !== undefined ? options.parallel : answers.parallel,
        mode: options.mode || answers.mode || 'discovery'
      };

      // Calculate distribution
      const totalRegions = finalOptions.regions.length;
      const totalGateways = finalOptions.totalGateways;
      const gatewaysPerRegion = Math.ceil(totalGateways / totalRegions);

      console.log(chalk.blue('\n📊 Distribution Plan:'));
      console.log(chalk.cyan(`  Total API Gateways: ${totalGateways}`));
      console.log(chalk.cyan(`  Regions: ${totalRegions}`));
      console.log(chalk.cyan(`  Gateways per Region: ${gatewaysPerRegion}`));
      console.log(chalk.cyan(`  Mode: ${finalOptions.mode}`));

      let targets: BulkCreateTarget[] = [];

      if (finalOptions.mode === 'discovery') {
        // Role discovery mode
        console.log(chalk.blue('\n🔍 Role Discovery Mode'));
        
        // Discover roles
        const spinner = createSpinner('Discovering assumable roles...').start();
        const roleDiscovery = new RoleDiscoveryService();
        
        const discoveredRoles = await roleDiscovery.discoverRolesInCurrentAccount({
          roleNamePattern: finalOptions.rolePattern,
          maxRoles: 50
        });

        if (discoveredRoles.length === 0) {
          spinner.error({ text: 'No assumable roles found matching the pattern' });
          console.log(chalk.yellow('Try a different role pattern or ensure your credentials have IAM read permissions'));
          return;
        }

        spinner.success({ text: `Found ${discoveredRoles.length} assumable roles` });

        // Filter and test roles
        const testSpinner = createSpinner('Testing role assumptions...').start();
        const testableRoles: DiscoveredRole[] = [];

        for (const role of discoveredRoles) {
          const canAssume = await roleDiscovery.testRoleAssumption(role.roleArn, finalOptions.externalId);
          if (canAssume) {
            testableRoles.push(role);
          }
        }

        testSpinner.success({ text: `Found ${testableRoles.length} testable roles` });

        if (testableRoles.length === 0) {
          console.log(chalk.red('No roles can be assumed with current credentials'));
          return;
        }

        // Create targets for each account/region/gateway combination
        const uniqueAccountIds = [...new Set(testableRoles.map(role => role.accountId))];

        let gatewayIndex = 0;
        for (const accountId of uniqueAccountIds) {
          const accountRoles = testableRoles.filter(role => role.accountId === accountId);
          const primaryRole = accountRoles[0]; // Use first available role for the account

          for (const region of finalOptions.regions) {
            for (let i = 0; i < gatewaysPerRegion && gatewayIndex < totalGateways; i++) {
              targets.push({
                accountId,
                roleArn: primaryRole.roleArn,
                region,
                externalId: finalOptions.externalId,
                gatewayIndex: gatewayIndex
              });
              gatewayIndex++;
            }
            if (gatewayIndex >= totalGateways) break;
          }
          if (gatewayIndex >= totalGateways) break;
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
              message: 'Select configured accounts to use:',
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

        // Create targets for each account/region/gateway combination
        let gatewayIndex = 0;
        for (const alias of accountAliases) {
          const accountConfig = config.accounts![alias];

          for (const region of finalOptions.regions) {
            for (let i = 0; i < gatewaysPerRegion && gatewayIndex < totalGateways; i++) {
              targets.push({
                accountId: accountConfig.accountId,
                roleArn: accountConfig.roleArn,
                region,
                externalId: finalOptions.externalId || accountConfig.externalId,
                gatewayIndex: gatewayIndex
              });
              gatewayIndex++;
            }
            if (gatewayIndex >= totalGateways) break;
          }
          if (gatewayIndex >= totalGateways) break;
        }
      }

      console.log(chalk.green(`\nWill create ${targets.length} API Gateways:`));
      targets.forEach(target => {
        console.log(chalk.cyan(`  - ${finalOptions.name}-${target.accountId}-${target.region}-${target.gatewayIndex} in ${target.accountId}/${target.region}`));
      });

      // Confirmation
      const confirm = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: 'Proceed with bulk creation?',
          default: false
        }
      ]);

      if (!confirm.confirmed) {
        console.log(chalk.yellow('Bulk creation cancelled'));
        return;
      }

      // Create API Gateways
      const createSpinnerInstance = createSpinner('Creating API Gateways...').start();
      const results: any[] = [];
      const errors: any[] = [];

      if (finalOptions.parallel) {
        // Parallel creation with progress bar
        const progressBar = new ProgressBar(targets.length, { 
          title: 'Creating API Gateways (Parallel)',
          hideCursor: true 
        });

        const promises = targets.map(async (target, index) => {
          try {
            const apiName = `${finalOptions.name}-${target.accountId}-${target.region}-${target.gatewayIndex}`;
            
            // Create temporary config for this target
            const tempConfig = {
              accounts: {
                [target.accountId]: {
                  accountId: target.accountId,
                  roleArn: target.roleArn,
                  externalId: target.externalId,
                  sessionName: 'api-spawner-bulk-session'
                }
              }
            };

            const apiManager = new ApiGatewayManager(tempConfig);
            const result = await apiManager.createApiGateway({
              name: apiName,
              region: target.region,
              account: target.accountId,
              description: finalOptions.description
            });

            progressBar.increment(`Created ${apiName}`);
            return { success: true, result, target };
          } catch (error) {
            progressBar.increment(`Failed ${target.accountId}/${target.region}-${target.gatewayIndex}`);
            return { success: false, error, target };
          }
        });

        const parallelResults = await Promise.all(promises);
        
        parallelResults.forEach(result => {
          if (result.success && result.result) {
            results.push(result.result);
          } else {
            errors.push(result);
          }
        });

        progressBar.complete(`Created ${results.length} API Gateways successfully`);
      } else {
        // Sequential creation with progress bar
        const progressBar = new ProgressBar(targets.length, { 
          title: 'Creating API Gateways (Sequential)',
          hideCursor: true 
        });

        for (let i = 0; i < targets.length; i++) {
          const target = targets[i];
          const apiName = `${finalOptions.name}-${target.accountId}-${target.region}-${target.gatewayIndex}`;
          
          progressBar.setStatus(`Creating ${apiName} (${i + 1}/${targets.length})`);

          try {
            // Create temporary config for this target
            const tempConfig = {
              accounts: {
                [target.accountId]: {
                  accountId: target.accountId,
                  roleArn: target.roleArn,
                  externalId: target.externalId,
                  sessionName: 'api-spawner-bulk-session'
                }
              }
            };

            const apiManager = new ApiGatewayManager(tempConfig);
            const result = await apiManager.createApiGateway({
              name: apiName,
              region: target.region,
              account: target.accountId,
              description: finalOptions.description
            });

            results.push(result);
            progressBar.increment(`Created ${apiName}`);
          } catch (error) {
            errors.push({ error, target });
            progressBar.increment(`Failed ${apiName}`);
          }
        }

        progressBar.complete(`Created ${results.length} API Gateways successfully`);
      }

      // Display results
      if (results.length > 0) {
        console.log(chalk.green('\n✅ Successfully Created:'));
        results.forEach(result => {
          console.log(chalk.cyan(`  ${result.name} (${result.account}/${result.region})`));
          console.log(chalk.gray(`    ID: ${result.id}`));
          console.log(chalk.gray(`    URL: ${result.url}`));
        });
      }

      if (errors.length > 0) {
        console.log(chalk.red('\n❌ Failed to Create:'));
        errors.forEach(({ error, target }) => {
          console.log(chalk.red(`  ${target.accountId}/${target.region}-${target.gatewayIndex}: ${error.message || error}`));
        });
      }

      console.log(chalk.blue(`\nSummary: ${results.length} API Gateways created, ${errors.length} failed`));

    } catch (error) {
      console.error(chalk.red('Error in bulk creation:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }); 