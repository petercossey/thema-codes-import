import { BigCommerceCategory } from './types/bigcommerce';
import { BigCommerceConfig } from './types/config';
import logger from './utils/logger';

/**
 * Manages rate limiting for API calls
 */
class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private lastCallTime = 0;
  private readonly minInterval = 250; // 4 calls per second = 250ms between calls

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      if (!this.processing) {
        void this.processQueue();
      }
    });
  }

  private async processQueue() {
    if (this.processing) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const now = Date.now();
      const timeToWait = Math.max(0, this.minInterval - (now - this.lastCallTime));
      
      if (timeToWait > 0) {
        await new Promise(resolve => setTimeout(resolve, timeToWait));
      }

      const fn = this.queue.shift();
      if (fn) {
        this.lastCallTime = Date.now();
        try {
          await fn();
        } catch (error) {
          logger.error('Error processing queue item:', error);
        }
      }
    }

    this.processing = false;
  }
}

interface BigCommerceError {
  title?: string;
  status?: number;
  errors?: Record<string, string[]>;
  detail?: string;
}

interface BigCommerceResponse {
  data: Array<{
    category_id: number;
  }>;
}

/**
 * BigCommerce API client for managing categories
 */
export class BigCommerceClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly rateLimiter: RateLimiter;

  constructor(config: BigCommerceConfig) {
    this.baseUrl = `https://api.bigcommerce.com/stores/${config.storeHash}/${config.apiVersion}`;
    this.headers = {
      'Content-Type': 'application/json',
      'X-Auth-Token': config.apiToken,
      'Accept': 'application/json'
    };
    this.rateLimiter = new RateLimiter();
  }

  /**
   * Creates a new category using the BigCommerce Category Trees API
   * Includes retry logic with exponential backoff
   */
  async createCategory(category: BigCommerceCategory, retries = 5): Promise<number> {
    const makeRequest = async () => {
      try {
        const response = await fetch(
          `${this.baseUrl}/catalog/trees/categories`,
          {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify([category])
          }
        );

        if (!response.ok) {
          const error = await response.json() as BigCommerceError;
          const errorDetails = error.errors ? 
            Object.entries(error.errors)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
              .join('; ') : 
            error.detail || error.title;
          
          throw new Error(`BigCommerce API error (${response.status}): ${errorDetails}`);
        }

        const result = await response.json() as BigCommerceResponse;
        if (!result.data?.[0]?.category_id) {
          throw new Error('Invalid response format from BigCommerce API');
        }
        
        logger.info(`Successfully created category "${category.name}" with ID ${result.data[0].category_id}`);
        return result.data[0].category_id;

      } catch (error) {
        logger.error('Error creating category:', {
          categoryName: category.name,
          parentId: category.parent_id,
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    };

    return this.retryWithBackoff(
      () => this.rateLimiter.add(makeRequest),
      retries
    );
  }

  /**
   * Implements exponential backoff retry logic for API calls
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries: number,
    baseDelay = 1000
  ): Promise<T> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === retries - 1) {
          throw error;
        }

        const delay = baseDelay * Math.pow(2, attempt);
        logger.warn(
          `API call failed (attempt ${attempt + 1}/${retries}). Retrying in ${delay}ms`,
          error
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Retry failed'); // TypeScript requires this
  }
} 