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
import { version } from '../package.json';

const program = new Command();

program
  .name('api-spawner')
  .description('CLI tool to create and manage multiple AWS API Gateways across accounts and regions')
  .version(version);

// Add commands
program.addCommand(createApiCommand);
program.addCommand(listApiCommand);
program.addCommand(deleteApiCommand);
program.addCommand(configureCommand);
program.addCommand(listAccountsCommand);
program.addCommand(bulkCreateCommand);
program.addCommand(bulkDeleteCommand);

// Global error handler
program.exitOverride();

try {
  program.parse();
} catch (err) {
  console.error(chalk.red('Error:'), err instanceof Error ? err.message : 'Unknown error occurred');
  process.exit(1);
} 