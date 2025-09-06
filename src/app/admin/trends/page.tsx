"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

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
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Sales Trends</h2>
            <div className="space-y-4">
              {trendData.map((month, index) => (
                <div 
                  key={month.period}
                  className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handlePeriodClick(month.period)}
                >
                  <div className="flex items-center justify-between mb-2">
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
                  
                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${(month.totalSales / Math.max(...trendData.map(m => m.totalSales))) * 100}%` 
                      }}
                    ></div>
                  </div>

                  {/* Top SKUs */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {month.skuBreakdown.slice(0, 4).map((sku) => (
                      <div 
                        key={sku.sku}
                        className="text-xs bg-gray-100 rounded px-2 py-1 hover:bg-blue-100 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSkuClick(sku.sku);
                        }}
                      >
                        <div className="font-medium truncate">{sku.sku}</div>
                        <div className="text-gray-500">{formatNumber(sku.quantity)}</div>
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
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Weekly Breakdown: {selectedPeriod}
            </h2>
            <div className="space-y-3">
              {weeklyData.map((week, index) => (
                <div key={week.week} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">{week.week}</h3>
                    <div className="text-right">
                      <div className="font-semibold text-green-600">
                        {formatCurrency(week.totalSales)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatNumber(week.totalQuantity)} units
                      </div>
                    </div>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
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
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              SKU Performance: {selectedSku}
            </h2>
            <div className="space-y-4">
              {trendData.map((month) => {
                const skuData = month.skuBreakdown.find(sku => sku.sku === selectedSku);
                if (!skuData) return null;
                
                return (
                  <div key={month.period} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
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
                    
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
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

        {/* Summary Stats */}
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
      </div>
    </div>
  );
}
