"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface TrendData {
  period: string;
  totalSales: number;
  totalQuantity: number;
  skuBreakdown: {
    sku: string;
    quantity: number;
    sales: number;
  }[];
}

interface WeeklyData {
  week: string;
  totalSales: number;
  totalQuantity: number;
  skuBreakdown: {
    sku: string;
    quantity: number;
    sales: number;
  }[];
}


export default function TrendsPage() {
  const { user, logout } = useAuth();
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"3months" | "6months" | "12months" | "24months">("12months");

  useEffect(() => {
    loadTrendData();
  }, [timeRange]);

  const loadTrendData = async () => {
    setLoading(true);
    try {
      if (timeRange === "3months") {
        // For 3 months, load weekly data
        const response = await fetch(`/api/trends/weekly?range=3months`);
        const data = await response.json();
        setWeeklyData(data);
        setTrendData([]); // Clear monthly data
      } else {
        // For other ranges, load monthly data
        const response = await fetch(`/api/trends?range=${timeRange}`);
        const data = await response.json();
        setTrendData(data);
        setWeeklyData([]); // Clear weekly data
      }
    } catch (error) {
      console.error("Error loading trend data:", error);
    } finally {
      setLoading(false);
    }
  };


  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  // Prepare chart data
  const prepareChartData = () => {
    const isWeekly = timeRange === "3months";
    const data = isWeekly ? weeklyData : trendData;
    
    const labels = data.map(item => isWeekly ? item.week : item.period);
    const salesData = data.map(item => item.totalSales);
    const quantityData = data.map(item => item.totalQuantity);
    
    // Get all unique SKUs across all periods
    const allSkus = new Set<string>();
    data.forEach(period => {
      period.skuBreakdown.forEach(sku => allSkus.add(sku.sku));
    });
    
    // Create SKU datasets
    const skuDatasets = Array.from(allSkus).slice(0, 5).map((sku, index) => {
      const colors = [
        'rgb(59, 130, 246)',   // Blue
        'rgb(16, 185, 129)',   // Green
        'rgb(245, 101, 101)',  // Red
        'rgb(251, 191, 36)',   // Yellow
        'rgb(139, 92, 246)',   // Purple
      ];
      
      return {
        label: sku,
        data: data.map(period => {
          const skuData = period.skuBreakdown.find(s => s.sku === sku);
          return skuData ? skuData.quantity : 0;
        }),
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length] + '20',
        fill: false,
        tension: 0.1,
      };
    });

    return {
      labels,
      salesData,
      quantityData,
      skuDatasets,
      isWeekly,
    };
  };

  const chartData = prepareChartData();

  const salesChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: chartData.isWeekly ? 'Weekly Sales Trends' : 'Monthly Sales Trends',
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `Sales: ${formatCurrency(context.parsed.y)}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: any) {
            return formatCurrency(value);
          }
        }
      }
    }
  };

  const quantityChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: chartData.isWeekly ? 'Weekly Quantity Trends' : 'Monthly Quantity Trends',
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `Quantity: ${formatNumber(context.parsed.y)} units`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: any) {
            return formatNumber(value);
          }
        }
      }
    }
  };

  const skuChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: chartData.isWeekly ? 'Top SKU Performance (Weekly)' : 'Top SKU Performance Over Time',
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `${context.dataset.label}: ${formatNumber(context.parsed.y)} units`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: any) {
            return formatNumber(value);
          }
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold text-gray-900">Sales Trends</h1>
              <Link 
                href="/admin" 
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Back to Admin
              </Link>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute adminOnly={true}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold text-gray-900">Sales Trends</h1>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  {user?.firstName} {user?.lastName}
                </span>
                <Link 
                  href="/admin" 
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  Back to Admin
                </Link>
                <button
                  onClick={logout}
                  className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>

      <div className="p-4 space-y-6">
        {/* Summary Stats - Moved to Top */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-gray-500">Total Sales</div>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(chartData.isWeekly 
                ? weeklyData.reduce((sum, week) => sum + week.totalSales, 0)
                : trendData.reduce((sum, month) => sum + month.totalSales, 0)
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-gray-500">Total Units</div>
            <div className="text-2xl font-bold text-blue-600">
              {formatNumber(chartData.isWeekly 
                ? weeklyData.reduce((sum, week) => sum + week.totalQuantity, 0)
                : trendData.reduce((sum, month) => sum + month.totalQuantity, 0)
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-gray-500">
              {chartData.isWeekly ? 'Average per Week' : 'Average per Month'}
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(chartData.isWeekly 
                ? (weeklyData.length > 0 ? weeklyData.reduce((sum, week) => sum + week.totalSales, 0) / weeklyData.length : 0)
                : (trendData.length > 0 ? trendData.reduce((sum, month) => sum + month.totalSales, 0) / trendData.length : 0)
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Time Range:</label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="border rounded-md px-3 py-1 text-sm"
              >
                <option value="3months">3 Months (Weekly)</option>
                <option value="6months">6 Months</option>
                <option value="12months">12 Months</option>
                <option value="24months">24 Months</option>
              </select>
            </div>
            
          </div>
        </div>

        {/* 4 Core Containers Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Container 1: Sales Trend Chart */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {chartData.isWeekly ? 'Weekly Sales Trends' : 'Monthly Sales Trends'}
            </h2>
            <div className="h-80">
              <Line 
                data={{
                  labels: chartData.labels,
                  datasets: [{
                    label: 'Sales',
                    data: chartData.salesData,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.1,
                  }]
                }}
                options={salesChartOptions}
              />
            </div>
          </div>

          {/* Container 2: Quantity Trend Chart */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {chartData.isWeekly ? 'Weekly Quantity Trends' : 'Monthly Quantity Trends'}
            </h2>
            <div className="h-80">
              <Bar 
                data={{
                  labels: chartData.labels,
                  datasets: [{
                    label: 'Units Sold',
                    data: chartData.quantityData,
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    borderColor: 'rgb(16, 185, 129)',
                    borderWidth: 1,
                  }]
                }}
                options={quantityChartOptions}
              />
            </div>
          </div>

          {/* Container 3: SKU Performance Chart */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {chartData.isWeekly ? 'Top SKU Performance (Weekly)' : 'Top SKU Performance Over Time'}
            </h2>
            <div className="h-80">
              <Line 
                data={{
                  labels: chartData.labels,
                  datasets: chartData.skuDatasets
                }}
                options={skuChartOptions}
              />
            </div>
          </div>

          {/* Container 4: Detail Cards - Scrollable */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {chartData.isWeekly ? 'Weekly Details' : 'Monthly Details'}
            </h2>
            <div className="h-80 overflow-y-auto space-y-3 pr-2">
              {(chartData.isWeekly ? weeklyData : trendData).map((period, index) => (
                <div 
                  key={chartData.isWeekly ? period.week : period.period}
                  className="border rounded-lg p-3 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900 text-sm">
                      {chartData.isWeekly ? period.week : period.period}
                    </h3>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-green-600">
                        {formatCurrency(period.totalSales)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatNumber(period.totalQuantity)} units
                      </div>
                    </div>
                  </div>
                  
                  {/* All SKUs - Compact */}
                  <div className="space-y-1 max-h-20 overflow-y-auto">
                    {period.skuBreakdown.map((sku) => (
                      <div 
                        key={sku.sku}
                        className="flex justify-between text-xs hover:bg-gray-50 p-1 rounded"
                      >
                        <span className="truncate text-xs">{sku.sku}</span>
                        <span className="text-gray-500 text-xs">{formatNumber(sku.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>


      </div>
      </div>
    </ProtectedRoute>
  );
}
