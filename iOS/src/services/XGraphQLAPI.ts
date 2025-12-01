/**
 * X-Posed Mobile App - X GraphQL API Service
 * Handles live lookups directly from X's GraphQL API
 */

import { LocationEntry, Session, GraphQLResponse, BatchLookupResult, APIError } from '../types';

// X GraphQL API Configuration
const API_CONFIG = {
  QUERY_ID: 'XRqGa7EeokUU5kppkh13EA',
  BASE_URL: 'https://x.com/i/api/graphql',
  BEARER_TOKEN: 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
  TIMEOUT_MS: 10000,
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 3000,
  MIN_INTERVAL_MS: 300,
};

// Error codes
const API_ERROR_CODES = {
  NO_SESSION: 'NO_SESSION',
  RATE_LIMITED: 'RATE_LIMITED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  UNKNOWN: 'UNKNOWN',
} as const;

/**
 * X GraphQL API Service
 * Provides live lookups for any X user (requires authentication)
 */
export class XGraphQLAPI {
  private static lastRequestTime = 0;
  private static rateLimitReset = 0;
  private static consecutiveFailures = 0;

  /**
   * Check if rate limited
   */
  private static isRateLimited(): boolean {
    return Date.now() < this.rateLimitReset;
  }

  /**
   * Enforce minimum interval between requests
   */
  private static async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLast = now - this.lastRequestTime;
    
