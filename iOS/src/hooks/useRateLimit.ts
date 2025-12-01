/**
 * X-Posed Mobile App - Rate Limit Hook
 * Tracks API rate limit status globally with efficient polling
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { XGraphQLAPI } from '../services/XGraphQLAPI';

interface RateLimitStatus {
  isRateLimited: boolean;
  resetTime: number | null;
  remainingMs: number | null;
}

interface UseRateLimitReturn {
  isRateLimited: boolean;
  resetTime: number | null;
  remainingMs: number | null;
  dismissed: boolean;
  dismiss: () => void;
  checkStatus: () => RateLimitStatus;
}

// Polling intervals
const RATE_LIMITED_POLL_MS = 2000;
const NORMAL_POLL_MS = 10000;

/**
 * Hook to track rate limit status globally
 * Uses efficient polling with adaptive intervals
 */
export function useRateLimit(): UseRateLimitReturn {
  const [status, setStatus] = useState<RateLimitStatus>({
    isRateLimited: false,
    resetTime: null,
    remainingMs: null,
  });
  const [dismissed, setDismissed] = useState(false);
  const lastResetTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRateLimitedRef = useRef(false);

  /**
   * Check rate limit status from XGraphQLAPI
   */
  const checkStatus = useCallback((): RateLimitStatus => {
    return XGraphQLAPI.getRateLimitStatus();
  }, []);

  /**
   * Update status by polling XGraphQLAPI
   */
  const updateStatus = useCallback(() => {
    const newStatus = checkStatus();
    
    // If reset time changed (new rate limit), un-dismiss
    if (newStatus.resetTime && newStatus.resetTime !== lastResetTimeRef.current) {
      lastResetTimeRef.current = newStatus.resetTime;
      setDismissed(false);
    }
    
    // If no longer rate limited, reset dismissed state
    if (!newStatus.isRateLimited && isRateLimitedRef.current) {
      lastResetTimeRef.current = null;
      setDismissed(false);
    }
    
    // Track rate limit state change for interval adjustment
    const wasRateLimited = isRateLimitedRef.current;
    isRateLimitedRef.current = newStatus.isRateLimited;
    
    // Adjust polling interval when rate limit state changes
    if (wasRateLimited !== newStatus.isRateLimited && intervalRef.current) {
      clearInterval(intervalRef.current);
      const newInterval = newStatus.isRateLimited ? RATE_LIMITED_POLL_MS : NORMAL_POLL_MS;
      intervalRef.current = setInterval(updateStatus, newInterval);
    }
    
    setStatus(newStatus);
  }, [checkStatus]);

  /**
   * Dismiss the rate limit banner
   */
  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  // Setup polling on mount, cleanup on unmount
  useEffect(() => {
    // Initial check
    updateStatus();
    
    // Start with normal polling interval
    intervalRef.current = setInterval(updateStatus, NORMAL_POLL_MS);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [updateStatus]);

  return {
    isRateLimited: status.isRateLimited && !dismissed,
    resetTime: status.resetTime,
    remainingMs: status.remainingMs,
    dismissed,
    dismiss,
    checkStatus,
  };
}

export default useRateLimit;