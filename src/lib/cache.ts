// Simple in-memory cache for dashboard data
// In production, consider using Redis or similar for better performance

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default

  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache stats
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
export const cache = new SimpleCache();

// Cleanup expired entries every 10 minutes
setInterval(() => {
  cache.cleanup();
}, 10 * 60 * 1000);

// Cache key generators
export const cacheKeys = {
  salesDashboard: (userEmail: string, view: string) => 
    `sales-dashboard-${userEmail}-${view}`,
  topCustomers: (userEmail: string, view: string, limit: number) => 
    `top-customers-${userEmail}-${view}-${limit}`,
  salesTrends: (userEmail: string, view: string) => 
    `sales-trends-${userEmail}-${view}`,
  bagsData: (userEmail: string, view: string, month?: string) => 
    `bags-data-${userEmail}-${view}${month ? `-${month}` : ''}`
};