    if (timeSinceLast < API_CONFIG.MIN_INTERVAL_MS) {
      await new Promise<void>(resolve => 
        setTimeout(resolve, API_CONFIG.MIN_INTERVAL_MS - timeSinceLast)
      );
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Build request headers
   */
  private static buildHeaders(authToken: string, csrfToken: string): Record<string, string> {
    return {
      'authorization': `Bearer ${API_CONFIG.BEARER_TOKEN}`,
      'x-csrf-token': csrfToken,
      'x-twitter-active-user': 'yes',
      'x-twitter-auth-type': 'OAuth2Session',
      'content-type': 'application/json',
      'accept-language': 'en-US,en;q=0.9',
      'cookie': `auth_token=${authToken}; ct0=${csrfToken}`,
    };
  }

  /**
   * Build API URL with variables
   */
  private static buildUrl(screenName: string): string {
    const variables = JSON.stringify({ screenName });
    return `${API_CONFIG.BASE_URL}/${API_CONFIG.QUERY_ID}/AboutAccountQuery?variables=${encodeURIComponent(variables)}`;
  }

  /**
   * Parse API response
   */
  private static parseResponse(data: GraphQLResponse, username: string): LocationEntry | null {
    try {
      const profile = data?.data?.user_result_by_screen_name?.result?.about_profile;
      
      if (!profile) {
        return null;
      }

      return {
        location: profile.account_based_in || '',
        device: profile.source || '',
        isAccurate: profile.location_accurate !== false,
        timestamp: Date.now(),
        fromCloud: false,
        username: username.toLowerCase(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Handle error responses
   */
  private static handleError(status: number, response?: Response): APIError {
    switch (status) {
      case 401:
      case 403:
        return {
          code: 'UNAUTHORIZED',
          message: 'Authentication failed. Please re-login.',
          statusCode: status,
        };
      case 404:
        return {
          code: 'NOT_FOUND',
          message: 'User not found',
          statusCode: status,
        };
      case 429:
        // Parse x-rate-limit-reset header (Unix timestamp in seconds)
        let retryAfter = Date.now() + 60000; // Default 60 seconds
        
        if (response) {
          const resetHeader = response.headers.get('x-rate-limit-reset');
          if (resetHeader) {
            // Header is Unix timestamp in seconds, convert to milliseconds
            const resetTimestamp = parseInt(resetHeader, 10) * 1000;
            if (!isNaN(resetTimestamp) && resetTimestamp > Date.now()) {
              retryAfter = resetTimestamp;
            }
          }
        }
        
        this.rateLimitReset = retryAfter;
        const waitMinutes = Math.ceil((retryAfter - Date.now()) / 60000);
        
        return {
          code: 'RATE_LIMITED',
          message: `Rate limit exceeded. Retry in ${waitMinutes} minute(s).`,
          statusCode: status,
          retryAfter,
        };
      default:
        return {
          code: 'UNKNOWN',
          message: `API error: ${status}`,
          statusCode: status,
        };
    }
  }

  /**
   * Fetch user info from X GraphQL API (single user)
   * @param username - X username without @
   * @param session - Authentication session
   * @returns LocationEntry or null
   */
  static async fetchUserInfo(
    username: string,
    session: Session
  ): Promise<LocationEntry | null> {
    // Validate session
    if (!session || !session.authToken || !session.csrfToken) {
      return null;
    }

    // Check rate limit
    if (this.isRateLimited()) {
      return null;
    }

    // Enforce rate limit
    await this.enforceRateLimit();

    try {
      const url = this.buildUrl(username);
      const headers = this.buildHeaders(session.authToken, session.csrfToken);

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT_MS);

      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = this.handleError(response.status, response);
        
        if (error.code === 'RATE_LIMITED') {
          this.consecutiveFailures++;
        }
        
        return null;
      }

      // Reset failure count on success
      this.consecutiveFailures = 0;

      const data: GraphQLResponse = await response.json();

      return this.parseResponse(data, username);
    } catch {
      this.consecutiveFailures++;
      return null;
    }
  }

  /**
   * Fetch user info with Simple API (backward compatibility)
   */
  static async lookup(
    username: string,
    authToken: string,
    csrfToken: string
  ): Promise<LocationEntry | null> {
    const session: Session = {
      authToken,
      csrfToken,
      isAuthenticated: true,
    };
    return this.fetchUserInfo(username, session);
  }

  /**
   * Batch lookup multiple users
   * Note: X API doesn't support batch, so we query sequentially with rate limiting
   * @param usernames - Array of usernames
   * @param session - Authentication session
   * @param onProgress - Optional progress callback
   * @returns Map of username to LocationEntry
   */
  static async lookupBatch(
    usernames: string[],
    session: Session,
    onProgress?: (completed: number, total: number, current: string) => void
  ): Promise<Map<string, LocationEntry>> {
    const results = new Map<string, LocationEntry>();
    
    if (!usernames || usernames.length === 0) {
      return results;
    }

    // Validate session
    if (!session || !session.authToken || !session.csrfToken) {
      return results;
    }

    for (let i = 0; i < usernames.length; i++) {
      const username = usernames[i];
      
      // Report progress
      if (onProgress) {
        onProgress(i, usernames.length, username);
      }

      // Check rate limit before each request
      if (this.isRateLimited()) {
        break;
      }

      const result = await this.fetchUserInfo(username, session);
      
      if (result) {
        results.set(username.toLowerCase(), result);
      }

      // Add delay between requests to avoid rate limiting
      if (i < usernames.length - 1) {
        await new Promise<void>(resolve => setTimeout(resolve, API_CONFIG.MIN_INTERVAL_MS * 2));
      }
    }

    return results;
  }

  /**
   * Batch lookup with detailed results
   */
  static async lookupBatchWithDetails(
    usernames: string[],
    session: Session,
    onProgress?: (completed: number, total: number, current: string) => void
  ): Promise<BatchLookupResult[]> {
    const resultsMap = await this.lookupBatch(usernames, session, onProgress);
    
    return usernames.map(username => {
      const data = resultsMap.get(username.toLowerCase()) || null;
      return {
        username,
        data,
        error: data ? undefined : 'Not found or failed',
      };
    });
  }

  /**
   * Get rate limit status
   */
  static getRateLimitStatus(): { isRateLimited: boolean; resetTime: number | null; remainingMs: number | null } {
    const now = Date.now();
    const isRateLimited = this.rateLimitReset > now;
    
    return {
      isRateLimited,
      resetTime: isRateLimited ? this.rateLimitReset : null,
      remainingMs: isRateLimited ? this.rateLimitReset - now : null,
    };
  }

  /**
   * Clear rate limit (useful for testing)
   */
  static clearRateLimit(): void {
    this.rateLimitReset = 0;
    this.consecutiveFailures = 0;
  }
}

export default XGraphQLAPI;
