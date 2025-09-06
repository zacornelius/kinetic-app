import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period');
    const range = searchParams.get('range');
    
    let startDate: Date;
    let endDate: Date;
    
    if (range === '3months') {
      // For 3 months, get last 3 months of weekly data
      const now = new Date();
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    } else if (period) {
      // Parse the period (YYYY-MM format)
      const [year, month] = period.split('-');
      startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      endDate = new Date(parseInt(year), parseInt(month), 0);
    } else {
      return NextResponse.json(
        { error: 'Period or range parameter is required' },
        { status: 400 }
      );
    }
    
    // Get line items data for the specific month - only pallet sales (same filter as data explorer)
    const query = `
      SELECT 
        strftime('%Y-%W', o.createdAt) as week,
        strftime('%Y-%m-%d', o.createdAt) as date,
        json_extract(li.value, '$.quantity') as quantity,
        json_extract(li.value, '$.totalPrice') as price,
        json_extract(li.value, '$.title') as title,
        json_extract(li.value, '$.name') as name
      FROM all_orders o,
      json_each(o.lineItems) as li
      WHERE o.createdAt >= '${startDate.toISOString().split('T')[0]}'
        AND o.createdAt <= '${endDate.toISOString().split('T')[0]}'
        AND json_extract(li.value, '$.title') IS NOT NULL
        AND json_extract(li.value, '$.quantity') IS NOT NULL
        AND json_extract(li.value, '$.totalPrice') IS NOT NULL
        AND (
          json_extract(li.value, '$.title') = 'Build a Pallet' 
          OR json_extract(li.value, '$.title') LIKE '%Pallet%'
        )
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
      const [week, date, quantity, price, title, name] = line.split('|');
      
      if (!week || !quantity || !price || !title) return;
      
      const qty = parseFloat(quantity) || 0;
      const sales = parseFloat(price) || 0;
      
      // Calculate effective SKU and quantity (same logic as data explorer)
      let effectiveSKU = '';
      let effectiveQuantity = qty;
      
      if (title === 'Build a Pallet') {
        // Handle "Build a Pallet" - extract product name from name field
        effectiveSKU = name?.replace('Build a Pallet - ', '') || `V-${name}`;
        effectiveQuantity = qty; // quantity is units of that SKU on the pallet
      } else if (title?.includes('Pallet')) {
        // Handle pre-built pallet products - extract base SKU
        effectiveSKU = title.replace(' Pallet', '');
        effectiveQuantity = qty * 50; // multiply quantity by 50 for pallet products
      }
      
      if (!effectiveSKU) return; // Skip if we couldn't determine effective SKU
      
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
      weeklyData[weekLabel].totalQuantity += effectiveQuantity;
      
      if (!weeklyData[weekLabel].skuBreakdown[effectiveSKU]) {
        weeklyData[weekLabel].skuBreakdown[effectiveSKU] = { quantity: 0, sales: 0 };
      }
      
      weeklyData[weekLabel].skuBreakdown[effectiveSKU].quantity += effectiveQuantity;
      weeklyData[weekLabel].skuBreakdown[effectiveSKU].sales += sales;
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
      .sort((a, b) => {
        // Extract week number from "Week of Aug 10 - Aug 16" format
        const getWeekNumber = (weekStr: string) => {
          const match = weekStr.match(/Week of (\w+) (\d+)/);
          if (match) {
            const month = match[1];
            const day = parseInt(match[2]);
            const monthMap: { [key: string]: number } = {
              'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
              'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
            };
            return (monthMap[month] || 0) * 100 + day;
          }
          return 0;
        };
        return getWeekNumber(a.week) - getWeekNumber(b.week); // Sort chronologically
      });
    
    return NextResponse.json(trendData);
    
  } catch (error) {
    console.error('Error fetching weekly trends data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch weekly trends data' },
      { status: 500 }
    );
  }
}
