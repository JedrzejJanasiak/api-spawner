# API Spawner

A powerful CLI tool to create and manage multiple AWS API Gateways across multiple accounts and regions using STS AssumeRole.

## Features

- 🚀 **Multi-Account Support**: Manage API Gateways across multiple AWS accounts
- 🌍 **Multi-Region Support**: Deploy APIs in different AWS regions
- 🔐 **STS AssumeRole**: Secure cross-account access using IAM roles
- 📝 **Interactive CLI**: User-friendly prompts and commands
- ⚡ **Fast Operations**: Efficient AWS SDK v3 integration
- 🔧 **Easy Configuration**: Simple YAML-based configuration
- 🎯 **Bulk Creation**: Create multiple APIs across accounts and regions in one run
- 🔍 **Role Discovery**: Automatically discover and test assumable IAM roles
- 📊 **Progress Bars**: Visual progress indicators for long-running operations
- 🔄 **Retry Mechanism**: Automatic handling of rate limiting (429 errors) with Retry-After header extraction

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd api-spawner

# Install dependencies
yarn install

# Build the project
yarn build

# Link globally (optional)
yarn link
```

## Quick Start

1. **Configure AWS Accounts**:
   ```bash
   api-spawner configure
   ```

2. **List Configured Accounts** (optional):
   ```bash
   api-spawner list-accounts
   ```

3. **Create an API Gateway**:
   ```bash
   api-spawner create
   ```

4. **Create Multiple API Gateways (Bulk)**:
   ```bash
   # Using role discovery mode (default)
   api-spawner bulk-create
   
   # Using configured accounts mode
   api-spawner bulk-create --mode configured
   ```

5. **Delete Multiple API Gateways (Bulk)**:
   ```bash
   # Using role discovery mode (default)
   api-spawner bulk-delete
   
   # Using configured accounts mode
   api-spawner bulk-delete --mode configured
   ```

6. **List all API Gateways**:
   ```bash
   api-spawner list
   ```

7. **Delete an API Gateway**:
   ```bash
   api-spawner delete
   ```

## Configuration

The tool stores configuration in `~/.api-spawner/config.yml`. You can configure multiple AWS accounts with their respective IAM roles.

### Example Configuration

```yaml
accounts:
  prod:
    accountId: "123456789012"
    roleArn: "arn:aws:iam::123456789012:role/CrossAccountRole"
    externalId: "your-external-id"
    sessionName: "api-spawner-session"
  
  staging:
    accountId: "987654321098"
    roleArn: "arn:aws:iam::987654321098:role/CrossAccountRole"
    sessionName: "api-spawner-session"

defaultRegion: "us-east-1"
defaultAccount: "prod"
```

## Commands

### `configure`

Configure AWS accounts for API Gateway management.

```bash
api-spawner configure
```

### `list-accounts`

List configured AWS accounts.

```bash
api-spawner list-accounts
```

This command shows all configured accounts with their aliases, account IDs, role ARNs, and other details. Useful for the configured mode of bulk-create command.

### `create`

Create a new API Gateway.

```bash
# Interactive mode
api-spawner create

# With options
api-spawner create --name "my-api" --region "us-east-1" --account "prod" --description "My API Gateway"
```

**Options:**
- `-n, --name <name>`: API Gateway name
- `-r, --region <region>`: AWS region
- `-a, --account <account>`: AWS account alias
- `-d, --description <description>`: API Gateway description

### `bulk-create`

Create multiple API Gateways across accounts and regions in one run. Supports two modes:

#### Mode 1: Role Discovery Mode (Default)
Automatically discovers assumable IAM roles in the current account using a pattern match.

```bash
# Interactive mode
api-spawner bulk-create

# With options
api-spawner bulk-create --name "my-api" --regions "us-east-1,us-west-2" --role-pattern "api-deploy" --total-gateways 100 --parallel
```

#### Mode 2: Configured Accounts Mode
Uses pre-configured accounts from the config file.

```bash
# Interactive mode (will prompt to select configured accounts)
api-spawner bulk-create --mode configured

