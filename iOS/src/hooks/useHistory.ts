/**
 * X-Posed Mobile App - History Hook
 * Manages lookup history with AsyncStorage persistence
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HistoryEntry, LocationEntry, LookupMode } from '../types';

// Storage key
const HISTORY_STORAGE_KEY = 'x_posed_lookup_history';

// Maximum history entries (increased for batch scans)
const MAX_HISTORY_ENTRIES = 2000;

// Debounce delay for saving to storage
const SAVE_DEBOUNCE_MS = 500;

interface UseHistoryReturn {
  history: HistoryEntry[];
  loading: boolean;
  addToHistory: (username: string, data: LocationEntry, mode: LookupMode) => Promise<void>;
  clearHistory: () => Promise<void>;
  removeFromHistory: (username: string) => Promise<void>;
  getRecentUsernames: (limit?: number) => string[];
}

/**
 * History Hook with debounced persistence
 */
export function useHistory(): UseHistoryReturn {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<HistoryEntry[] | null>(null);

  /**
   * Load history from AsyncStorage
   */
  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const stored = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
      
      if (stored) {
        const parsed: HistoryEntry[] = JSON.parse(stored);
        // Sort by most recent first
        parsed.sort((a, b) => b.lookupTime - a.lookupTime);
        setHistory(parsed);
      }
    } catch {
      // Silent fail - use empty history
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Load history from storage on mount
   */
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  /**
   * Cleanup pending save on unmount
   */
  useEffect(() => {
    return () => {
      // Flush pending save on unmount
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        if (pendingSaveRef.current) {
          AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(pendingSaveRef.current)).catch(() => {});
        }
      }
    };
  }, []);

  /**
   * Save history to AsyncStorage with debouncing
   */
  const saveHistory = useCallback((entries: HistoryEntry[]) => {
    pendingSaveRef.current = entries;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        if (pendingSaveRef.current) {
          await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(pendingSaveRef.current));
          pendingSaveRef.current = null;
        }
      } catch {
        // Silent fail
      }
    }, SAVE_DEBOUNCE_MS);
  }, []);

  /**
   * Add entry to history
   */
  const addToHistory = useCallback(async (
    username: string,
    data: LocationEntry,
    mode: LookupMode
  ) => {
    try {
      const entry: HistoryEntry = {
        username: username.toLowerCase(),
        data,
        lookupTime: Date.now(),
        mode,
      };

      // Update history (remove duplicates, add new entry at start)
      setHistory(prev => {
        // Filter out existing entry for this username
        const filtered = prev.filter(
          e => e.username.toLowerCase() !== username.toLowerCase()
        );
        
        // Add new entry at the beginning
        const updated = [entry, ...filtered];
        
        // Limit to max entries
        const limited = updated.slice(0, MAX_HISTORY_ENTRIES);
        
        // Save to storage (async, don't await)
        saveHistory(limited);
        
        return limited;
      });
    } catch (error) {
      // Silent fail
    }
  }, [saveHistory]);

  /**
   * Clear all history
   */
  const clearHistory = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(HISTORY_STORAGE_KEY);
      setHistory([]);
    } catch (error) {
      throw error;
    }
  }, []);

  /**
   * Remove specific entry from history
   */
  const removeFromHistory = useCallback(async (username: string) => {
    try {
      setHistory(prev => {
        const filtered = prev.filter(
          e => e.username.toLowerCase() !== username.toLowerCase()
        );
        
        // Save to storage
        saveHistory(filtered);
        
        return filtered;
      });
    } catch (error) {
      throw error;
    }
  }, [saveHistory]);

  /**
   * Get recent usernames for suggestions
   */
  const getRecentUsernames = useCallback((limit: number = 10): string[] => {
    return history
      .slice(0, limit)
      .map(entry => entry.username);
  }, [history]);

  return {
    history,
    loading,
    addToHistory,
    clearHistory,
    removeFromHistory,
    getRecentUsernames,
  };
}

export default useHistory;