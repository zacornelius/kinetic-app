import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '12months';
    
    // Calculate date range
    const now = new Date();
    let monthsBack = 12;
    if (range === '6months') monthsBack = 6;
    if (range === '24months') monthsBack = 24;
    
    const startDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    // Get line items data from all_orders
    const query = `
      SELECT 
        strftime('%Y-%m', o.createdAt) as period,
        json_extract(li.value, '$.quantity') as quantity,
        json_extract(li.value, '$.totalPrice') as price,
        json_extract(li.value, '$.name') as sku
      FROM all_orders o,
      json_each(o.lineItems) as li
      WHERE o.createdAt >= '${startDate.toISOString().split('T')[0]}'
        AND o.createdAt <= '${endDate.toISOString().split('T')[0]}'
        AND json_extract(li.value, '$.name') IS NOT NULL
        AND json_extract(li.value, '$.quantity') IS NOT NULL
        AND json_extract(li.value, '$.totalPrice') IS NOT NULL
        AND json_extract(li.value, '$.name') != ''
      ORDER BY o.createdAt DESC
    `;
    
    const result = execSync(`sqlite3 kinetic.db "${query}"`, { encoding: 'utf8' });
    
    if (!result.trim()) {
      return NextResponse.json([]);
    }
    
    const lines = result.trim().split('\n');
    const monthlyData: { [key: string]: { totalSales: number; totalQuantity: number; skuBreakdown: { [key: string]: { quantity: number; sales: number } } } } = {};
    
    // Process each line item
    lines.forEach(line => {
      const [period, quantity, price, sku] = line.split('|');
      
      if (!period || !quantity || !price || !sku) return;
      
      const qty = parseFloat(quantity) || 0;
      const sales = parseFloat(price) || 0;
      
      if (!monthlyData[period]) {
        monthlyData[period] = {
          totalSales: 0,
          totalQuantity: 0,
          skuBreakdown: {}
        };
      }
      
      monthlyData[period].totalSales += sales;
      monthlyData[period].totalQuantity += qty;
      
      if (!monthlyData[period].skuBreakdown[sku]) {
        monthlyData[period].skuBreakdown[sku] = { quantity: 0, sales: 0 };
      }
      
      monthlyData[period].skuBreakdown[sku].quantity += qty;
      monthlyData[period].skuBreakdown[sku].sales += sales;
    });
    
    // Convert to array format
    const trendData = Object.entries(monthlyData)
      .map(([period, data]) => ({
        period,
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
      .sort((a, b) => a.period.localeCompare(b.period)); // Sort by period
    
    return NextResponse.json(trendData);
    
  } catch (error) {
    console.error('Error fetching trends data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trends data' },
      { status: 500 }
    );
  }
}
