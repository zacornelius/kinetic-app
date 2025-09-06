"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [viewMode, setViewMode] = useState<"monthly" | "weekly" | "sku">("monthly");
  const [selectedSku, setSelectedSku] = useState<string>("");
  const [timeRange, setTimeRange] = useState<"6months" | "12months" | "24months">("12months");

  useEffect(() => {
    loadTrendData();
  }, [timeRange]);

  const loadTrendData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/trends?range=${timeRange}`);
      const data = await response.json();
      setTrendData(data);
    } catch (error) {
      console.error("Error loading trend data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadWeeklyData = async (period: string) => {
    try {
      const response = await fetch(`/api/trends/weekly?period=${period}`);
      const data = await response.json();
      setWeeklyData(data);
    } catch (error) {
      console.error("Error loading weekly data:", error);
    }
  };

  const handlePeriodClick = (period: string) => {
    setSelectedPeriod(period);
    setViewMode("weekly");
    loadWeeklyData(period);
  };

  const handleSkuClick = (sku: string) => {
    setSelectedSku(sku);
    setViewMode("sku");
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
    const labels = trendData.map(item => item.period);
    const salesData = trendData.map(item => item.totalSales);
    const quantityData = trendData.map(item => item.totalQuantity);
    
    // Get all unique SKUs across all periods
    const allSkus = new Set<string>();
    trendData.forEach(period => {
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
        data: trendData.map(period => {
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
        text: 'Monthly Sales Trends',
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
        text: 'Monthly Quantity Trends',
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
        text: 'Top SKU Performance Over Time',
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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

      <div className="p-4 space-y-6">
        {/* Summary Stats - Moved to Top */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-gray-500">Total Sales</div>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(trendData.reduce((sum, month) => sum + month.totalSales, 0))}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-gray-500">Total Units</div>
            <div className="text-2xl font-bold text-blue-600">
              {formatNumber(trendData.reduce((sum, month) => sum + month.totalQuantity, 0))}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-gray-500">Average per Month</div>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(trendData.length > 0 ? trendData.reduce((sum, month) => sum + month.totalSales, 0) / trendData.length : 0)}
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
                <option value="6months">6 Months</option>
                <option value="12months">12 Months</option>
                <option value="24months">24 Months</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">View:</label>
              <div className="flex bg-gray-100 rounded-md p-1">
                <button
                  onClick={() => setViewMode("monthly")}
                  className={`px-3 py-1 text-sm rounded ${
                    viewMode === "monthly" 
                      ? "bg-white shadow-sm text-blue-600" 
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setViewMode("weekly")}
                  className={`px-3 py-1 text-sm rounded ${
                    viewMode === "weekly" 
                      ? "bg-white shadow-sm text-blue-600" 
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                  disabled={!selectedPeriod}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setViewMode("sku")}
                  className={`px-3 py-1 text-sm rounded ${
                    viewMode === "sku" 
                      ? "bg-white shadow-sm text-blue-600" 
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                  disabled={!selectedSku}
                >
                  SKU Detail
                </button>
              </div>
            </div>

            {viewMode === "weekly" && selectedPeriod && (
              <div className="text-sm text-gray-600">
                Showing weeks for: <span className="font-medium">{selectedPeriod}</span>
              </div>
            )}

            {viewMode === "sku" && selectedSku && (
              <div className="text-sm text-gray-600">
                Showing detail for: <span className="font-medium">{selectedSku}</span>
              </div>
            )}
          </div>
        </div>

        {/* Monthly View */}
        {viewMode === "monthly" && (
          <div className="space-y-6">
            {/* Two Column Chart Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sales Trend Chart */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Sales Trends</h2>
                <div className="h-96">
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

              {/* Quantity Trend Chart */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Quantity Trends</h2>
                <div className="h-96">
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
            </div>

            {/* SKU Performance Chart - Full Width */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Top SKU Performance Over Time</h2>
              <div className="h-96">
                <Line 
                  data={{
                    labels: chartData.labels,
                    datasets: chartData.skuDatasets
                  }}
                  options={skuChartOptions}
                />
              </div>
            </div>

            {/* Monthly Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trendData.map((month, index) => (
                <div 
                  key={month.period}
                  className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md cursor-pointer transition-shadow"
                  onClick={() => handlePeriodClick(month.period)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900">{month.period}</h3>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-green-600">
                        {formatCurrency(month.totalSales)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatNumber(month.totalQuantity)} units
                      </div>
                    </div>
                  </div>
                  
                  {/* All SKUs */}
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {month.skuBreakdown.map((sku) => (
                      <div 
                        key={sku.sku}
                        className="flex justify-between text-xs hover:bg-gray-50 cursor-pointer p-1 rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSkuClick(sku.sku);
                        }}
                      >
                        <span className="truncate">{sku.sku}</span>
                        <span className="text-gray-500">{formatNumber(sku.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weekly View */}
        {viewMode === "weekly" && (
          <div className="space-y-6">
            {/* Weekly Sales Chart */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Weekly Breakdown: {selectedPeriod}
              </h2>
              <div className="h-96">
                <Bar 
                  data={{
                    labels: weeklyData.map(w => w.week),
                    datasets: [{
                      label: 'Sales',
                      data: weeklyData.map(w => w.totalSales),
                      backgroundColor: 'rgba(59, 130, 246, 0.8)',
                      borderColor: 'rgb(59, 130, 246)',
                      borderWidth: 1,
                    }]
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: {
                        position: 'top' as const,
                      },
                      title: {
                        display: true,
                        text: 'Weekly Sales',
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
                  }}
                />
              </div>
            </div>

            {/* Weekly Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {weeklyData.map((week, index) => (
                <div key={week.week} className="bg-white rounded-lg shadow-sm p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900 text-sm">{week.week}</h3>
                    <div className="text-right">
                      <div className="font-semibold text-green-600">
                        {formatCurrency(week.totalSales)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatNumber(week.totalQuantity)} units
                      </div>
                    </div>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="bg-gradient-to-r from-blue-400 to-green-400 h-1.5 rounded-full"
                      style={{ 
                        width: `${(week.totalSales / Math.max(...weeklyData.map(w => w.totalSales))) * 100}%` 
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SKU Detail View */}
        {viewMode === "sku" && (
          <div className="space-y-6">
            {/* SKU Performance Chart */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                SKU Performance: {selectedSku}
              </h2>
              <div className="h-96">
                <Line 
                  data={{
                    labels: trendData.map(m => m.period),
                    datasets: [{
                      label: selectedSku,
                      data: trendData.map(month => {
                        const skuData = month.skuBreakdown.find(sku => sku.sku === selectedSku);
                        return skuData ? skuData.quantity : 0;
                      }),
                      borderColor: 'rgb(139, 92, 246)',
                      backgroundColor: 'rgba(139, 92, 246, 0.1)',
                      fill: true,
                      tension: 0.1,
                    }]
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: {
                        position: 'top' as const,
                      },
                      title: {
                        display: true,
                        text: `${selectedSku} Performance Over Time`,
                      },
                      tooltip: {
                        callbacks: {
                          label: function(context: any) {
                            const month = trendData[context.dataIndex];
                            const skuData = month.skuBreakdown.find(sku => sku.sku === selectedSku);
                            return [
                              `Quantity: ${formatNumber(context.parsed.y)} units`,
                              `Sales: ${formatCurrency(skuData?.sales || 0)}`
                            ];
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
                  }}
                />
              </div>
            </div>

            {/* SKU Monthly Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trendData.map((month) => {
                const skuData = month.skuBreakdown.find(sku => sku.sku === selectedSku);
                if (!skuData) return null;
                
                return (
                  <div key={month.period} className="bg-white rounded-lg shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-gray-900">{month.period}</h3>
                      <div className="text-right">
                        <div className="font-semibold text-green-600">
                          {formatCurrency(skuData.sales)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatNumber(skuData.quantity)} units
                        </div>
                      </div>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className="bg-gradient-to-r from-purple-400 to-pink-400 h-1.5 rounded-full"
                        style={{ 
                          width: `${(skuData.quantity / Math.max(...trendData.map(m => {
                            const sku = m.skuBreakdown.find(s => s.sku === selectedSku);
                            return sku ? sku.quantity : 0;
                          }))) * 100}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
