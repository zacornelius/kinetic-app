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
    const businessUnit = searchParams.get('businessUnit') || 'all'; // 'all', 'pallet', 'distributor', 'digital'
    
    // Calculate date range - start from beginning of current year (2025) since we only have data from 2025
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const startDate = new Date(Date.UTC(currentYear, 0, 1)); // January 1st of current year in UTC
    const endDate = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999)); // December 31st of current year in UTC
    
    // Get line items data directly from the database (same logic as line items API)
    let query = `
      SELECT 
        id,
        ordernumber as "orderNumber",
        customeremail as "customerEmail",
        customername as "customerName",
        lineitems as "lineItems",
        business_unit as "businessUnit",
        createdat as "createdAt"
      FROM (
        SELECT id, ordernumber, customeremail, customername, lineitems, business_unit, createdat::timestamp as createdat FROM shopify_orders
        UNION ALL
        SELECT id, ordernumber, customeremail, customername, lineitems, business_unit, createdat::timestamp as createdat FROM distributor_orders
        UNION ALL
        SELECT id, ordernumber, customeremail, customername, lineitems, business_unit, createdat::timestamp as createdat FROM digital_orders
      ) o
      WHERE lineitems IS NOT NULL AND lineitems != '' AND lineitems != 'null' AND lineitems != 'undefined'
        AND createdat >= ? AND createdat <= ?
    `;
    
    let params = [startDate.toISOString(), endDate.toISOString()];
    
    if (businessUnit !== 'all') {
      query += ` AND business_unit = ?`;
      params.push(businessUnit);
    }
    
    query += ` ORDER BY createdat DESC`;
    
    const orders = await db.prepare(query).all(...params);
    
    if (!orders || orders.length === 0) {
      return NextResponse.json([]);
    }
    
    // Parse line items from JSON and flatten them (same logic as line items API)
    const allLineItems = [];
    orders.forEach(order => {
      try {
        if (!order.lineItems || order.lineItems === 'null' || order.lineItems === 'undefined') {
          return;
        }
        
        const lineItems = JSON.parse(order.lineItems);
        
        if (!Array.isArray(lineItems)) {
          return;
        }
        
        lineItems.forEach((item, index) => {
          const price = parseFloat(item.price || 0);
          const quantity = parseInt(item.quantity || 0);
          const totalDiscount = parseFloat(item.total_discount || 0);
          const totalPrice = (price * quantity) - totalDiscount;
          
          allLineItems.push({
            id: `${order.id}-${index}`,
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerEmail: order.customerEmail,
            customerName: order.customerName,
            businessUnit: order.businessUnit,
            createdAt: order.createdAt,
            ...item,
            totalPrice: totalPrice
          });
        });
      } catch (error) {
        console.error('Error parsing line items:', error);
      }
    });
    
    // Filter line items by business unit
    const filteredLineItems = allLineItems.filter(item => 
      item.businessUnit === 'pallet' || item.businessUnit === 'distributor' || item.businessUnit === 'digital'
    );
    
    const lines = filteredLineItems;
    const monthlyData: { [key: string]: { totalSales: number; totalQuantity: number; skuBreakdown: { [key: string]: { quantity: number; sales: number } } } } = {};
    
    // Process each line item
    lines.forEach(line => {
      const { title, name, sku, quantity, totalPrice, businessUnit, createdAt } = line;
      
      if (!title || !quantity) return;
      
      const qty = parseFloat(quantity) || 0;
      const sales = parseFloat(totalPrice) || 0;
      
      // Calculate period from createdAt date - use UTC to avoid timezone issues
      const itemDate = new Date(createdAt);
      const period = `${itemDate.getUTCFullYear()}-${String(itemDate.getUTCMonth() + 1).padStart(2, '0')}`;
      
      // Calculate effective SKU and quantity - track pallets AND distributor/digital products
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
      } else if (title?.includes('Kinetic Dog Food')) {
        // Handle distributor/digital products - extract SKU from title
        effectiveSKU = title.replace(' Kinetic Dog Food', '');
        effectiveQuantity = qty; // quantity is in bags
      } else {
        // Skip other products
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
    
    const response = NextResponse.json(trendData);
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    return response;
    
  } catch (error) {
    console.error('Error fetching trends data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trends data' },
      { status: 500 }
    );
  }
}
