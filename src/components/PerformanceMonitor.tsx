"use client";

import { useState, useEffect } from 'react';
import { getCacheStats } from '@/hooks/useDataCache';

interface PerformanceMetrics {
  cacheStats: {
    totalEntries: number;
    expiredEntries: number;
    validEntries: number;
    cacheKeys: string[];
  };
  memoryUsage: number;
  renderTime: number;
  apiCalls: number;
}

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateMetrics = () => {
      const cacheStats = getCacheStats();
      const memoryUsage = (performance as any).memory?.usedJSHeapSize || 0;
      
      setMetrics({
        cacheStats,
        memoryUsage: Math.round(memoryUsage / 1024 / 1024), // Convert to MB
        renderTime: performance.now(),
        apiCalls: 0 // This would need to be tracked separately
      });
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 z-50"
        title="Show Performance Monitor"
      >
        📊
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-80 z-50">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-900">Performance Monitor</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      {metrics && (
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-600">Cache Entries:</span>
            <span className="font-medium">{metrics.cacheStats.validEntries}/{metrics.cacheStats.totalEntries}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Memory Usage:</span>
            <span className="font-medium">{metrics.memoryUsage} MB</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Render Time:</span>
            <span className="font-medium">{Math.round(metrics.renderTime)}ms</span>
          </div>
          
          <div className="pt-2 border-t border-gray-200">
            <div className="text-gray-600 mb-1">Cache Keys:</div>
            <div className="max-h-20 overflow-y-auto">
              {metrics.cacheStats.cacheKeys.map((key, index) => (
                <div key={index} className="text-gray-500 truncate">
                  {key}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

