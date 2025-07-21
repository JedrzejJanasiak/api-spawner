import { RetryManager, RetryOptions } from './retry';

export interface AwsRateLimiterOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  adaptiveDelay?: boolean;
  operationType?: 'create' | 'delete' | 'list';
}

export class AwsRateLimiter {
  private static instance: AwsRateLimiter;
  private rateLimitHistory: Map<string, { lastRateLimit: number; suggestedDelay: number }> = new Map();
  private operationCounts: Map<string, number> = new Map();

  private constructor() {}

  static getInstance(): AwsRateLimiter {
    if (!AwsRateLimiter.instance) {
      AwsRateLimiter.instance = new AwsRateLimiter();
    }
    return AwsRateLimiter.instance;
  }

  /**
   * Get a rate limiter key for tracking
   */
  private getRateLimitKey(account: string, region: string, operation: string): string {
    return `${account}:${region}:${operation}`;
  }

  /**
   * Calculate adaptive delay based on rate limit history
   */
  private calculateAdaptiveDelay(key: string, baseDelay: number): number {
    const history = this.rateLimitHistory.get(key);
    if (!history) {
      return baseDelay;
    }

    const timeSinceLastRateLimit = Date.now() - history.lastRateLimit;
    const suggestedDelay = history.suggestedDelay;

    // If we recently hit a rate limit, use the suggested delay
    if (timeSinceLastRateLimit < 60000) { // Within last minute
      return Math.max(suggestedDelay, baseDelay);
    }

    // Gradually reduce delay if no recent rate limits
    const reductionFactor = Math.min(timeSinceLastRateLimit / 300000, 0.5); // Max 50% reduction
    return Math.max(baseDelay * (1 - reductionFactor), baseDelay * 0.5);
  }

  /**
   * Record a rate limit event
   */
  private recordRateLimit(key: string, retryAfter: number): void {
    this.rateLimitHistory.set(key, {
      lastRateLimit: Date.now(),
      suggestedDelay: retryAfter * 1.2 // Add 20% buffer
    });
  }

  /**
   * Get conservative retry options for delete operations
   */
  getDeleteRetryOptions(account: string, region: string, options: AwsRateLimiterOptions = {}): RetryOptions {
    const key = this.getRateLimitKey(account, region, 'delete');
    const baseDelay = options.baseDelay || 3000; // More conservative for deletes
    const adaptiveDelay = this.calculateAdaptiveDelay(key, baseDelay);

    return {
      maxRetries: options.maxRetries || 10, // More retries for deletes
      baseDelay: adaptiveDelay,
      maxDelay: options.maxDelay || 120000, // 2 minutes max delay
      jitter: true,
      onRetry: (attempt, error, delay) => {
        // Record rate limit events for adaptive learning
        if (error.$metadata?.httpStatusCode === 429) {
          const retryAfter = this.extractRetryAfter(error);
          if (retryAfter) {
            this.recordRateLimit(key, retryAfter);
          }
        }
      }
    };
  }

  /**
   * Extract retry-after from AWS error
   */
  private extractRetryAfter(error: any): number | null {
    try {
      const headers = error.$metadata?.httpHeaders || {};
      
      // Check various retry-after headers
      const retryAfter = headers['x-amzn-ratelimit-retry-after'] || 
                        headers['x-amzn-ratelimit-retryafter'] ||
                        headers['retry-after'] || 
                        headers['Retry-After'];
      
      if (retryAfter) {
        return parseInt(retryAfter, 10);
      }
    } catch (e) {
      // Ignore parsing errors
    }
    return null;
  }

  /**
   * Get operation-specific delay
   */
  getOperationDelay(operation: 'create' | 'delete' | 'list'): number {
    switch (operation) {
      case 'delete':
        return 2000; // 2 seconds between delete operations
      case 'create':
        return 1000; // 1 second between create operations
      case 'list':
        return 500;  // 0.5 seconds between list operations
      default:
        return 1000;
    }
  }

  /**
   * Reset rate limit history
   */
  resetHistory(): void {
    this.rateLimitHistory.clear();
    this.operationCounts.clear();
  }

  /**
   * Get rate limit statistics
   */
  getStats(): { totalRateLimits: number; averageDelay: number } {
    let totalRateLimits = 0;
    let totalDelay = 0;

    for (const [_, history] of this.rateLimitHistory) {
      totalRateLimits++;
      totalDelay += history.suggestedDelay;
    }

    return {
      totalRateLimits,
      averageDelay: totalRateLimits > 0 ? totalDelay / totalRateLimits : 0
    };
  }
}

// Export singleton instance
export const awsRateLimiter = AwsRateLimiter.getInstance(); 