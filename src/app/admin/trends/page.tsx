"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import ProfileDropdown from "@/components/ProfileDropdown";
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

// SKU Grid Component
const SKUGrid = ({ data }: { data: TrendData[] }) => {
  // Get all unique SKUs across all periods and normalize them
  const skuMap = new Map<string, { displayName: string; totalQuantity: number }>();
  
  data.forEach(period => {
    period.skuBreakdown.forEach(sku => {
      // Normalize SKU names to group equivalent SKUs
      const normalizedSku = normalizeSkuName(sku.sku);
      const existing = skuMap.get(normalizedSku);
      
      if (existing) {
        existing.totalQuantity += sku.quantity;
        // Keep the shorter display name if available
        if (sku.sku.length < existing.displayName.length) {
          existing.displayName = sku.sku;
        }
      } else {
        skuMap.set(normalizedSku, {
          displayName: sku.sku,
          totalQuantity: sku.quantity
        });
      }
    });
  });
  
  // Sort by total quantity and take top 10
  const skuList = Array.from(skuMap.entries())
    .sort((a, b) => b[1].totalQuantity - a[1].totalQuantity)
    .slice(0, 10)
    .map(([normalized, data]) => ({ normalized, displayName: data.displayName }));
  
  // Function to normalize SKU names
  function normalizeSkuName(sku: string): string {
    const skuLower = sku.toLowerCase();
    // Map equivalent SKUs to the same normalized name
    if (skuLower.includes('active') || sku === '26k') return '26k';
    if (skuLower.includes('power') || sku === '30k') return '30k';
    if (skuLower.includes('puppy') || sku === '28k') return '28k';
    if (skuLower.includes('ultra') || sku === '32k') return '32k';
    if (skuLower.includes('vital') || sku === '24k') return '24k';
    return sku.toLowerCase();
  }
  
  // Get SKU color mapping function
  const getSkuColor = (normalizedSku: string) => {
    // Use normalized SKU for color mapping
    if (normalizedSku === '26k') return '#5BAB56';  // Green for Active/26K
    if (normalizedSku === '30k') return '#915A9D';  // Purple for Power/30K
    if (normalizedSku === '28k') return '#3B83BE';  // Blue for Puppy/28K
    if (normalizedSku === '32k') return '#C43C37';  // Red for Ultra/32K
    if (normalizedSku === '24k') return '#D7923E';  // Yellow for Vital/24K
    // Default fallback colors
    const defaultColors = ['#5BAB56', '#3B83BE', '#D7923E', '#915A9D', '#C43C37'];
    return defaultColors[skuList.findIndex(s => s.normalized === normalizedSku) % defaultColors.length];
  };
  
  // Calculate min/max quantities for each SKU for color scaling
  const skuStats = skuList.map(({ normalized, displayName }) => {
    const quantities = data.map(period => {
      // Sum quantities for all SKUs that normalize to this SKU
      return period.skuBreakdown
        .filter(sku => normalizeSkuName(sku.sku) === normalized)
        .reduce((sum, sku) => sum + sku.quantity, 0);
    });
    return {
      sku: displayName,
      normalized,
      min: Math.min(...quantities),
      max: Math.max(...quantities),
      quantities
    };
  });
  
  // Function to get color intensity based on quantity
  const getColorIntensity = (quantity: number, min: number, max: number, baseColor: string) => {
    if (max === min) return baseColor + '20'; // Very light if no variation
    const intensity = (quantity - min) / (max - min);
    const alpha = Math.max(0.1, 0.1 + (intensity * 0.9)); // Range from 0.1 to 1.0
    return baseColor + Math.round(alpha * 255).toString(16).padStart(2, '0');
  };
  
  return (
    <div className="min-w-full">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border border-gray-300 px-3 py-2 bg-gray-50 text-left font-medium text-gray-700">SKU</th>
            {data.map(period => (
              <th key={period.period} className="border border-gray-300 px-3 py-2 bg-gray-50 text-center font-medium text-gray-700">
                {period.period}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {skuStats.map(({ sku, normalized, min, max, quantities }) => {
            const baseColor = getSkuColor(normalized);
            return (
              <tr key={sku}>
                <td className="border border-gray-300 px-3 py-2 font-medium text-gray-700">{sku}</td>
                {quantities.map((quantity, index) => (
                  <td 
                    key={index}
                    className="border border-gray-300 px-3 py-2 text-center font-medium"
                    style={{ 
                      backgroundColor: getColorIntensity(quantity, min, max, baseColor),
                      color: quantity > 0 ? '#000' : '#666'
                    }}
                  >
                    {quantity.toLocaleString()}
                  </td>
                ))}
              </tr>
            );
          })}
          {/* Totals row */}
          <tr className="bg-gray-100 font-bold">
            <td className="border border-gray-300 px-3 py-2 text-gray-700">TOTAL</td>
            {data.map((period, index) => (
              <td key={index} className="border border-gray-300 px-3 py-2 text-center text-gray-700">
                {period.totalQuantity.toLocaleString()}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
};


export default function TrendsPage() {
  const { user, logout } = useAuth();
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [palletData, setPalletData] = useState<TrendData[]>([]);
  const [distributorData, setDistributorData] = useState<TrendData[]>([]);
  const [digitalData, setDigitalData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessUnit, setBusinessUnit] = useState<"all" | "pallet" | "distributor" | "digital">("all");

  // Sort function for trend data by period
  const sortByPeriod = (data: TrendData[]) => data.sort((a, b) => {
    const dateA = new Date(a.period + '-01');
    const dateB = new Date(b.period + '-01');
    if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
      return dateA.getTime() - dateB.getTime();
    }
    return a.period.localeCompare(b.period);
  });

  useEffect(() => {
    loadTrendData();
  }, [businessUnit]);

  const loadTrendData = async () => {
    setLoading(true);
    try {
      if (businessUnit === "all") {
        // For "all" business unit, combine all data
        const [palletResponse, distributorResponse, digitalResponse] = await Promise.all([
          fetch(`/api/trends?range=12months&businessUnit=pallet&t=${Date.now()}`, { cache: "no-store" }),
          fetch(`/api/trends?range=12months&businessUnit=distributor&t=${Date.now()}`, { cache: "no-store" }),
          fetch(`/api/trends?range=12months&businessUnit=digital&t=${Date.now()}`, { cache: "no-store" })
        ]);
        
        const palletData = await palletResponse.json();
        const distributorData = await distributorResponse.json();
        const digitalData = await digitalResponse.json();
        
        // Sort individual data arrays by period
        const sortedPalletData = sortByPeriod(palletData);
        const sortedDistributorData = sortByPeriod(distributorData);
        const sortedDigitalData = sortByPeriod(digitalData);
        
        // Combine all data for the main charts
        const combinedData = combineBusinessUnitData(sortedPalletData, sortedDistributorData, sortedDigitalData);
        setTrendData(combinedData);
        setWeeklyData([]); // Clear weekly data
        
        setPalletData(sortedPalletData);
        setDistributorData(sortedDistributorData);
        setDigitalData(sortedDigitalData);
      } else {
        // For specific business unit, load monthly data
        const response = await fetch(`/api/trends?range=12months&businessUnit=${businessUnit}&t=${Date.now()}`, { cache: "no-store" });
        const data = await response.json();
        
        // Sort the data by period
        const sortedData = sortByPeriod(data);
        setTrendData(sortedData);
        setWeeklyData([]); // Clear weekly data
        
        // Still load all business units for comparison chart
        const [palletResponse, distributorResponse, digitalResponse] = await Promise.all([
          fetch(`/api/trends?range=12months&businessUnit=pallet&t=${Date.now()}`, { cache: "no-store" }),
          fetch(`/api/trends?range=12months&businessUnit=distributor&t=${Date.now()}`, { cache: "no-store" }),
          fetch(`/api/trends?range=12months&businessUnit=digital&t=${Date.now()}`, { cache: "no-store" })
        ]);
        
        const palletData = await palletResponse.json();
        const distributorData = await distributorResponse.json();
        const digitalData = await digitalResponse.json();
        
        // Sort individual data arrays by period
        const sortedPalletData = sortByPeriod(palletData);
        const sortedDistributorData = sortByPeriod(distributorData);
        const sortedDigitalData = sortByPeriod(digitalData);
        
        setPalletData(sortedPalletData);
        setDistributorData(sortedDistributorData);
        setDigitalData(sortedDigitalData);
      }
    } catch (error) {
      console.error("Error loading trend data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Combine data from all business units
  const combineBusinessUnitData = (palletData: TrendData[], distributorData: TrendData[], digitalData: TrendData[]) => {
    const periodMap = new Map<string, TrendData>();
    
    // Process all data and combine by period
    [...palletData, ...distributorData, ...digitalData].forEach(data => {
      const existing = periodMap.get(data.period);
      if (existing) {
        existing.totalSales += data.totalSales;
        existing.totalQuantity += data.totalQuantity;
        // Combine SKU breakdowns
        data.skuBreakdown.forEach(sku => {
          const existingSku = existing.skuBreakdown.find(s => s.sku === sku.sku);
          if (existingSku) {
            existingSku.quantity += sku.quantity;
            existingSku.sales += sku.sales;
          } else {
            existing.skuBreakdown.push({ ...sku });
          }
        });
      } else {
        periodMap.set(data.period, {
          period: data.period,
          totalSales: data.totalSales,
          totalQuantity: data.totalQuantity,
          skuBreakdown: data.skuBreakdown.map(sku => ({ ...sku }))
        });
      }
    });
    
    return Array.from(periodMap.values()).sort((a, b) => {
      // Try to parse as dates first (for YYYY-MM format)
      const dateA = new Date(a.period + '-01');
      const dateB = new Date(b.period + '-01');
      
      // If both are valid dates, sort by date
      if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
        return dateA.getTime() - dateB.getTime();
      }
      
      // Otherwise, fall back to string comparison
      return a.period.localeCompare(b.period);
    });
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
    const data = trendData;
    
    const labels = data.map(item => item.period);
    const salesData = data.map(item => item.totalSales);
    const quantityData = data.map(item => item.totalQuantity);
    
    // Get all unique SKUs across all periods and normalize them
    const skuMap = new Map<string, { displayName: string; totalQuantity: number }>();
    
    data.forEach(period => {
      period.skuBreakdown.forEach(sku => {
        // Normalize SKU names to group equivalent SKUs
        const normalizedSku = normalizeSkuName(sku.sku);
        const existing = skuMap.get(normalizedSku);
        
        if (existing) {
          existing.totalQuantity += sku.quantity;
          // Keep the shorter display name if available
          if (sku.sku.length < existing.displayName.length) {
            existing.displayName = sku.sku;
          }
        } else {
          skuMap.set(normalizedSku, {
            displayName: sku.sku,
            totalQuantity: sku.quantity
          });
        }
      });
    });
    
    // Sort by total quantity and take top 5
    const topSkus = Array.from(skuMap.entries())
      .sort((a, b) => b[1].totalQuantity - a[1].totalQuantity)
      .slice(0, 5);
    
    // Function to normalize SKU names (same as in SKUGrid)
    function normalizeSkuName(sku: string): string {
      const skuLower = sku.toLowerCase();
      // Map equivalent SKUs to the same normalized name
      if (skuLower.includes('active') || sku === '26k') return '26k';
      if (skuLower.includes('power') || sku === '30k') return '30k';
      if (skuLower.includes('puppy') || sku === '28k') return '28k';
      if (skuLower.includes('ultra') || sku === '32k') return '32k';
      if (skuLower.includes('vital') || sku === '24k') return '24k';
      return sku.toLowerCase();
    }
    
    // Create SKU datasets with brand colors
    const skuDatasets = topSkus.map(([normalized, { displayName }]) => {
      // Brand color mapping based on normalized SKU names
      const getSkuColor = (normalizedSku: string) => {
        if (normalizedSku === '26k') return '#5BAB56';  // Green for Active/26K
        if (normalizedSku === '30k') return '#915A9D';  // Purple for Power/30K
        if (normalizedSku === '28k') return '#3B83BE';  // Blue for Puppy/28K
        if (normalizedSku === '32k') return '#C43C37';  // Red for Ultra/32K
        if (normalizedSku === '24k') return '#D7923E';  // Yellow for Vital/24K
        // Default fallback colors
        const defaultColors = ['#5BAB56', '#3B83BE', '#D7923E', '#915A9D', '#C43C37'];
        return defaultColors[topSkus.findIndex(([n]) => n === normalizedSku) % defaultColors.length];
      };
      
      const color = getSkuColor(normalized);
      
      return {
        label: displayName,
        data: data.map(period => {
          // Sum quantities for all SKUs that normalize to this SKU
          return period.skuBreakdown
            .filter(sku => normalizeSkuName(sku.sku) === normalized)
            .reduce((sum, sku) => sum + sku.quantity, 0);
        }),
        borderColor: color,
        backgroundColor: color + '20',
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
  
  // Prepare volume chart data for business unit comparison
  const prepareVolumeChartData = () => {
    // Get all unique periods from all business units
    const allPeriods = new Set<string>();
    [...palletData, ...distributorData, ...digitalData].forEach(item => {
      allPeriods.add(item.period);
    });
    
    const sortedPeriods = Array.from(allPeriods).sort((a, b) => {
      const dateA = new Date(a + '-01');
      const dateB = new Date(b + '-01');
      if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
        return dateA.getTime() - dateB.getTime();
      }
      return a.localeCompare(b);
    });
    
    // Create data arrays with zeros for missing months
    const palletQuantities = sortedPeriods.map(period => {
      const data = palletData.find(item => item.period === period);
      return data ? data.totalQuantity : 0;
    });
    
    const distributorQuantities = sortedPeriods.map(period => {
      const data = distributorData.find(item => item.period === period);
      return data ? data.totalQuantity : 0;
    });
    
    const digitalQuantities = sortedPeriods.map(period => {
      const data = digitalData.find(item => item.period === period);
      return data ? data.totalQuantity : 0;
    });
    
    return {
      labels: sortedPeriods,
      palletData: palletQuantities,
      distributorData: distributorQuantities,
      digitalData: digitalQuantities,
    };
  };
  
  const volumeChartData = prepareVolumeChartData();

  const salesChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Monthly Team Kinetic Trends',
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
              <h1 className="text-2xl kinetic-title text-gray-900">Sales Trends</h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadTrendData}
                  disabled={loading}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Refresh'}
                </button>
                <Link 
                  href="/admin" 
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  Back to Admin
                </Link>
              </div>
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
              <h1 className="text-2xl kinetic-title text-gray-900">Sales Trends</h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadTrendData}
                  disabled={loading}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Refresh'}
                </button>
                <Link 
                  href="/admin" 
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  Back to Admin
                </Link>
                <ProfileDropdown />
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
            <div className="text-sm text-gray-500">
              Average per Month
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(trendData.length > 0 ? trendData.reduce((sum, month) => sum + month.totalSales, 0) / trendData.length : 0)}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Business Unit:</label>
              <select
                value={businessUnit}
                onChange={(e) => setBusinessUnit(e.target.value as any)}
                className="border rounded-md px-3 py-1 text-sm"
              >
                <option value="all">All Business Units</option>
                <option value="pallet">Pallet</option>
                <option value="distributor">Distributor</option>
                <option value="digital">Digital</option>
              </select>
            </div>
          </div>
        </div>

        {/* 4 Core Containers Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Container 1: Sales Trend Chart */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Monthly Team Kinetic Trends
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

          {/* Container 2: Volume Trend Chart */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Monthly Volume Trends - {businessUnit === 'all' ? 'All Business Units' : businessUnit.charAt(0).toUpperCase() + businessUnit.slice(1)}
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
              Top SKU Performance Over Time
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

          {/* Container 4: Volume by Business Unit Chart */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Volume by Business Unit Over Time
            </h2>
            <div className="h-80">
              <Line 
                data={{
                  labels: volumeChartData.labels,
                  datasets: [
                    {
                      label: 'Pallet',
                      data: volumeChartData.palletData,
                      borderColor: 'rgb(59, 130, 246)',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      fill: false,
                      tension: 0.1,
                    },
                    {
                      label: 'Distributor',
                      data: volumeChartData.distributorData,
                      borderColor: 'rgb(16, 185, 129)',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      fill: false,
                      tension: 0.1,
                    },
                    {
                      label: 'Digital',
                      data: volumeChartData.digitalData,
                      borderColor: 'rgb(245, 158, 11)',
                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      fill: false,
                      tension: 0.1,
                    }
                  ]
                }}
                options={quantityChartOptions}
              />
            </div>
          </div>
        </div>

        {/* SKU Grid */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            SKU Performance Grid
          </h2>
          <div className="overflow-x-auto">
            <SKUGrid data={trendData} />
          </div>
        </div>

      </div>
      </div>
    </ProtectedRoute>
  );
}
