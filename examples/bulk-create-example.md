# Bulk Create Examples

## Basic Usage

### 1. Interactive Mode
```bash
api-spawner bulk-create
```
This will prompt you for:
- Base API Gateway name
- Description
- Regions to deploy to
- Role pattern to match
- External ID (if needed)
- Total number of API Gateways to create
- Whether to create in parallel

### 2. Command Line Options
```bash
# Create 100 API Gateways across regions
api-spawner bulk-create \
  --name "my-api" \
  --description "My API Gateway" \
  --regions "us-east-1,us-west-2,eu-west-1" \
  --role-pattern "api-deploy" \
  --total-gateways 100 \
  --parallel

# Create 50 API Gateways
api-spawner bulk-create \
  --name "secure-api" \
  --regions "us-east-1,us-west-2" \
  --role-pattern "cross-account" \
  --external-id "my-external-id" \
  --total-gateways 50
```

## Distribution Examples

### Example 1: 100 API Gateways, 3 Regions
- **Total API Gateways:** 100
- **Regions:** 3 (us-east-1, us-west-2, eu-west-1)
- **Gateways per Region:** 34 (100 ÷ 3 = 33.33, rounded up to 34)
- **Result:** 34 API Gateways in us-east-1, 33 in us-west-2, 33 in eu-west-1

### Example 2: 50 API Gateways, 2 Regions
- **Total API Gateways:** 50
- **Regions:** 2 (us-east-1, us-west-2)
- **Gateways per Region:** 25 (50 ÷ 2 = 25)
- **Result:** 25 API Gateways per region

### Example 3: 200 API Gateways, 4 Regions
- **Total API Gateways:** 200
- **Regions:** 4 (us-east-1, us-east-2, us-west-1, us-west-2)
- **Gateways per Region:** 50 (200 ÷ 4 = 50)
- **Result:** 50 API Gateways per region

## AWS Credentials Setup

### Option 1: Environment Variables
```bash
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="us-east-1"
```

### Option 2: AWS CLI Configuration
```bash
aws configure
# Enter your Access Key ID, Secret Access Key, and default region
```

### Option 3: IAM Role (if running on EC2)
The tool will automatically use the instance profile if available.

## Role Discovery

The tool automatically discovers IAM roles that:
1. Match the specified pattern (e.g., "api-deploy")
2. Have a trust policy allowing `sts:AssumeRole`
3. Can be assumed with your current credentials

### Example Role Names That Would Match:
- `api-deploy-role`
- `cross-account-api-deploy`
- `deploy-api-gateway`
- `api-spawner-role`

### Example Role Names That Would NOT Match:
- `readonly-role` (doesn't contain "api-deploy")
- `lambda-execution-role` (doesn't contain "api-deploy")

## Output Example

```
🚀 Bulk API Gateway Creation
===========================

? Enter base API Gateway name: my-api
? Select AWS regions: US East (N. Virginia) - us-east-1, US West (Oregon) - us-west-2
? Enter role name pattern to match: api-deploy
? Enter External ID (optional): 
? Enter total number of API Gateways to create: 100
? Create API Gateways in parallel? (faster but more resource intensive) Yes

📊 Distribution Plan:
  Total API Gateways: 100
  Regions: 2
  Gateways per Region: 50

Discovering assumable roles... ✓ Found 3 assumable roles
Testing role assumptions... ✓ Found 3 testable roles

Will create 100 API Gateways:
  - my-api-123456789012-us-east-1-0 in 123456789012/us-east-1
  - my-api-123456789012-us-east-1-1 in 123456789012/us-east-1
  - my-api-123456789012-us-east-1-2 in 123456789012/us-east-1
  - my-api-123456789012-us-east-1-3 in 123456789012/us-east-1
  - my-api-123456789012-us-east-1-4 in 123456789012/us-east-1
  - my-api-123456789012-us-west-2-0 in 123456789012/us-west-2
  - my-api-123456789012-us-west-2-1 in 123456789012/us-west-2
  - my-api-123456789012-us-west-2-2 in 123456789012/us-west-2
  - my-api-123456789012-us-west-2-3 in 123456789012/us-west-2
  - my-api-123456789012-us-west-2-4 in 123456789012/us-west-2
  ... (and 90 more)

? Proceed with bulk creation? Yes

Creating API Gateways... ✓ Created 100 API Gateways successfully

✅ Successfully Created:
  my-api-123456789012-us-east-1-0 (123456789012/us-east-1)
    ID: abc123def
    URL: https://abc123def.execute-api.us-east-1.amazonaws.com/stage
  my-api-123456789012-us-east-1-1 (123456789012/us-east-1)
    ID: def456ghi
    URL: https://def456ghi.execute-api.us-east-1.amazonaws.com/stage
  ...

Summary: 100 API Gateways created, 0 failed
```

## Naming Convention

API Gateways are named using the pattern:
```
{base-name}-{account-id}-{region}-{gateway-index}
```

Examples:
- `my-api-123456789012-us-east-1-0` (first gateway in us-east-1)
- `my-api-123456789012-us-east-1-1` (second gateway in us-east-1)
- `my-api-123456789012-us-west-2-0` (first gateway in us-west-2)

## Troubleshooting

### "No assumable roles found"
- Check that your AWS credentials have `iam:ListRoles` and `iam:GetRole` permissions
- Verify the role pattern matches existing roles
- Ensure roles have proper trust policies

### "No roles can be assumed"
- Verify your credentials can assume the discovered roles
- Check if External ID is required for role assumption
- Ensure trust policies allow your account/principal

### "Failed to create API Gateway"
- Check that target roles have `apigateway:*` permissions
- Verify the role can be assumed in the target region
- Check for API Gateway service limits

### "Total API Gateways cannot exceed 1,000"
- The tool has a safety limit of 1,000 total API Gateways
- For larger deployments, run multiple bulk-create commands 