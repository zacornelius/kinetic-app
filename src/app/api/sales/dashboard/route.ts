import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');
    const view = searchParams.get('view') || 'personal'; // 'personal' or 'leaderboard'

    if (!userEmail) {
      return NextResponse.json({ error: 'User email is required' }, { status: 400 });
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Calculate date ranges
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    // Twelve months ago should be October 2024 (12 months before September 2025)
      const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));
    const thisMonthStart = new Date(currentYear, currentMonth - 1, 1);

    if (view === 'leaderboard') {
      // Leaderboard view - show all sales team members
      const leaderboardQuery = `
        SELECT 
          c.assignedto as owner,
          COUNT(DISTINCT o.ordernumber) as total_orders,
          COALESCE(SUM(o.totalamount), 0) as total_sales,
          COUNT(DISTINCT CASE WHEN o.createdat >= ? THEN o.ordernumber END) as this_month_orders,
          COALESCE(SUM(CASE WHEN o.createdat >= ? THEN o.totalamount END), 0) as this_month_sales,
          COUNT(DISTINCT CASE WHEN o.createdat >= ? THEN o.ordernumber END) as three_month_orders,
          COALESCE(SUM(CASE WHEN o.createdat >= ? THEN o.totalamount END), 0) as three_month_sales,
          COUNT(DISTINCT CASE WHEN o.createdat >= ? THEN o.ordernumber END) as six_month_orders,
          COALESCE(SUM(CASE WHEN o.createdat >= ? THEN o.totalamount END), 0) as six_month_sales,
          COUNT(DISTINCT CASE WHEN o.createdat >= ? THEN o.ordernumber END) as twelve_month_orders,
          COALESCE(SUM(CASE WHEN o.createdat >= ? THEN o.totalamount END), 0) as twelve_month_sales
        FROM customers c
        LEFT JOIN shopify_orders o ON c.email = o.customeremail
        WHERE c.assignedto IN ('iand@kineticdogfood.com', 'ericb@kineticdogfood.com', 'Dave@kineticdogfood.com')
        GROUP BY c.assignedto
        ORDER BY this_month_sales DESC
      `;

      const leaderboard = await db.prepare(leaderboardQuery).all(
        thisMonthStart.toISOString(),
        thisMonthStart.toISOString(),
        threeMonthsAgo.toISOString(),
        threeMonthsAgo.toISOString(),
        sixMonthsAgo.toISOString(),
        sixMonthsAgo.toISOString(),
        twelveMonthsAgo.toISOString(),
        twelveMonthsAgo.toISOString()
      );

      // Get monthly pallet data for leaderboard
      const monthlyPalletsQuery = `
        SELECT 
          c.assignedto as owner,
          DATE_TRUNC('month', o.createdat::timestamp) as month,
          COUNT(DISTINCT o.ordernumber) as pallets_sold
        FROM customers c
        LEFT JOIN shopify_orders o ON c.email = o.customeremail
        WHERE c.assignedto IN ('iand@kineticdogfood.com', 'ericb@kineticdogfood.com', 'Dave@kineticdogfood.com')
          AND o.createdat >= ?
          AND (o.lineitems LIKE '%"title":"Build a Pallet"%' OR o.lineitems LIKE '%Pallet"%')
        GROUP BY c.assignedto, DATE_TRUNC('month', o.createdat::timestamp)
        ORDER BY c.assignedto, month
      `;

      const monthlyPallets = await db.prepare(monthlyPalletsQuery).all(twelveMonthsAgo.toISOString());

      // Get bulk inquiries from last 60 days for each team member
      const bulkInquiriesQuery = `
        SELECT 
          c.assignedto as owner,
          COUNT(i.id) as bulk_inquiries_count
        FROM customers c
        LEFT JOIN inquiries i ON c.email = i.customeremail
        WHERE c.assignedto IN ('iand@kineticdogfood.com', 'ericb@kineticdogfood.com', 'Dave@kineticdogfood.com')
          AND i.category = 'bulk'
          AND i.createdat >= ?
        GROUP BY c.assignedto
      `;

      const bulkInquiries = await db.prepare(bulkInquiriesQuery).all(sixtyDaysAgo.toISOString());

      return NextResponse.json({ 
        leaderboard, 
        monthlyPallets, 
        bulkInquiries: bulkInquiries.map(b => ({
          ...b,
          bulk_inquiries_count: parseInt(b.bulk_inquiries_count)
        }))
      });
    } else {
      // Personal view - show data for the logged-in user
      const personalQuery = `
        SELECT 
          COUNT(DISTINCT o.ordernumber) as total_orders,
          COALESCE(SUM(o.totalamount), 0) as total_sales,
          COUNT(DISTINCT CASE WHEN o.createdat >= ? THEN o.ordernumber END) as this_month_orders,
          COALESCE(SUM(CASE WHEN o.createdat >= ? THEN o.totalamount END), 0) as this_month_sales,
          COUNT(DISTINCT CASE WHEN o.createdat >= ? THEN o.ordernumber END) as three_month_orders,
          COALESCE(SUM(CASE WHEN o.createdat >= ? THEN o.totalamount END), 0) as three_month_sales,
          COUNT(DISTINCT CASE WHEN o.createdat >= ? THEN o.ordernumber END) as six_month_orders,
          COALESCE(SUM(CASE WHEN o.createdat >= ? THEN o.totalamount END), 0) as six_month_sales,
          COUNT(DISTINCT CASE WHEN o.createdat >= ? THEN o.ordernumber END) as twelve_month_orders,
          COALESCE(SUM(CASE WHEN o.createdat >= ? THEN o.totalamount END), 0) as twelve_month_sales
        FROM customers c
        LEFT JOIN shopify_orders o ON c.email = o.customeremail
        WHERE c.assignedto = ?
      `;

      const personalData = await db.prepare(personalQuery).get(
        thisMonthStart.toISOString(),
        thisMonthStart.toISOString(),
        threeMonthsAgo.toISOString(),
        threeMonthsAgo.toISOString(),
        sixMonthsAgo.toISOString(),
        sixMonthsAgo.toISOString(),
        twelveMonthsAgo.toISOString(),
        twelveMonthsAgo.toISOString(),
        userEmail
      );

      // Get monthly pallet data for personal view
      const monthlyPalletsQuery = `
        SELECT 
          DATE_TRUNC('month', o.createdat::timestamp) as month,
          COUNT(DISTINCT o.ordernumber) as pallets_sold
        FROM customers c
        LEFT JOIN shopify_orders o ON c.email = o.customeremail
        WHERE c.assignedto = ?
          AND o.createdat >= ?
          AND (o.lineitems LIKE '%"title":"Build a Pallet"%' OR o.lineitems LIKE '%Pallet"%')
        GROUP BY DATE_TRUNC('month', o.createdat::timestamp)
        ORDER BY month
      `;

      const monthlyPallets = await db.prepare(monthlyPalletsQuery).all(userEmail, twelveMonthsAgo.toISOString());
      
      // Debug logging
      console.log('Monthly pallets query result:', monthlyPallets);
      console.log('Query parameters:', { userEmail, twelveMonthsAgo: twelveMonthsAgo.toISOString() });
      
      // Test query to see all Ian's orders in September
      const testQuery = `
        SELECT o.ordernumber, o.createdat, o.lineitems
        FROM customers c
        LEFT JOIN shopify_orders o ON c.email = o.customeremail
        WHERE c.assignedto = ?
          AND o.createdat >= '2025-09-01'
          AND o.createdat < '2025-10-01'
        ORDER BY o.createdat DESC
      `;
      const testResult = await db.prepare(testQuery).all(userEmail);
      console.log('Ian\'s September orders:', testResult);

      // Get bulk inquiries from last 60 days
      const bulkInquiriesQuery = `
        SELECT COUNT(*) as bulk_inquiries_count
        FROM inquiries i
        LEFT JOIN customers c ON i.customeremail = c.email
        WHERE c.assignedto = ?
          AND i.category = 'bulk'
          AND i.createdat >= ?
      `;

      const bulkInquiries = await db.prepare(bulkInquiriesQuery).get(userEmail, sixtyDaysAgo.toISOString());

      return NextResponse.json({ 
        personal: personalData, 
        monthlyPallets, 
        bulkInquiries: parseInt(bulkInquiries?.bulk_inquiries_count || '0') 
      });
    }
  } catch (error) {
    console.error('Sales dashboard API error:', error);
    return NextResponse.json({ error: 'Failed to fetch sales data' }, { status: 500 });
  }
}
