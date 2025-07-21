import { Command } from 'commander';
import chalk from 'chalk';
import { versionManager } from '../utils/version';

export const versionCommand = new Command('version')
  .description('Display version information')
  .action(async () => {
    try {
      const versionInfo = versionManager.getVersionInfo();
      
      console.log(chalk.blue('🚀 API Spawner'));
      console.log(chalk.blue('==============\n'));
      
      console.log(chalk.cyan('Version:'), chalk.white(versionManager.getFullVersionString()));
      console.log(chalk.cyan('Description:'), chalk.white(versionInfo.description));
      console.log(chalk.cyan('Node.js:'), chalk.white(versionInfo.nodeVersion));
      console.log(chalk.cyan('Platform:'), chalk.white(`${versionInfo.platform} ${versionInfo.arch}`));
      
      if (versionInfo.buildTime) {
        console.log(chalk.cyan('Build Time:'), chalk.white(versionInfo.buildTime));
      }
      
      if (versionInfo.gitCommit) {
        console.log(chalk.cyan('Git Commit:'), chalk.white(versionInfo.gitCommit));
      }
      
      console.log(chalk.cyan('Environment:'), chalk.white(versionManager.isDevelopment() ? 'Development' : 'Production'));
      
      // Display features
      console.log(chalk.cyan('\nFeatures:'));
      console.log(chalk.gray('  • Multi-Account Support'));
      console.log(chalk.gray('  • Multi-Region Support'));
      console.log(chalk.gray('  • STS AssumeRole'));
      console.log(chalk.gray('  • Interactive CLI'));
      console.log(chalk.gray('  • Bulk Operations'));
      console.log(chalk.gray('  • Role Discovery'));
      console.log(chalk.gray('  • Progress Bars'));
      console.log(chalk.gray('  • Retry Mechanism'));
      console.log(chalk.gray('  • Performance Optimizations'));
      
      // Display recent changes if available
      console.log(chalk.cyan('\nRecent Updates:'));
      console.log(chalk.gray('  • Enhanced retry mechanism with Retry-After header extraction'));
      console.log(chalk.gray('  • Performance optimizations for bulk-delete operations'));
      console.log(chalk.gray('  • Single progress bar with integrated retry information'));
      console.log(chalk.gray('  • Improved error handling and user experience'));
      console.log(chalk.gray('  • Version management system'));
      
      console.log(chalk.blue('\nFor more information, visit:'));
      console.log(chalk.underline('https://github.com/your-username/api-spawner'));
      
    } catch (error) {
      console.error(chalk.red('Error reading version information:'), error);
      process.exit(1);
    }
  }); 