# Adaptive Rate Limiting Defaults

## Overview

The API Spawner now uses **adaptive rate limiting** with operation-specific defaults that are automatically adjusted based on AWS rate limit responses.

## New Default Values

### **Bulk-Delete Operations**
```
✅ Maximum retries: 10 (up from 5)
✅ Base delay: 3000ms (up from 1000ms)  
✅ Maximum delay: 120000ms (up from 30000ms)
```

### **Bulk-Create Operations**
```
✅ Maximum retries: 5 (unchanged)
✅ Base delay: 1000ms (unchanged)
✅ Maximum delay: 30000ms (unchanged)
```

### **List Operations**
```
✅ Maximum retries: 3 (new)
✅ Base delay: 500ms (new)
✅ Maximum delay: 15000ms (new)
```

## Why These Changes Make Sense

### **1. Delete Operations Need More Retries**
- **AWS API Gateway delete operations** have the strictest rate limits
- **More retries** (10 vs 5) give operations a better chance to succeed
- **Longer delays** (3s vs 1s) respect AWS's rate limiting requirements

### **2. Adaptive Learning**
The system **learns** from rate limit responses:
```typescript
// If AWS suggests 30-second delay
// System uses 36 seconds (20% buffer) for future operations
// Gradually reduces delay if no rate limits for 5+ minutes
```

### **3. Operation-Specific Optimization**
Each operation type has different AWS rate limits:
- **Delete**: Strictest limits → More conservative settings
- **Create**: Moderate limits → Balanced settings  
- **List**: Most lenient limits → Faster settings

## How the Adaptive System Works

### **1. Initial Defaults**
When you start an operation, the system uses operation-specific defaults:
```typescript
// For delete operations
{
  maxRetries: 10,
  baseDelay: 3000,
  maxDelay: 120000
}
```

### **2. Rate Limit Learning**
When a rate limit is hit, the system learns:
```typescript
// AWS suggests 30-second delay
// System records: "Use 36 seconds for this account/region"
// Future operations in same account/region use this delay
```

### **3. Gradual Recovery**
If no rate limits are hit for a while:
```typescript
// After 5 minutes: Reduce delay by up to 50%
// After 10 minutes: Use minimum delay
// System adapts to your AWS account's actual limits
```

## Updated Prompts

The interactive prompts now show the adaptive system's behavior:

### **Bulk-Delete Prompt**
```
? Maximum number of retries for failed operations (adaptive system will use 10 for deletes): 10
? Base delay in milliseconds for retries (adaptive system will adjust based on rate limits): 3000
? Maximum delay in milliseconds for retries (adaptive system will use 120000ms for deletes): 120000
```

### **Bulk-Create Prompt**
```
? Maximum number of retries for failed operations (adaptive system will use 5 for creates): 5
? Base delay in milliseconds for retries (adaptive system will adjust based on rate limits): 1000
? Maximum delay in milliseconds for retries (adaptive system will use 30000ms for creates): 30000
```

## Validation Rules

The prompts now include validation to prevent invalid values:

```typescript
// Retries: 1-20 (reasonable range)
// Base delay: 100-10000ms (not too fast, not too slow)
// Max delay: 1000-600000ms (1 second to 10 minutes)
```

## Best Practices

### **1. Trust the Adaptive System**
- **Don't override** defaults unless you have specific requirements
- **Let the system learn** from your AWS account's rate limits
- **Monitor statistics** to see how the system is performing

### **2. When to Override Defaults**
- **Production environments**: Use higher retry counts and delays
- **Strict rate limits**: Increase delays beyond defaults
- **Development**: Lower delays for faster iteration

### **3. Monitoring Performance**
After operations, check the statistics:
```
📊 Rate Limit Statistics:
  • Total rate limits hit: 3
  • Average suggested delay: 45s
```

## Migration from Old Defaults

### **Old Behavior**
```
❌ All operations: 5 retries, 1000ms delay, 30000ms max
❌ No learning from rate limits
❌ Same strategy for all operations
```

### **New Behavior**
```
✅ Operation-specific defaults
✅ Adaptive learning from rate limits
✅ Account/region-specific optimization
✅ Gradual recovery from rate limits
```

## Technical Implementation

### **Rate Limit Key Structure**
```typescript
// Format: accountId:region:operation
"123456789012:us-east-1:delete"
"987654321098:eu-west-1:create"
```

### **Adaptive Delay Calculation**
```typescript
// If recent rate limit (within 1 minute)
delay = suggestedDelay * 1.2 // 20% buffer

// If no recent rate limits
reductionFactor = Math.min(timeSinceLastRateLimit / 300000, 0.5)
delay = baseDelay * (1 - reductionFactor)
```

This adaptive system provides **optimal performance** while **respecting AWS rate limits** and **learning from experience**. 