import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as YAML from 'yaml';

export interface AccountConfig {
  accountId: string;
  roleArn: string;
  externalId?: string;
  sessionName: string;
}

export interface AppConfig {
  accounts?: Record<string, AccountConfig>;
  defaultRegion?: string;
  defaultAccount?: string;
}

export class ConfigManager {
  private configPath: string;

  constructor() {
    const homeDir = os.homedir();
    const configDir = path.join(homeDir, '.api-spawner');
    
    // Ensure config directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    this.configPath = path.join(configDir, 'config.yml');
  }

  async loadConfig(): Promise<AppConfig> {
    try {
      if (!fs.existsSync(this.configPath)) {
        return {};
      }

      const configContent = fs.readFileSync(this.configPath, 'utf8');
      return YAML.parse(configContent) || {};
    } catch (error) {
      console.warn('Error loading config, using default:', error);
      return {};
    }
  }

  async saveConfig(config: AppConfig): Promise<void> {
    try {
      const configContent = YAML.stringify(config, {
        indent: 2,
        lineWidth: 80
      });
      
      fs.writeFileSync(this.configPath, configContent, 'utf8');
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAccountConfig(alias: string): Promise<AccountConfig | null> {
    const config = await this.loadConfig();
    return config.accounts?.[alias] || null;
  }

  async listAccounts(): Promise<string[]> {
    const config = await this.loadConfig();
    return Object.keys(config.accounts || {});
  }

  async removeAccount(alias: string): Promise<void> {
    const config = await this.loadConfig();
    if (config.accounts && config.accounts[alias]) {
      delete config.accounts[alias];
      await this.saveConfig(config);
    }
  }
} 