# With specific configured accounts
api-spawner bulk-create --mode configured --account-aliases "prod,staging,dev" --name "my-api" --regions "us-east-1,us-west-2" --total-gateways 100 --parallel
```

**Options:**
- `-n, --name <name>`: Base API Gateway name (will be suffixed with account/region/gateway-index)
- `-d, --description <description>`: API Gateway description
- `-r, --regions <regions>`: Comma-separated list of AWS regions
- `-a, --accounts <accounts>`: Comma-separated list of AWS account IDs
- `-p, --role-pattern <pattern>`: Pattern to match role names (for discovery mode)
- `-e, --external-id <id>`: External ID for role assumption
- `-t, --total-gateways <number>`: Total number of API Gateways to create across all regions
- `--parallel`: Create API Gateways in parallel (faster but more resource intensive)
- `-m, --mode <mode>`: Mode: "discovery" (find roles by pattern) or "configured" (use pre-configured accounts)
- `--account-aliases <aliases>`: Comma-separated list of configured account aliases to use (for configured mode)
- `--max-retries <number>`: Maximum number of retries for failed operations (default: 5)
- `--retry-delay <number>`: Base delay in milliseconds for retries (default: 1000)
- `--max-retry-delay <number>`: Maximum delay in milliseconds for retries (default: 30000)

### `bulk-delete`

Delete multiple API Gateways created in bulk operations. Supports two modes:

#### Mode 1: Role Discovery Mode (Default)
Automatically discovers assumable IAM roles in the current account using a pattern match.

```bash
# Interactive mode
api-spawner bulk-delete

# With options
api-spawner bulk-delete --pattern "my-api-*" --regions "us-east-1,us-west-2" --dry-run
```

#### Mode 2: Configured Accounts Mode
Uses pre-configured accounts from the config file.

```bash
# Interactive mode (will prompt to select configured accounts)
api-spawner bulk-delete --mode configured --pattern "my-api-*"

# With specific configured accounts
api-spawner bulk-delete --mode configured --account-aliases "prod,staging" --pattern "my-api-*" --dry-run
```

**Options:**
- `-p, --pattern <pattern>`: Pattern to match API Gateway names (e.g., "my-api-*")
- `-n, --name <name>`: Base name of API Gateways to delete (e.g., "my-api")
- `-r, --regions <regions>`: Comma-separated list of AWS regions to search
- `-a, --accounts <accounts>`: Comma-separated list of AWS account IDs to search
- `--role-pattern <pattern>`: Pattern to match role names (for discovery mode)
- `-e, --external-id <id>`: External ID for role assumption
- `--parallel`: Delete API Gateways in parallel (faster but more resource intensive)
- `-f, --force`: Skip confirmation prompts
- `--dry-run`: Show what would be deleted without actually deleting
- `-m, --mode <mode>`: Mode: "discovery" (find roles by pattern) or "configured" (use pre-configured accounts)
- `--account-aliases <aliases>`: Comma-separated list of configured account aliases to use (for configured mode)
- `--max-retries <number>`: Maximum number of retries for failed operations (default: 5)
- `--retry-delay <number>`: Base delay in milliseconds for retries (default: 1000)
- `--max-retry-delay <number>`: Maximum delay in milliseconds for retries (default: 30000)

### `list`

List all API Gateways across accounts and regions.

```bash
# List all API Gateways
api-spawner list

# Filter by account
api-spawner list --account prod

# Filter by region
api-spawner list --region us-east-1
```

**Options:**
- `-a, --account <account>`: Filter by AWS account alias
- `-r, --region <region>`: Filter by AWS region

### `delete`

Delete an API Gateway.

```bash
# Interactive mode
api-spawner delete

# With API ID
api-spawner delete --id "abc123def"

# Force delete (skip confirmation)
api-spawner delete --id "abc123def" --force
```

**Options:**
- `-i, --id <id>`: API Gateway ID
- `-n, --name <name>`: API Gateway name
- `-r, --region <region>`: AWS region
- `-a, --account <account>`: AWS account alias
- `-f, --force`: Skip confirmation prompt

## Prerequisites

### AWS Setup

#### For Manual Configuration (configure command)
1. **IAM Role**: Create an IAM role in each target account with the following permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "apigateway:*",
           "sts:AssumeRole"
         ],
         "Resource": "*"
       }
     ]
   }
   ```

