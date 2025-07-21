# AWS Rate Limiting Improvements

## Overview

The API Spawner now includes advanced rate limiting capabilities specifically designed for AWS API Gateway operations, with special focus on delete operations which have the strictest rate limits.

## Key Improvements

### 1. **Enhanced Retry Strategy**
- **AWS SDK v3 Integration**: Uses AWS SDK's built-in `adaptive` retry mode
- **Custom Rate Limit Headers**: Handles `x-amzn-RateLimit-*` headers specifically
- **Retry-After Header Extraction**: Respects AWS's suggested retry delays
- **Exponential Backoff with Jitter**: Prevents thundering herd problems

### 2. **Adaptive Rate Limiter**
- **Learning System**: Remembers rate limit events and adjusts delays accordingly
- **Operation-Specific Delays**: Different strategies for create, delete, and list operations
- **Account/Region Tracking**: Tracks rate limits per account and region combination
- **Gradual Recovery**: Reduces delays when no recent rate limits are hit

### 3. **Conservative Delete Strategy**
- **Reduced Batch Size**: Parallel operations use batch size of 2 (down from 3)
- **Longer Delays**: 2-second delays between delete operations
- **More Retries**: Up to 10 retries for delete operations (vs 5 for create)
- **Extended Max Delay**: 2-minute maximum delay for delete operations

## Rate Limit Header Support

The system now handles these AWS rate limit headers:

```typescript
// Standard HTTP headers
'retry-after'
'Retry-After'

// AWS-specific headers
'x-amzn-ratelimit-retry-after'
'x-amzn-ratelimit-retryafter'
'x-amzn-ratelimit-limit'
'x-amzn-ratelimit-remaining'
```

## Adaptive Learning

The rate limiter learns from rate limit responses:

```typescript
// Example: If AWS suggests 30-second delay
// System will use 36 seconds (20% buffer) for future operations
// Gradually reduces delay if no rate limits for 5+ minutes
```

## Operation-Specific Delays

| Operation | Delay | Retries | Max Delay |
|-----------|-------|---------|-----------|
| Create    | 1s    | 5       | 30s       |
| Delete    | 2s    | 10      | 120s      |
| List      | 0.5s  | 3       | 15s       |

## Usage Examples

### Basic Bulk Delete
```bash
# Uses adaptive rate limiting automatically
api-spawner bulk-delete --pattern "test-api-*"
```

### Conservative Delete with Custom Settings
```bash
# Override default settings for very strict environments
api-spawner bulk-delete \
  --pattern "prod-api-*" \
  --max-retries 15 \
  --retry-delay 5000 \
  --max-retry-delay 300000
```

### Parallel vs Sequential
```bash
# Sequential (more conservative, better for strict rate limits)
api-spawner bulk-delete --pattern "api-*"

# Parallel (faster, but may hit rate limits more)
api-spawner bulk-delete --pattern "api-*" --parallel
```

## Rate Limit Statistics

After bulk operations, the system displays statistics:

```
📊 Rate Limit Statistics:
  • Total rate limits hit: 3
  • Average suggested delay: 45s
```

## Best Practices

### 1. **For Production Environments**
- Use sequential mode for critical operations
- Increase retry delays for strict rate limits
- Monitor rate limit statistics

### 2. **For Development/Testing**
- Parallel mode is usually fine
- Default settings work well for most cases

### 3. **For Large Scale Operations**
- Consider running operations during off-peak hours
- Use multiple AWS accounts to distribute load
- Monitor AWS CloudWatch API Gateway metrics

## Configuration

The rate limiter automatically adjusts based on:
- **Account/Region combinations**: Tracks limits per account
- **Operation history**: Learns from previous rate limits
- **Time-based recovery**: Reduces delays over time

## Troubleshooting

### Still Getting Rate Limited?
1. **Increase delays**: Use `--retry-delay` and `--max-retry-delay`
2. **Use sequential mode**: Avoid parallel operations
3. **Check AWS limits**: Verify your account's API Gateway limits
4. **Distribute load**: Use multiple accounts or regions

### Performance Issues?
1. **Monitor statistics**: Check rate limit statistics after operations
2. **Adjust batch sizes**: Reduce parallel batch size if needed
3. **Use adaptive mode**: Let the system learn optimal delays

## Technical Details

### AWS SDK v3 Configuration
```typescript
{
  maxAttempts: 3,        // Let custom retry handle the rest
  retryMode: 'adaptive', // Use AWS adaptive retry
  requestHandler: {
    httpOptions: {
      timeout: 30000,      // 30 second timeout
      connectTimeout: 5000 // 5 second connect timeout
    }
  }
}
```

### Rate Limit Key Structure
```typescript
// Format: accountId:region:operation
"123456789012:us-east-1:delete"
"987654321098:eu-west-1:create"
```

This system provides a robust, adaptive solution for handling AWS API Gateway's strict rate limits while maintaining good performance for bulk operations. 