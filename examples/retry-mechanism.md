# Retry Mechanism for Rate Limiting

The API Spawner CLI now includes a robust retry mechanism that automatically handles rate limiting (429 errors) and other transient failures when creating or deleting API Gateways.

## Features

### 🚀 **Automatic Retry-After Header Extraction**
- Extracts the `Retry-After` header from 429 responses
- Respects AWS's recommended wait time
- Falls back to exponential backoff if no header is present

### 📈 **Exponential Backoff with Jitter**
- Base delay: 1 second (configurable)
- Exponential increase: 2^attempt
- Maximum delay: 30 seconds (configurable)
- Jitter: ±10% random variation to prevent thundering herd

### 🔄 **Retryable Error Types**
- **429 Too Many Requests**: Rate limiting
- **500 Internal Server Error**: Server errors
- **502 Bad Gateway**: Gateway errors
- **503 Service Unavailable**: Service unavailable
- **504 Gateway Timeout**: Timeout errors
- **Network Errors**: Connection issues
- **Throttling Exceptions**: AWS throttling

## Usage

### Command Line Options

Both `bulk-create` and `bulk-delete` commands support retry configuration:

```bash
# Basic usage with default retry settings
api-spawner bulk-create --name "my-api" --total-gateways 100

# Custom retry configuration
api-spawner bulk-create \
  --name "my-api" \
  --total-gateways 100 \
  --max-retries 10 \
  --retry-delay 2000 \
  --max-retry-delay 60000

# Bulk delete with retry settings
api-spawner bulk-delete \
  --pattern "my-api-*" \
  --max-retries 8 \
  --retry-delay 1500 \
  --max-retry-delay 45000
```

### Interactive Mode

When running interactively, you'll be prompted for retry settings:

```
? Maximum number of retries for failed operations: 5
? Base delay in milliseconds for retries: 1000
? Maximum delay in milliseconds for retries: 30000
```

## Retry Behavior Examples

### Example 1: 429 Error with Retry-After Header

```
Creating API Gateway my-api-123456789012-us-east-1-0...
⚠️  Create API Gateway failed (attempt 1/6): TooManyRequestsException
   Waiting Retry-After: 5s before retry...
Creating API Gateway my-api-123456789012-us-east-1-0...
✅ Created successfully
```

### Example 2: Network Error with Exponential Backoff

```
Creating API Gateway my-api-123456789012-us-east-1-1...
⚠️  Create API Gateway failed (attempt 1/6): NetworkError
   Waiting Backoff: 1s before retry...
Creating API Gateway my-api-123456789012-us-east-1-1...
⚠️  Create API Gateway failed (attempt 2/6): NetworkError
   Waiting Backoff: 2s before retry...
Creating API Gateway my-api-123456789012-us-east-1-1...
✅ Created successfully
```

### Example 3: Server Error with Jitter

```
Creating API Gateway my-api-123456789012-us-east-1-2...
⚠️  Create API Gateway failed (attempt 1/6): InternalServerError
   Waiting Backoff: 1.1s before retry... (includes jitter)
Creating API Gateway my-api-123456789012-us-east-1-2...
✅ Created successfully
```

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `--max-retries` | 5 | Maximum number of retry attempts |
| `--retry-delay` | 1000 | Base delay in milliseconds |
| `--max-retry-delay` | 30000 | Maximum delay in milliseconds |

## Retry Logic

### 1. Error Detection
```typescript
// Check if error is retryable
if (error.$metadata?.httpStatusCode === 429) {
  // Rate limiting - extract Retry-After header
  const retryAfter = error.$metadata?.httpHeaders?.['retry-after'];
  if (retryAfter) {
    delay = parseInt(retryAfter) * 1000;
  }
}
```

### 2. Exponential Backoff
```typescript
// Calculate delay with exponential backoff
const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);

// Add jitter to prevent thundering herd
const jitterAmount = exponentialDelay * 0.1;
const randomJitter = Math.random() * jitterAmount;
const finalDelay = exponentialDelay + randomJitter;
```

### 3. Retry Attempts
```typescript
// Retry loop
for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
  try {
    return await operation();
  } catch (error) {
    if (!isRetryableError(error) || attempt > maxRetries) {
      throw error;
    }
    
    const delay = calculateDelay(attempt, error);
    await sleep(delay);
  }
}
```

## Best Practices

### 1. **Conservative Defaults**
- Start with default settings (5 retries, 1s base delay)
- Increase only if you experience frequent failures

### 2. **Monitor Retry Patterns**
- Watch for retry messages in the output
- If you see many retries, consider reducing concurrency

### 3. **Adjust for Your Environment**
- **High-traffic environments**: Increase `--max-retry-delay`
- **Unstable networks**: Increase `--max-retries`
- **Rate-limited accounts**: Increase `--retry-delay`

### 4. **Parallel vs Sequential**
- **Parallel mode**: More likely to hit rate limits, use higher delays
- **Sequential mode**: Less likely to hit limits, can use lower delays

## Example Configurations

### For High-Volume Operations
```bash
api-spawner bulk-create \
  --name "high-volume-api" \
  --total-gateways 500 \
  --parallel \
  --max-retries 10 \
  --retry-delay 2000 \
  --max-retry-delay 60000
```

### For Unstable Networks
```bash
api-spawner bulk-create \
  --name "network-sensitive-api" \
  --total-gateways 50 \
  --max-retries 15 \
  --retry-delay 3000 \
  --max-retry-delay 90000
```

### For Rate-Limited Accounts
```bash
api-spawner bulk-create \
  --name "rate-limited-api" \
  --total-gateways 100 \
  --max-retries 8 \
  --retry-delay 5000 \
  --max-retry-delay 120000
```

## Monitoring and Debugging

### Enable Verbose Logging
The retry mechanism provides detailed logging:
- Retry attempts and reasons
- Wait times (Retry-After vs backoff)
- Final success/failure status

### Common Patterns
- **Many 429 errors**: Reduce concurrency or increase delays
- **Network errors**: Check connectivity or increase retries
- **Server errors**: Usually temporary, retries should help

The retry mechanism ensures your bulk operations complete successfully even when encountering temporary AWS service issues or rate limiting. 