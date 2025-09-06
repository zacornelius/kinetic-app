import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period');
    
    if (!period) {
      return NextResponse.json(
        { error: 'Period parameter is required' },
        { status: 400 }
      );
    }
    
    // Parse the period (YYYY-MM format)
    const [year, month] = period.split('-');
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0);
    
    // Get line items data for the specific month
    const query = `
      SELECT 
        strftime('%Y-%W', o.createdAt) as week,
        strftime('%Y-%m-%d', o.createdAt) as date,
        json_extract(li.value, '$.effectiveQuantity') as quantity,
        json_extract(li.value, '$.totalPrice') as price,
        json_extract(li.value, '$.effectiveSKU') as sku
      FROM all_orders o,
      json_each(o.lineItems) as li
      WHERE o.createdAt >= '${startDate.toISOString().split('T')[0]}'
        AND o.createdAt <= '${endDate.toISOString().split('T')[0]}'
        AND json_extract(li.value, '$.effectiveSKU') IS NOT NULL
        AND json_extract(li.value, '$.effectiveQuantity') IS NOT NULL
        AND json_extract(li.value, '$.totalPrice') IS NOT NULL
      ORDER BY o.createdAt DESC
    `;
    
    const result = execSync(`sqlite3 kinetic.db "${query}"`, { encoding: 'utf8' });
    
    if (!result.trim()) {
      return NextResponse.json([]);
    }
    
    const lines = result.trim().split('\n');
    const weeklyData: { [key: string]: { totalSales: number; totalQuantity: number; skuBreakdown: { [key: string]: { quantity: number; sales: number } } } } = {};
    
    // Process each line item
    lines.forEach(line => {
      const [week, date, quantity, price, sku] = line.split('|');
      
      if (!week || !quantity || !price || !sku) return;
      
      const qty = parseFloat(quantity) || 0;
      const sales = parseFloat(price) || 0;
      
      // Create a more readable week label
      const weekDate = new Date(date);
      const weekStart = new Date(weekDate);
      weekStart.setDate(weekDate.getDate() - weekDate.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      const weekLabel = `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      
      if (!weeklyData[weekLabel]) {
        weeklyData[weekLabel] = {
          totalSales: 0,
          totalQuantity: 0,
          skuBreakdown: {}
        };
      }
      
      weeklyData[weekLabel].totalSales += sales;
      weeklyData[weekLabel].totalQuantity += qty;
      
      if (!weeklyData[weekLabel].skuBreakdown[sku]) {
        weeklyData[weekLabel].skuBreakdown[sku] = { quantity: 0, sales: 0 };
      }
      
      weeklyData[weekLabel].skuBreakdown[sku].quantity += qty;
      weeklyData[weekLabel].skuBreakdown[sku].sales += sales;
    });
    
    // Convert to array format
    const trendData = Object.entries(weeklyData)
      .map(([week, data]) => ({
        week,
        totalSales: data.totalSales,
        totalQuantity: data.totalQuantity,
        skuBreakdown: Object.entries(data.skuBreakdown)
          .map(([sku, skuData]) => ({
            sku,
            quantity: skuData.quantity,
            sales: skuData.sales
          }))
          .sort((a, b) => b.sales - a.sales) // Sort by sales descending
      }))
      .sort((a, b) => a.week.localeCompare(b.week)); // Sort by week
    
    return NextResponse.json(trendData);
    
  } catch (error) {
    console.error('Error fetching weekly trends data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch weekly trends data' },
      { status: 500 }
    );
  }
}