2. **Trust Policy**: Configure the trust policy to allow your source account to assume the role:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "AWS": "arn:aws:iam::SOURCE_ACCOUNT_ID:root"
         },
         "Action": "sts:AssumeRole",
         "Condition": {
           "StringEquals": {
             "sts:ExternalId": "your-external-id"
           }
         }
       }
     ]
   }
   ```

#### For Bulk Creation (bulk-create command)
1. **Basic AWS Credentials**: Configure AWS Access Key ID and Secret Access Key with the following permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "iam:ListRoles",
           "iam:GetRole",
           "sts:AssumeRole",
           "sts:GetCallerIdentity"
         ],
         "Resource": "*"
       }
     ]
   }
   ```

2. **Target Account Roles**: Ensure target accounts have IAM roles with API Gateway permissions and trust policies allowing assumption from your source account.

3. **Local AWS Credentials**: Ensure you have AWS credentials configured locally (AWS CLI, environment variables, or IAM roles).

## Retry Mechanism

The API Spawner includes a robust retry mechanism that automatically handles rate limiting (429 errors) and other transient failures:

### Features
- **Automatic Retry-After Header Extraction**: Respects AWS's recommended wait time from 429 responses
- **Exponential Backoff with Jitter**: Prevents thundering herd with intelligent backoff
- **Configurable Retry Settings**: Customize retry attempts, delays, and timeouts
- **Comprehensive Error Handling**: Handles 429, 500, 502, 503, 504, and network errors

### Usage Examples
```bash
# Basic usage with default retry settings
api-spawner bulk-create --name "my-api" --total-gateways 100

# Custom retry configuration for high-volume operations
api-spawner bulk-create \
  --name "high-volume-api" \
  --total-gateways 500 \
  --parallel \
  --max-retries 10 \
  --retry-delay 2000 \
  --max-retry-delay 60000

# Bulk delete with aggressive retry settings
api-spawner bulk-delete \
  --pattern "my-api-*" \
  --max-retries 8 \
  --retry-delay 1500 \
  --max-retry-delay 45000
```

### Retry Behavior
- **429 Errors**: Extracts `Retry-After` header and waits accordingly
- **Other Errors**: Uses exponential backoff (1s, 2s, 4s, 8s, 16s, 30s max)
- **Jitter**: Adds ±10% random variation to prevent synchronized retries
- **Integrated Display**: Retry information shown within progress bar status for clean output
- **Optimized for Operations**: Enhanced retry settings for delete operations (8 retries, 2s base delay)

For detailed information, see [examples/retry-mechanism.md](examples/retry-mechanism.md).

## Performance Optimizations

The tool includes significant performance optimizations for bulk operations:

### Bulk-Delete Optimizations
- **Eliminated Redundant API Lookups**: 95% reduction in API calls
- **Enhanced Retry Strategy**: Optimized settings for delete operations
- **Batching**: Parallel operations use intelligent batching to reduce rate limiting
- **Delays**: Strategic delays between operations to improve success rates

### Performance Comparison
| Operation | Time | Success Rate |
|-----------|------|--------------|
| Bulk-Create (20 APIs) | ~30 seconds | 95% |
| Bulk-Delete (20 APIs) | ~1-2 minutes | 90-95% |

For detailed performance analysis, see [examples/performance-optimization.md](examples/performance-optimization.md).

## Development

```bash
# Install dependencies
yarn install

# Run in development mode
yarn dev

# Run tests
yarn test

# Lint code
yarn lint

# Format code
yarn format

# Build for production
yarn build
```

## Architecture

The tool is built with:

- **TypeScript**: For type safety and better development experience
- **Commander.js**: For CLI command parsing
- **Inquirer.js**: For interactive prompts
- **AWS SDK v3**: For AWS service interactions
- **YAML**: For configuration management

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
