import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { IAMClient, ListRolesCommand, GetRoleCommand } from '@aws-sdk/client-iam';
import { fromEnv } from '@aws-sdk/credential-providers';

export interface DiscoveredRole {
  roleArn: string;
  roleName: string;
  accountId: string;
  description?: string;
  path: string;
  assumeRolePolicyDocument?: any;
}

export interface RoleDiscoveryOptions {
  regions?: string[];
  roleNamePattern?: string;
  maxRoles?: number;
}

export class RoleDiscoveryService {
  private stsClient: STSClient;
  private iamClient: IAMClient;

  constructor() {
    this.stsClient = new STSClient({ region: 'us-east-1' });
    this.iamClient = new IAMClient({ region: 'us-east-1' });
  }

  /**
   * Get the current AWS account ID using basic credentials
   */
  async getCurrentAccountId(): Promise<string> {
    try {
      const command = new GetCallerIdentityCommand({});
      const response = await this.stsClient.send(command);
      
      if (!response.Account) {
        throw new Error('Could not determine current AWS account ID');
      }
      
      return response.Account;
    } catch (error) {
      throw new Error(`Failed to get current account ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Discover assumable roles in the current account
   */
  async discoverRolesInCurrentAccount(options: RoleDiscoveryOptions = {}): Promise<DiscoveredRole[]> {
    const roles: DiscoveredRole[] = [];
    let marker: string | undefined;

    try {
      do {
        const command = new ListRolesCommand({
          Marker: marker,
          MaxItems: options.maxRoles || 100
        });

        const response = await this.iamClient.send(command);
        
        if (response.Roles) {
          for (const role of response.Roles) {
            if (role.Arn && role.RoleName) {
              // Check if role name matches pattern if specified
              if (options.roleNamePattern && !role.RoleName.includes(options.roleNamePattern)) {
                continue;
              }

              // Get detailed role information including trust policy
              try {
                const getRoleCommand = new GetRoleCommand({ RoleName: role.RoleName });
                const roleDetails = await this.iamClient.send(getRoleCommand);
                
                if (roleDetails.Role && this.isRoleAssumable(roleDetails.Role.AssumeRolePolicyDocument)) {
                  roles.push({
                    roleArn: role.Arn,
                    roleName: role.RoleName,
                    accountId: this.extractAccountIdFromArn(role.Arn),
                    description: role.Description,
                    path: role.Path || '/',
                    assumeRolePolicyDocument: roleDetails.Role.AssumeRolePolicyDocument
                  });
                }
              } catch (error) {
                // Skip roles we can't get details for
                console.warn(`Could not get details for role ${role.RoleName}:`, error);
              }
            }
          }
        }

        marker = response.Marker;
      } while (marker && roles.length < (options.maxRoles || 100));

      return roles;
    } catch (error) {
      throw new Error(`Failed to discover roles: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Discover assumable roles across multiple accounts (requires cross-account access)
   */
  async discoverRolesAcrossAccounts(accountIds: string[], options: RoleDiscoveryOptions = {}): Promise<DiscoveredRole[]> {
    const allRoles: DiscoveredRole[] = [];

    for (const accountId of accountIds) {
      try {
        console.log(`Discovering roles in account ${accountId}...`);
        
        // For cross-account discovery, you would need to assume a role in each account
        // This is a simplified version - in practice, you'd need proper cross-account setup
        const roles = await this.discoverRolesInCurrentAccount(options);
        
        // Filter roles that belong to the target account
        const accountRoles = roles.filter(role => role.accountId === accountId);
        allRoles.push(...accountRoles);
        
      } catch (error) {
        console.warn(`Failed to discover roles in account ${accountId}:`, error);
      }
    }

    return allRoles;
  }

  /**
   * Check if a role is assumable by examining its trust policy
   */
  private isRoleAssumable(assumeRolePolicyDocument: any): boolean {
    if (!assumeRolePolicyDocument) return false;

    try {
      const policy = typeof assumeRolePolicyDocument === 'string' 
        ? JSON.parse(assumeRolePolicyDocument) 
        : assumeRolePolicyDocument;

      if (!policy.Statement || !Array.isArray(policy.Statement)) {
        return false;
      }

      return policy.Statement.some((statement: any) => {
        return statement.Effect === 'Allow' && 
               statement.Action && 
               (statement.Action === 'sts:AssumeRole' || 
                (Array.isArray(statement.Action) && statement.Action.includes('sts:AssumeRole')));
      });
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract account ID from ARN
   */
  private extractAccountIdFromArn(arn: string): string {
    const match = arn.match(/arn:aws:iam::(\d+):role/);
    return match ? match[1] : '';
  }

  /**
   * Test if a role can be assumed with current credentials
   */
  async testRoleAssumption(roleArn: string, externalId?: string): Promise<boolean> {
    try {
      const assumeRoleParams: any = {
        RoleArn: roleArn,
        RoleSessionName: 'api-spawner-test-session'
      };

      if (externalId) {
        assumeRoleParams.ExternalId = externalId;
      }

      const { AssumeRoleCommand } = await import('@aws-sdk/client-sts');
      const command = new AssumeRoleCommand(assumeRoleParams);
      await this.stsClient.send(command);
      
      return true;
    } catch (error) {
      return false;
    }
  }
} 