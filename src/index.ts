#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { createApiCommand } from './commands/create';
import { listApiCommand } from './commands/list';
import { deleteApiCommand } from './commands/delete';
import { configureCommand } from './commands/configure';
import { listAccountsCommand } from './commands/list-accounts';
import { bulkCreateCommand } from './commands/bulk-create';
import { bulkDeleteCommand } from './commands/bulk-delete';
import { versionCommand } from './commands/version';
import { version } from '../package.json';

const program = new Command();

program
  .name('api-spawner')
  .description('CLI tool to create and manage multiple AWS API Gateways across accounts and regions')
  .version(version, '-v, --version', 'output the version number');

// Add commands
program.addCommand(createApiCommand);
program.addCommand(listApiCommand);
program.addCommand(deleteApiCommand);
program.addCommand(configureCommand);
program.addCommand(listAccountsCommand);
program.addCommand(bulkCreateCommand);
program.addCommand(bulkDeleteCommand);
program.addCommand(versionCommand);

// Add help text after commands are added
program.addHelpText('after', `
Examples:
  $ api-spawner configure
  $ api-spawner bulk-create --name "my-api" --total-gateways 10
  $ api-spawner bulk-delete --pattern "my-api-*"
  $ api-spawner version

For more information, visit: https://github.com/your-username/api-spawner
  `);

// Parse arguments
program.parse(); 