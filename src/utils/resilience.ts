import { AxiosError } from 'axios';

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000,
  onRetry?: (error: any, attempt: number) => void
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry if it's a 4xx error (except 429)
      if (error instanceof AxiosError && error.response && error.response.status >= 400 && error.response.status < 500 && error.response.status !== 429) {
        throw error;
      }

      if (attempt === maxRetries - 1) break;

      const delay = initialDelay * Math.pow(2, attempt);
      if (onRetry) onRetry(error, attempt + 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

export class LogThrottler {
  private static logs = new Map<string, number>();
  private static THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

  static shouldLog(key: string): boolean {
    const now = Date.now();
    const lastLog = this.logs.get(key) || 0;
    
    if (now - lastLog > this.THROTTLE_MS) {
      this.logs.set(key, now);
      return true;
    }
    return false;
  }
}
