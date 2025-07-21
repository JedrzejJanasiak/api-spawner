import { readFileSync } from 'fs';
import { join } from 'path';

export interface VersionInfo {
  version: string;
  description: string;
  nodeVersion: string;
  platform: string;
  arch: string;
  buildTime?: string;
  gitCommit?: string;
}

export class VersionManager {
  private static instance: VersionManager;
  private versionInfo: VersionInfo | null = null;

  private constructor() {}

  static getInstance(): VersionManager {
    if (!VersionManager.instance) {
      VersionManager.instance = new VersionManager();
    }
    return VersionManager.instance;
  }

  getVersionInfo(): VersionInfo {
    if (this.versionInfo) {
      return this.versionInfo;
    }

    try {
      // Try to read package.json from different possible locations
      const possiblePaths = [
        join(__dirname, '../../package.json'), // Production build
        join(__dirname, '../package.json'),    // Development
        join(process.cwd(), 'package.json'),   // Current working directory
      ];

      let packageJson: any = null;
      for (const path of possiblePaths) {
        try {
          packageJson = JSON.parse(readFileSync(path, 'utf8'));
          break;
        } catch (error) {
          // Continue to next path
        }
      }

      if (!packageJson) {
        throw new Error('Could not find package.json');
      }

      this.versionInfo = {
        version: packageJson.version || 'unknown',
        description: packageJson.description || 'CLI tool to create and manage multiple AWS API Gateways across accounts and regions',
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        buildTime: process.env.BUILD_TIME || undefined,
        gitCommit: process.env.GIT_COMMIT || undefined,
      };

      return this.versionInfo;
    } catch (error) {
      // Fallback version info
      this.versionInfo = {
        version: 'unknown',
        description: 'CLI tool to create and manage multiple AWS API Gateways across accounts and regions',
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      };

      return this.versionInfo;
    }
  }

  getVersion(): string {
    return this.getVersionInfo().version;
  }

  isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  }

  isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  getFullVersionString(): string {
    const info = this.getVersionInfo();
    let versionString = `v${info.version}`;
    
    if (info.gitCommit) {
      versionString += ` (${info.gitCommit.substring(0, 7)})`;
    }
    
    if (this.isDevelopment()) {
      versionString += ' [dev]';
    }
    
    return versionString;
  }
}

// Export singleton instance
export const versionManager = VersionManager.getInstance(); 