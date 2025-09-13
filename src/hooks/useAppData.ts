import { useState, useEffect, useCallback } from 'react';
import { useDataCache } from './useDataCache';

interface AppData {
  inquiries: any[];
  orders: any[];
  quotes: any[];
  users: any[];
  customers: any[];
  salesData: any;
  topCustomers: any[];
}

interface UseAppDataOptions {
  userEmail?: string;
  enabled?: boolean;
}

export function useAppData({ userEmail, enabled = true }: UseAppDataOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Individual data caches
  const inquiries = useDataCache({
    cacheKey: 'inquiries',
    fetchFn: () => fetch('/api/inquiries').then(res => res.json()),
    ttl: 2 * 60 * 1000, // 2 minutes
    enabled
  });

  const orders = useDataCache({
    cacheKey: 'orders',
    fetchFn: () => fetch('/api/orders').then(res => res.json()),
    ttl: 5 * 60 * 1000, // 5 minutes
    enabled
  });

  const users = useDataCache({
    cacheKey: 'users',
    fetchFn: () => fetch('/api/users').then(res => res.json()),
    ttl: 10 * 60 * 1000, // 10 minutes (users change rarely)
    enabled
  });

  const quotes = useDataCache({
    cacheKey: `quotes-${userEmail}`,
    fetchFn: () => fetch(`/api/quotes?assignedTo=${encodeURIComponent(userEmail || '')}`).then(res => res.json()),
    ttl: 2 * 60 * 1000, // 2 minutes
    enabled: enabled && !!userEmail
  });

  const customers = useDataCache({
    cacheKey: 'customers',
    fetchFn: () => fetch('/api/customers').then(res => res.json()),
    ttl: 5 * 60 * 1000, // 5 minutes
    enabled
  });

  const salesData = useDataCache({
    cacheKey: `sales-${userEmail}`,
    fetchFn: () => fetch(`/api/sales/dashboard?userEmail=${userEmail}&view=personal&_t=${Date.now()}`).then(res => res.json()),
    ttl: 3 * 60 * 1000, // 3 minutes
    enabled: enabled && !!userEmail
  });

  const topCustomers = useDataCache({
    cacheKey: `top-customers-${userEmail}`,
    fetchFn: () => fetch(`/api/sales/top-customers?userEmail=${userEmail}&view=personal&limit=50&_t=${Date.now()}`).then(res => res.json()),
    ttl: 5 * 60 * 1000, // 5 minutes
    enabled: enabled && !!userEmail
  });

  // Combined loading state
  const isLoading = inquiries.loading || orders.loading || users.loading || 
                   (userEmail && (quotes.loading || salesData.loading || topCustomers.loading));

  // Combined error state
  const hasError = inquiries.error || orders.error || users.error || 
                  (userEmail && (quotes.error || salesData.error || topCustomers.error));

  // Refresh all data
  const refreshAll = useCallback(() => {
    inquiries.refresh();
    orders.refresh();
    users.refresh();
    if (userEmail) {
      quotes.refresh();
      salesData.refresh();
      topCustomers.refresh();
    }
  }, [inquiries, orders, users, quotes, salesData, topCustomers, userEmail]);

  // Invalidate all cache
  const invalidateAll = useCallback(() => {
    inquiries.invalidateCache();
    orders.invalidateCache();
    users.invalidateCache();
    if (userEmail) {
      quotes.invalidateCache();
      salesData.invalidateCache();
      topCustomers.invalidateCache();
    }
  }, [inquiries, orders, users, quotes, salesData, topCustomers, userEmail]);

  return {
    data: {
      inquiries: inquiries.data || [],
      orders: orders.data || [],
      quotes: quotes.data || [],
      users: users.data || [],
      customers: customers.data || [],
      salesData: salesData.data?.personal || null,
      topCustomers: topCustomers.data?.topCustomers || []
    },
    loading: isLoading,
    error: hasError,
    refreshAll,
    invalidateAll,
    // Individual refresh functions
    refreshInquiries: inquiries.refresh,
    refreshOrders: orders.refresh,
    refreshQuotes: quotes.refresh,
    refreshUsers: users.refresh,
    refreshCustomers: customers.refresh,
    refreshSalesData: salesData.refresh,
    refreshTopCustomers: topCustomers.refresh
  };
}

