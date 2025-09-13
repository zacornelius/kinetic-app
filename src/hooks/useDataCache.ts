import { useState, useEffect, useCallback } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface UseDataCacheOptions {
  cacheKey: string;
  fetchFn: () => Promise<any>;
  ttl?: number; // Time to live in milliseconds
  enabled?: boolean;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes default
const cache = new Map<string, CacheEntry<any>>();

export function useDataCache<T>({
  cacheKey,
  fetchFn,
  ttl = CACHE_TTL,
  enabled = true
}: UseDataCacheOptions) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const isExpired = (entry: CacheEntry<T>): boolean => {
    return Date.now() > entry.expiresAt;
  };

  const getCachedData = useCallback((): T | null => {
    const entry = cache.get(cacheKey);
    if (entry && !isExpired(entry)) {
      return entry.data;
    }
    return null;
  }, [cacheKey]);

  const setCachedData = useCallback((newData: T) => {
    const entry: CacheEntry<T> = {
      data: newData,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl
    };
    cache.set(cacheKey, entry);
  }, [cacheKey, ttl]);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!enabled) return;

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedData = getCachedData();
      if (cachedData) {
        setData(cachedData);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchFn();
      setData(result);
      setCachedData(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      console.error(`Error fetching data for ${cacheKey}:`, error);
    } finally {
      setLoading(false);
    }
  }, [cacheKey, fetchFn, enabled, getCachedData, setCachedData]);

  const invalidateCache = useCallback(() => {
    cache.delete(cacheKey);
  }, [cacheKey]);

  const refresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refresh,
    invalidateCache
  };
}

// Utility function to clear all cache
export const clearAllCache = () => {
  cache.clear();
};

// Utility function to get cache stats
export const getCacheStats = () => {
  const now = Date.now();
  const entries = Array.from(cache.entries());
  
  return {
    totalEntries: entries.length,
    expiredEntries: entries.filter(([_, entry]) => now > entry.expiresAt).length,
    validEntries: entries.filter(([_, entry]) => now <= entry.expiresAt).length,
    cacheKeys: entries.map(([key, _]) => key)
  };
};

