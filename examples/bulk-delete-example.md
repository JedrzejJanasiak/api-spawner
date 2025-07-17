# Bulk Delete Examples

## Basic Usage

### 1. Interactive Mode
```bash
api-spawner bulk-delete
```
This will prompt you for:
- How to select API Gateways (pattern, name, or interactive)
- Pattern or base name to match
- Regions to search
- Role pattern for discovery
- External ID (if needed)
- Whether to delete in parallel
- Whether to do a dry run first

### 2. Command Line Options

#### Delete by Pattern
```bash
# Delete all API Gateways matching a pattern
api-spawner bulk-delete --pattern "my-api-*" --dry-run

# Delete API Gateways from specific regions
api-spawner bulk-delete --pattern "test-api-123456789012-*" --regions "us-east-1,us-west-2"

# Force delete without confirmation
api-spawner bulk-delete --pattern "temp-api-*" --force
```

#### Delete by Base Name
```bash
# Delete all API Gateways starting with a base name
api-spawner bulk-delete --name "my-api" --dry-run

# Delete from specific accounts
api-spawner bulk-delete --name "test-api" --accounts "123456789012,987654321098"
```

#### Interactive Selection
```bash
# Select API Gateways interactively from all available
api-spawner bulk-delete
# Then choose "Interactive selection from all API Gateways"
```

## Pattern Examples

### Wildcard Patterns
```bash
# Delete all API Gateways starting with "my-api"
api-spawner bulk-delete --pattern "my-api-*"

# Delete all API Gateways ending with "-us-east-1"
api-spawner bulk-delete --pattern "*-us-east-1"

# Delete API Gateways from a specific account
api-spawner bulk-delete --pattern "*-123456789012-*"

# Delete API Gateways with specific naming pattern
api-spawner bulk-delete --pattern "test-api-*-us-east-1-*"
```

### Specific Account and Region Patterns
```bash
# Delete all API Gateways from account 123456789012 in us-east-1
api-spawner bulk-delete --pattern "*-123456789012-us-east-1-*"

# Delete all API Gateways from multiple accounts
api-spawner bulk-delete --pattern "*-123456789012-*" --pattern "*-987654321098-*"
```

## Safety Features

### Dry Run Mode
Always use `--dry-run` first to see what would be deleted:
```bash
api-spawner bulk-delete --pattern "my-api-*" --dry-run
```

### Force Mode
Skip all confirmation prompts (use with caution):
```bash
api-spawner bulk-delete --pattern "temp-api-*" --force
```

### Parallel Deletion
Delete API Gateways in parallel for faster execution:
```bash
api-spawner bulk-delete --pattern "my-api-*" --parallel
```

## Output Examples

### Dry Run Output
```
🗑️  Bulk API Gateway Deletion
============================

? How would you like to select API Gateways for deletion? By name pattern (e.g., "my-api-*")
? Enter pattern to match API Gateway names: my-api-*
? Select AWS regions to search (leave empty for all): us-east-1, us-west-2
? Enter role name pattern to match: api-deploy
? Enter External ID (optional): 
? Delete API Gateways in parallel? (faster but more resource intensive) No
? Dry run mode? (show what would be deleted without actually deleting) Yes

Discovering assumable roles... ✓ Found 3 assumable roles
Fetching API Gateways... ✓ Found 15 API Gateways

📋 API Gateways to delete (DRY RUN):

123456789012 (us-east-1)
──────────────────────────────────────────────────
  my-api-123456789012-us-east-1-0
    ID: abc123def
    URL: https://abc123def.execute-api.us-east-1.amazonaws.com/stage
  my-api-123456789012-us-east-1-1
    ID: def456ghi
    URL: https://def456ghi.execute-api.us-east-1.amazonaws.com/stage
  my-api-123456789012-us-east-1-2
    ID: ghi789jkl
    URL: https://ghi789jkl.execute-api.us-east-1.amazonaws.com/stage

123456789012 (us-west-2)
──────────────────────────────────────────────────
  my-api-123456789012-us-west-2-0
    ID: jkl012mno
    URL: https://jkl012mno.execute-api.us-west-2.amazonaws.com/stage
  my-api-123456789012-us-west-2-1
    ID: mno345pqr
    URL: https://mno345pqr.execute-api.us-west-2.amazonaws.com/stage

Total: 5 API Gateway(s)

✅ Dry run completed - no API Gateways were deleted
```

