import { NextRequest, NextResponse } from "next/server";
import db from '@/lib/database';

function formatPeriod(period: string): string {
  // Convert "2024-08" to "Aug 24"
  const [year, month] = period.split('-');
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const monthIndex = parseInt(month) - 1;
  const shortYear = year.slice(-2);
  return `${monthNames[monthIndex]} ${shortYear}`;
}

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
    
    // Get line items data from shopify_orders - ALL sales, not just pallet sales
            const query = `
              SELECT 
                TO_CHAR(o.createdat::timestamp, 'YYYY-MM') as period,
                (li.value->>'quantity')::numeric as quantity,
                COALESCE((li.value->>'totalPrice')::numeric, ((li.value->>'quantity')::numeric * (li.value->>'price')::numeric), 0) as price,
                li.value->>'title' as title,
                li.value->>'name' as name,
                li.value->>'sku' as sku
              FROM shopify_orders o,
              jsonb_array_elements(o.lineItems::jsonb) as li
              WHERE o.createdat::timestamp >= $1::timestamp
                AND o.createdat::timestamp <= $2::timestamp
                AND li.value->>'title' IS NOT NULL
                AND li.value->>'quantity' IS NOT NULL
                AND (li.value->>'title' LIKE '%Pallet%' OR li.value->>'title' = 'Build a Pallet')
              ORDER BY o.createdat::timestamp DESC
            `;
    
    const result = await db.prepare(query).all(startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]);
    
    if (!result || result.length === 0) {
      return NextResponse.json([]);
    }
    
    const lines = result;
    const monthlyData: { [key: string]: { totalSales: number; totalQuantity: number; skuBreakdown: { [key: string]: { quantity: number; sales: number } } } } = {};
    
    // Process each line item
    lines.forEach(line => {
      const { period, quantity, price, title, name, sku } = line;
      
      if (!period || !quantity || !title) return;
      
      const qty = parseFloat(quantity) || 0;
      const sales = parseFloat(price) || 0; // Handle empty prices as 0
      
      // Calculate effective SKU and quantity - ONLY track pallets
      let effectiveSKU = '';
      let effectiveQuantity = 0;
      
      if (title === 'Build a Pallet') {
        // Handle "Build a Pallet" - extract product name from name field
        effectiveSKU = name?.replace('Build a Pallet - ', '') || `V-${name}`;
        effectiveQuantity = qty; // quantity is already in pallets
      } else if (title?.includes('Pallet')) {
        // Handle pre-built pallet products - extract base SKU
        effectiveSKU = title.replace(' Pallet', '');
        effectiveQuantity = qty * 50; // multiply quantity by 50 for pallet products
      } else {
        // Skip individual products - we only want pallet tracking
        return;
      }
      
      if (!effectiveSKU) return; // Skip if we couldn't determine effective SKU
      
      if (!monthlyData[period]) {
        monthlyData[period] = {
          totalSales: 0,
          totalQuantity: 0,
          skuBreakdown: {}
        };
      }
      
      monthlyData[period].totalSales += sales;
      monthlyData[period].totalQuantity += effectiveQuantity;
      
      if (!monthlyData[period].skuBreakdown[effectiveSKU]) {
        monthlyData[period].skuBreakdown[effectiveSKU] = { quantity: 0, sales: 0 };
      }
      
      monthlyData[period].skuBreakdown[effectiveSKU].quantity += effectiveQuantity;
      monthlyData[period].skuBreakdown[effectiveSKU].sales += sales;
    });
    
    // Convert to array format
    const trendData = Object.entries(monthlyData)
      .map(([period, data]) => ({
        period: formatPeriod(period),
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
        // Sort by actual date, not string comparison
        const getDateFromPeriod = (period: string) => {
          const [month, year] = period.split(' ');
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const monthIndex = monthNames.indexOf(month);
          const fullYear = parseInt('20' + year);
          return new Date(fullYear, monthIndex, 1);
        };
        return getDateFromPeriod(a.period).getTime() - getDateFromPeriod(b.period).getTime();
      });
    
    return NextResponse.json(trendData);
    
  } catch (error) {
    console.error('Error fetching trends data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trends data' },
      { status: 500 }
    );
  }
}
