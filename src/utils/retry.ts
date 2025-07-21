import chalk from 'chalk';

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  jitter?: boolean;
  onRetry?: (attempt: number, error: any, delay: number) => void;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: any;
  attempts: number;
  totalDelay: number;
}

export class RetryManager {
  private static readonly DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxRetries: 5,
    baseDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    jitter: true,
    onRetry: () => {}
  };

  /**
   * Extracts Retry-After header from AWS SDK error response
   */
  private static extractRetryAfter(error: any): number | null {
    try {
      // AWS SDK v3 error structure
      if (error.$metadata?.httpStatusCode === 429) {
        const retryAfter = error.$metadata?.httpHeaders?.['retry-after'] || 
                          error.$metadata?.httpHeaders?.['Retry-After'];
        
        if (retryAfter) {
          const seconds = parseInt(retryAfter, 10);
          if (!isNaN(seconds) && seconds > 0) {
            return seconds * 1000; // Convert to milliseconds
          }
        }
      }
    } catch (e) {
      // Ignore parsing errors
    }
    return null;
  }

  /**
   * Calculate exponential backoff delay with optional jitter
   */
  private static calculateDelay(attempt: number, baseDelay: number, maxDelay: number, jitter: boolean): number {
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    
    if (jitter) {
      // Add jitter to prevent thundering herd
      const jitterAmount = exponentialDelay * 0.1; // 10% jitter
      const randomJitter = Math.random() * jitterAmount;
      return exponentialDelay + randomJitter;
    }
    
    return exponentialDelay;
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if an error is retryable
   */
  private static isRetryableError(error: any): boolean {
    // 429 Too Many Requests
    if (error.$metadata?.httpStatusCode === 429) {
      return true;
    }
    
    // 500 Internal Server Error
    if (error.$metadata?.httpStatusCode === 500) {
      return true;
    }
    
    // 502 Bad Gateway
    if (error.$metadata?.httpStatusCode === 502) {
      return true;
    }
    
    // 503 Service Unavailable
    if (error.$metadata?.httpStatusCode === 503) {
      return true;
    }
    
    // 504 Gateway Timeout
    if (error.$metadata?.httpStatusCode === 504) {
      return true;
    }
    
    // Network errors
    if (error.name === 'NetworkError' || error.code === 'NetworkingError') {
      return true;
    }
    
    // Throttling errors
    if (error.name === 'ThrottlingException' || error.name === 'TooManyRequestsException') {
      return true;
    }
    
    return false;
  }

  /**
   * Retry a function with exponential backoff
   */
  static async retry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<RetryResult<T>> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    let lastError: any;
    let totalDelay = 0;

    for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
      try {
        const result = await fn();
        return {
          success: true,
          result,
          attempts: attempt,
          totalDelay
        };
      } catch (error) {
        lastError = error;
        
        // Don't retry on the last attempt
        if (attempt > opts.maxRetries) {
          break;
        }
        
        // Only retry if the error is retryable
        if (!this.isRetryableError(error)) {
          break;
        }
        
        // Extract Retry-After header for 429 errors
        let delay = this.extractRetryAfter(error);
        
        if (!delay) {
          // Use exponential backoff for other retryable errors
          delay = this.calculateDelay(attempt, opts.baseDelay, opts.maxDelay, opts.jitter);
        }
        
        totalDelay += delay;
        
        // Call onRetry callback
        opts.onRetry(attempt, error, delay);
        
        // Wait before retrying
        await this.sleep(delay);
      }
    }
    
    return {
      success: false,
      error: lastError,
      attempts: opts.maxRetries + 1,
      totalDelay
    };
  }

  /**
   * Retry multiple operations with rate limiting
   */
  static async retryBulk<T>(
    operations: Array<() => Promise<T>>,
    options: RetryOptions & {
      concurrency?: number;
      onProgress?: (completed: number, total: number, current: T | null) => void;
    } = {}
  ): Promise<Array<RetryResult<T>>> {
    const concurrency = options.concurrency || 1;
    const results: Array<RetryResult<T>> = [];
    let completed = 0;
    
    // Process operations in batches
    for (let i = 0; i < operations.length; i += concurrency) {
      const batch = operations.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (operation) => {
        const result = await this.retry(operation, options);
        completed++;
        
        if (options.onProgress) {
          options.onProgress(completed, operations.length, result.success ? result.result || null : null);
        }
        
        return result;
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }
}

/**
 * Utility function to create a retryable operation with logging
 */
export function createRetryableOperation<T>(
  operation: () => Promise<T>,
  operationName: string,
  options: RetryOptions = {}
): () => Promise<RetryResult<T>> {
  return async () => {
    return await RetryManager.retry(operation, {
      ...options,
      onRetry: (attempt, error, delay) => {
        const retryAfter = RetryManager['extractRetryAfter'](error);
        const delayInfo = retryAfter ? `Retry-After: ${Math.round(retryAfter / 1000)}s` : `Backoff: ${Math.round(delay / 1000)}s`;
        
        console.log(chalk.yellow(`⚠️  ${operationName} failed (attempt ${attempt}/${options.maxRetries || 5 + 1}): ${error.message || error}`));
        console.log(chalk.blue(`   Waiting ${delayInfo} before retry...`));
        
        if (options.onRetry) {
          options.onRetry(attempt, error, delay);
        }
      }
    });
  };
} 