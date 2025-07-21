import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import { APIGatewayClient, CreateRestApiCommand, GetRestApisCommand, DeleteRestApiCommand } from '@aws-sdk/client-api-gateway';
import { fromTemporaryCredentials } from '@aws-sdk/credential-providers';
import { AppConfig, AccountConfig } from './config-manager';
import { RetryManager, RetryOptions } from '../utils/retry';
import { awsRateLimiter } from '../utils/aws-rate-limiter';

export interface CreateApiOptions {
  name: string;
  region: string;
  account: string;
  description?: string;
  retryOptions?: RetryOptions;
}

export interface ApiGatewayInfo {
  id: string;
  name: string;
  description?: string;
  url: string;
  createdDate: Date;
  account: string;
  region: string;
}

export interface ListApiOptions {
  account?: string;
  region?: string | string[];
  retryOptions?: RetryOptions;
}

export interface DeleteApiOptions {
  retryOptions?: RetryOptions;
}

export class ApiGatewayManager {
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  private async getCredentials(accountAlias: string): Promise<any> {
    const accountConfig = this.config.accounts?.[accountAlias];
    if (!accountConfig) {
      throw new Error(`Account "${accountAlias}" not found in configuration`);
    }

    const stsClient = new STSClient({ region: 'us-east-1' });
    
    const assumeRoleParams: any = {
      RoleArn: accountConfig.roleArn,
      RoleSessionName: accountConfig.sessionName,
    };

    if (accountConfig.externalId) {
      assumeRoleParams.ExternalId = accountConfig.externalId;
    }

    const command = new AssumeRoleCommand(assumeRoleParams);
    const response = await stsClient.send(command);

    if (!response.Credentials) {
      throw new Error('Failed to assume role - no credentials returned');
    }

    return {
      accessKeyId: response.Credentials.AccessKeyId,
      secretAccessKey: response.Credentials.SecretAccessKey,
      sessionToken: response.Credentials.SessionToken,
    };
  }

  private createApiGatewayClient(credentials: any, region: string): APIGatewayClient {
    return new APIGatewayClient({
      region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
      // Enhanced retry configuration for AWS SDK v3
      maxAttempts: 3, // Let our custom retry handle the rest
      retryMode: 'adaptive', // Use adaptive retry mode
      requestHandler: {
        // Custom request handler for better rate limit handling
        httpOptions: {
          timeout: 30000, // 30 second timeout
          connectTimeout: 5000, // 5 second connect timeout
        }
      }
    });
  }

  async createApiGateway(options: CreateApiOptions): Promise<ApiGatewayInfo> {
    const credentials = await this.getCredentials(options.account);
    const client = this.createApiGatewayClient(credentials, options.region);

    const createOperation = async () => {
      const command = new CreateRestApiCommand({
        name: options.name,
        description: options.description,
      });

      const response = await client.send(command);

      if (!response.id || !response.name) {
        throw new Error('Failed to create API Gateway - invalid response');
      }

      const apiUrl = `https://${response.id}.execute-api.${options.region}.amazonaws.com/stage`;

      return {
        id: response.id,
        name: response.name,
        description: response.description,
        url: apiUrl,
        createdDate: response.createdDate || new Date(),
        account: options.account,
        region: options.region,
      };
    };

    const retryResult = await RetryManager.retry(createOperation, {
      maxRetries: 5,
      baseDelay: 1000,
      maxDelay: 30000,
      jitter: true,
      onRetry: (attempt, error, delay) => {
        // Don't log retry messages to avoid interfering with progress bars
        // The progress bar will handle the status updates
      },
      ...options.retryOptions
    });

    if (!retryResult.success) {
      throw retryResult.error;
    }

    return retryResult.result!;
  }