### Actual Deletion Output
```
🗑️  Bulk API Gateway Deletion
============================

? How would you like to select API Gateways for deletion? By name pattern (e.g., "my-api-*")
? Enter pattern to match API Gateway names: my-api-*
? Select AWS regions to search (leave empty for all): us-east-1, us-west-2
? Enter role name pattern to match: api-deploy
? Enter External ID (optional): 
? Delete API Gateways in parallel? (faster but more resource intensive) No
? Dry run mode? (show what would be deleted without actually deleting) No

Discovering assumable roles... ✓ Found 3 assumable roles
Fetching API Gateways... ✓ Found 15 API Gateways

📋 API Gateways to delete:

123456789012 (us-east-1)
──────────────────────────────────────────────────
  my-api-123456789012-us-east-1-0
    ID: abc123def
    URL: https://abc123def.execute-api.us-east-1.amazonaws.com/stage
  my-api-123456789012-us-east-1-1
    ID: def456ghi
    URL: https://def456ghi.execute-api.us-east-1.amazonaws.com/stage

Total: 2 API Gateway(s)

? Are you sure you want to delete 2 API Gateway(s)? Yes

Deleting API Gateways... ✓ Deleted 2 API Gateways successfully

✅ Successfully Deleted:
  my-api-123456789012-us-east-1-0 (123456789012/us-east-1)
  my-api-123456789012-us-east-1-1 (123456789012/us-east-1)

Summary: 2 deleted, 0 failed
```

## Common Use Cases

### 1. Clean Up After Testing
```bash
# Delete all test API Gateways
api-spawner bulk-delete --pattern "test-*" --dry-run
api-spawner bulk-delete --pattern "test-*"
```

### 2. Remove API Gateways from Specific Account
```bash
# Delete all API Gateways from a specific account
api-spawner bulk-delete --pattern "*-123456789012-*" --dry-run
```

### 3. Remove API Gateways from Specific Region
```bash
# Delete all API Gateways from us-east-1
api-spawner bulk-delete --pattern "*-us-east-1-*" --dry-run
```

### 4. Remove Bulk Created API Gateways
```bash
# Delete all API Gateways created in a bulk session
api-spawner bulk-delete --name "my-api" --dry-run
```

### 5. Interactive Cleanup
```bash
# Select API Gateways to delete interactively
api-spawner bulk-delete
# Choose "Interactive selection from all API Gateways"
# Check/uncheck the API Gateways you want to delete
```

## Best Practices

### 1. Always Use Dry Run First
```bash
api-spawner bulk-delete --pattern "your-pattern" --dry-run
```

### 2. Use Specific Patterns
Instead of broad patterns, use specific ones:
```bash
# Good - specific pattern
api-spawner bulk-delete --pattern "my-api-123456789012-us-east-1-*"

# Risky - too broad
api-spawner bulk-delete --pattern "my-api-*"
```

### 3. Filter by Region
Limit the scope to specific regions:
```bash
api-spawner bulk-delete --pattern "my-api-*" --regions "us-east-1,us-west-2"
```

### 4. Use Force Mode Carefully
Only use `--force` in automated scripts:
```bash
# Automated cleanup script
api-spawner bulk-delete --pattern "temp-*" --force
```

## Troubleshooting

### "No API Gateways found matching the criteria"
- Check your pattern syntax
- Verify the API Gateways exist in the specified regions
- Ensure your credentials have access to the accounts

### "Failed to delete API Gateway"
- Check that target roles have `apigateway:*` permissions
- Verify the role can be assumed in the target region
- Check for API Gateway service limits

### "Pattern not found"
- Use `--dry-run` to see what API Gateways are available
- Try a broader pattern first
- Use interactive mode to see all available API Gateways 