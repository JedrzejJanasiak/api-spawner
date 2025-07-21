# Distribution Logic Example

## Problem Fixed

**Before**: When selecting multiple AWS accounts, APIs were only created on one account because the distribution logic didn't properly account for multiple accounts.

**After**: APIs are now distributed evenly across all selected accounts and regions.

## Example: 20 API Gateways, 2 Accounts, 2 Regions

### Distribution Plan
```
📊 Distribution Plan:
  Total API Gateways: 20
  Regions: 2
  Accounts: 2
  Gateways per Account per Region: 5
  Mode: configured
```

### Result
- **Account 1, Region 1**: 5 API Gateways
- **Account 1, Region 2**: 5 API Gateways
- **Account 2, Region 1**: 5 API Gateways
- **Account 2, Region 2**: 5 API Gateways

**Total**: 2 accounts × 2 regions × 5 gateways = 20 API Gateways

## Usage Examples

### Interactive Mode
```bash
api-spawner bulk-create
# Select multiple accounts when prompted
# Enter total gateways: 20
# Select regions: us-east-1, us-west-2
```

### Command Line Mode
```bash
api-spawner bulk-create \
  --name "my-api" \
  --total-gateways 20 \
  --regions "us-east-1,us-west-2" \
  --mode configured \
  --account-aliases "account1,account2"
```

## Distribution Formula

The new distribution logic uses this formula:

```
Gateways per Account per Region = ceil(Total Gateways / (Total Accounts × Total Regions))
```

### Examples

| Total Gateways | Accounts | Regions | Per Account/Region | Distribution |
|----------------|----------|---------|-------------------|--------------|
| 20 | 2 | 2 | 5 | 2×2×5 = 20 |
| 30 | 3 | 2 | 5 | 3×2×5 = 30 |
| 15 | 3 | 3 | 2 | 3×3×2 = 18 (3 extra) |
| 10 | 1 | 2 | 5 | 1×2×5 = 10 |

## API Gateway Names

The generated API Gateway names follow this pattern:
```
{base-name}-{account-id}-{region}-{gateway-index}
```

### Example Output
```
Will create 20 API Gateways:
  - my-api-123456789012-us-east-1-0 in 123456789012/us-east-1
  - my-api-123456789012-us-east-1-1 in 123456789012/us-east-1
  - my-api-123456789012-us-east-1-2 in 123456789012/us-east-1
  - my-api-123456789012-us-east-1-3 in 123456789012/us-east-1
  - my-api-123456789012-us-east-1-4 in 123456789012/us-east-1
  - my-api-123456789012-us-west-2-5 in 123456789012/us-west-2
  - my-api-123456789012-us-west-2-6 in 123456789012/us-west-2
  - my-api-123456789012-us-west-2-7 in 123456789012/us-west-2
  - my-api-123456789012-us-west-2-8 in 123456789012/us-west-2
  - my-api-123456789012-us-west-2-9 in 123456789012/us-west-2
  - my-api-987654321098-us-east-1-10 in 987654321098/us-east-1
  - my-api-987654321098-us-east-1-11 in 987654321098/us-east-1
  - my-api-987654321098-us-east-1-12 in 987654321098/us-east-1
  - my-api-987654321098-us-east-1-13 in 987654321098/us-east-1
  - my-api-987654321098-us-east-1-14 in 987654321098/us-east-1
  - my-api-987654321098-us-west-2-15 in 987654321098/us-west-2
  - my-api-987654321098-us-west-2-16 in 987654321098/us-west-2
  - my-api-987654321098-us-west-2-17 in 987654321098/us-west-2
  - my-api-987654321098-us-west-2-18 in 987654321098/us-west-2
  - my-api-987654321098-us-west-2-19 in 987654321098/us-west-2
```

## Both Modes Supported

### Role Discovery Mode
- Automatically discovers accounts from assumable roles
- Distributes gateways across discovered accounts
- Uses role pattern matching

### Configured Accounts Mode
- Uses pre-configured accounts from config file
- Allows manual selection of accounts
- More predictable distribution

## Verification

After creation, you can verify the distribution using the `list` command:

```bash
# List all created APIs
api-spawner list

# Filter by account
api-spawner list --account account1

# Filter by region
api-spawner list --region us-east-1
```

The new distribution logic ensures that your API Gateways are created evenly across all selected accounts and regions, making better use of your multi-account setup. 