  async listApiGateways(options: ListApiOptions = {}): Promise<ApiGatewayInfo[]> {
    const accounts = options.account ? [options.account] : Object.keys(this.config.accounts || {});
    
    // Handle both single region string and array of regions
    let regions: string[];
    if (options.region) {
      if (Array.isArray(options.region)) {
        regions = options.region;
      } else {
        // Handle comma-separated string
        regions = options.region.includes(',') ? options.region.split(',').map(r => r.trim()) : [options.region];
      }
    } else {
      regions = [
        'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
        'eu-west-1', 'eu-central-1', 'ap-southeast-1', 'ap-northeast-1'
      ];
    }

    const allApis: ApiGatewayInfo[] = [];

    for (const account of accounts) {
      try {
        const credentials = await this.getCredentials(account);
        
        for (const region of regions) {
          try {
            const listOperation = async () => {
              const client = this.createApiGatewayClient(credentials, region);
              const command = new GetRestApisCommand({});
              const response = await client.send(command);

              if (response.items) {
                const apis = response.items.map(item => ({
                  id: item.id!,
                  name: item.name!,
                  description: item.description,
                  url: `https://${item.id}.execute-api.${region}.amazonaws.com/stage`,
                  createdDate: item.createdDate || new Date(),
                  account,
                  region,
                }));

                return apis;
              }
              return [];
            };

            const retryResult = await RetryManager.retry(listOperation, {
              maxRetries: 3,
              baseDelay: 500,
              maxDelay: 10000,
              jitter: true,
              onRetry: (attempt, error, delay) => {
                // Don't log retry messages to avoid interfering with progress bars
                // The progress bar will handle the status updates
              },
              ...options.retryOptions
            });

            if (retryResult.success) {
              allApis.push(...retryResult.result!);
            } else {
              console.warn(`Failed to list APIs in ${account}/${region} after retries:`, retryResult.error);
            }
          } catch (error) {
            console.warn(`Failed to list APIs in ${account}/${region}:`, error);
          }
        }
      } catch (error) {
        console.warn(`Failed to get credentials for account ${account}:`, error);
      }
    }

    return allApis;
  }

  async deleteApiGateway(apiId: string, options: DeleteApiOptions = {}): Promise<void> {
    // First, find the API to get its region and account
    const apis = await this.listApiGateways();
    const api = apis.find(a => a.id === apiId);

    if (!api) {
      throw new Error(`API Gateway with ID "${apiId}" not found`);
    }

    const credentials = await this.getCredentials(api.account);
    const client = this.createApiGatewayClient(credentials, api.region);

    const deleteOperation = async () => {
      const command = new DeleteRestApiCommand({
        restApiId: apiId,
      });

      await client.send(command);
    };

    const retryResult = await RetryManager.retry(deleteOperation, {
      maxRetries: 5,
      baseDelay: 1000,
      maxDelay: 30000,
      jitter: true,
      onRetry: (attempt, error, delay) => {
        // Don't log retry messages to avoid interfering with progress bars
        // The progress bar will handle the status updates
      },
      ...options.retryOptions
    });

    if (!retryResult.success) {
      throw retryResult.error;
    }
  }

  /**
   * Delete an API Gateway with pre-fetched API information (optimized for bulk operations)
   */
  async deleteApiGatewayDirect(api: ApiGatewayInfo, options: DeleteApiOptions = {}): Promise<void> {
    const credentials = await this.getCredentials(api.account);
    const client = this.createApiGatewayClient(credentials, api.region);

    const deleteOperation = async () => {
      const command = new DeleteRestApiCommand({
        restApiId: api.id,
      });

      await client.send(command);
    };

    // Use adaptive rate limiter for delete operations
    const adaptiveRetryOptions = awsRateLimiter.getDeleteRetryOptions(
      api.account, 
      api.region, 
      { operationType: 'delete' }
    );

    const retryResult = await RetryManager.retry(deleteOperation, {
      ...adaptiveRetryOptions,
      onRetry: (attempt, error, delay) => {
        // Don't log retry messages to avoid interfering with progress bars
        // The progress bar will handle the status updates
      },
      ...options.retryOptions
    });

    if (!retryResult.success) {
      throw retryResult.error;
    }
  }
} 