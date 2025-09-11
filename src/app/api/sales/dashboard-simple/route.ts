import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');
    const view = searchParams.get('view') || 'personal';

    if (!userEmail) {
      return NextResponse.json({ error: 'User email is required' }, { status: 400 });
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const thisMonthStart = new Date(currentYear, currentMonth - 1, 1);
    const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));

    if (view === 'personal') {
      // Get Ian's customers and their orders from shopify_orders only (avoiding UNION issues)
      const customers = await db.prepare(`
        SELECT email, assignedto FROM customers WHERE assignedto = $1
      `).all(userEmail);

      const customerAssignments = {};
      customers.forEach(c => {
        customerAssignments[c.email] = c.assignedto;
      });

      // Get orders from shopify_orders only for now
      const orders = await db.prepare(`
        SELECT 
          id,
          ordernumber as "orderNumber",
          customeremail as "customerEmail",
          customername as "customerName",
          totalamount as "totalAmount",
          createdat as "createdAt"
        FROM shopify_orders
        WHERE customeremail IN (${Object.keys(customerAssignments).map(() => '?').join(',')})
        ORDER BY createdat DESC
      `).all(...Object.keys(customerAssignments));

      // Calculate personal data
      const personalData = {
        total_orders: new Set(),
        total_sales: 0,
        this_month_orders: new Set(),
        this_month_sales: 0
      };

      orders.forEach(order => {
        const orderDate = new Date(order.createdAt);
        const totalAmount = parseFloat(order.totalAmount) || 0;

        // Total metrics
        personalData.total_orders.add(order.orderNumber);
        personalData.total_sales += totalAmount;

        // This month
        if (orderDate >= thisMonthStart) {
          personalData.this_month_orders.add(order.orderNumber);
          personalData.this_month_sales += totalAmount;
        }
      });

      // Get monthly pallets data (this was working in the logs)
      const monthlyPalletsQuery = `
        SELECT 
          DATE_TRUNC('month', createdat::timestamp) as month,
          COUNT(DISTINCT ordernumber) as pallets_sold
        FROM shopify_orders
        WHERE customeremail IN (${Object.keys(customerAssignments).map(() => '?').join(',')})
          AND createdat::timestamp >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', createdat::timestamp)
        ORDER BY month
      `;
      
      const monthlyPallets = await db.prepare(monthlyPalletsQuery).all(...Object.keys(customerAssignments));

      // Get bulk inquiries
      const bulkInquiriesQuery = `
        SELECT COUNT(*) as bulk_inquiries_count
        FROM inquiries i
        LEFT JOIN customers c ON i.customeremail = c.email
        WHERE c.assignedto = $1
          AND i.category = 'bulk'
          AND i.createdat >= $2
      `;

      const bulkInquiries = await db.prepare(bulkInquiriesQuery).get(userEmail, sixtyDaysAgo.toISOString());

      return NextResponse.json({ 
        personal: {
          total_orders: personalData.total_orders.size,
          total_sales: personalData.total_sales,
          this_month_orders: personalData.this_month_orders.size,
          this_month_sales: personalData.this_month_sales
        }, 
        monthlyPallets: monthlyPallets.map(m => ({
          month: m.month,
          pallets_sold: parseInt(m.pallets_sold)
        })), 
        bulkInquiries: parseInt(bulkInquiries?.bulk_inquiries_count || '0') 
      });
    }

    return NextResponse.json({ error: 'Invalid view' }, { status: 400 });
  } catch (error) {
    console.error('Simple sales dashboard API error:', error);
    return NextResponse.json({ error: 'Failed to fetch sales data', details: error.message }, { status: 500 });
  }
}
