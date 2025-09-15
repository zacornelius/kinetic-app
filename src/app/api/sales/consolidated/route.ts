import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';

// Consolidated Sales API - Single endpoint for all sales operations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'dashboard';
    const userEmail = searchParams.get('userEmail');
    const view = searchParams.get('view') || 'personal'; // 'personal' or 'leaderboard'
    const limit = parseInt(searchParams.get('limit') || '50');
    
    if (!userEmail) {
      return NextResponse.json({ error: 'User email is required' }, { status: 400 });
    }

    switch (action) {
      case 'dashboard':
        return await getSalesDashboard(userEmail, view);
      case 'top-customers':
        return await getTopCustomers(userEmail, view, limit);
      case 'leaderboard':
        return await getSalesLeaderboard(userEmail, view);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in consolidated sales API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales data', details: error.message },
      { status: 500 }
    );
  }
}

// Get sales dashboard data (replaces /api/sales/dashboard)
async function getSalesDashboard(userEmail: string, view: string) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const thisMonthStart = new Date(currentYear, currentMonth - 1, 1);

  if (view === 'leaderboard') {
    // Leaderboard view - show all sales team members
    const leaderboardQuery = `
      SELECT 
        c.assignedto as owner,
        c.assignedto as email,
        COALESCE(SUM(sales_stats.total_spent), 0) as revenue,
        COALESCE(SUM(sales_stats.total_orders), 0) as orders,
        COALESCE(SUM(sales_stats.bags_sold), 0) as "bagsSold",
        COALESCE(SUM(sales_stats.this_month_spent), 0) as "thisMonthSales",
        COALESCE(SUM(sales_stats.this_month_orders), 0) as "thisMonthOrders",
        COALESCE(SUM(sales_stats.this_month_bags), 0) as "bagsSoldThisMonth"
      FROM customers c
      LEFT JOIN (
        SELECT 
          o.customer_id,
          SUM(CASE WHEN o.createdat >= ? THEN o.totalamount ELSE 0 END) as this_month_spent,
          COUNT(DISTINCT CASE WHEN o.createdat >= ? THEN o.ordernumber ELSE NULL END) as this_month_orders,
          SUM(CASE WHEN o.createdat >= ? THEN COALESCE((
            SELECT SUM((item->>'quantity')::int) 
            FROM jsonb_array_elements(o.lineitems::jsonb) AS item
          ), 0) ELSE 0 END) as this_month_bags,
          SUM(o.totalamount) as total_spent,
          COUNT(DISTINCT o.ordernumber) as total_orders,
          SUM(COALESCE((
            SELECT SUM((item->>'quantity')::int) 
            FROM jsonb_array_elements(o.lineitems::jsonb) AS item
          ), 0)) as bags_sold
        FROM all_orders o
        WHERE o.customer_id IS NOT NULL
        GROUP BY o.customer_id
      ) sales_stats ON c.id = sales_stats.customer_id
      WHERE c.assignedto IN ('iand@kineticdogfood.com', 'ericb@kineticdogfood.com', 'dave@kineticdogfood.com', 'zac@kineticdogfood.com')
      GROUP BY c.assignedto
      ORDER BY COALESCE(SUM(sales_stats.this_month_bags), 0) DESC
      LIMIT 3
    `;

    const leaderboard = await db.prepare(leaderboardQuery).all(thisMonthStart, thisMonthStart, thisMonthStart);
    
    // Get user profiles for display names
    const userProfiles = await db.prepare(`
      SELECT email, firstname, lastname
      FROM users 
      WHERE email IN ('iand@kineticdogfood.com', 'ericb@kineticdogfood.com', 'dave@kineticdogfood.com', 'zac@kineticdogfood.com')
    `).all();

    const leaderboardWithNames = leaderboard.map(member => {
      const profile = userProfiles.find(p => p.email === member.owner);
      return {
        ...member,
        displayName: profile?.firstname || member.owner.split('@')[0]
      };
    });

    return NextResponse.json({ 
      leaderboard: leaderboardWithNames,
      personal: null // No personal data in leaderboard view
    });

  } else {
    // Personal view - show data for the logged-in user
    const personalQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN o.createdat >= ? THEN o.totalamount ELSE 0 END), 0) as this_month_sales,
        COUNT(DISTINCT CASE WHEN o.createdat >= ? THEN o.ordernumber ELSE NULL END) as this_month_orders,
        COALESCE(SUM(CASE WHEN o.createdat >= ? THEN COALESCE((
          SELECT SUM((item->>'quantity')::int) 
          FROM jsonb_array_elements(o.lineitems::jsonb) AS item
        ), 0) ELSE 0 END), 0) as bagsSoldThisMonth,
        COALESCE(SUM(o.totalamount), 0) as total_sales,
        COUNT(DISTINCT o.ordernumber) as total_orders,
        COALESCE(SUM(COALESCE((
          SELECT SUM((item->>'quantity')::int) 
          FROM jsonb_array_elements(o.lineitems::jsonb) AS item
        ), 0)), 0) as total_bags_sold
      FROM customers c
      LEFT JOIN all_orders o ON c.id = o.customer_id
      WHERE c.assignedto = ?
    `;

    const personalData = await db.prepare(personalQuery).get(thisMonthStart, thisMonthStart, thisMonthStart, userEmail);

    // Get yearly breakdown (12 months) - simplified approach
    // For now, return empty array to avoid date parsing issues
    const yearlyBreakdown = [];

    return NextResponse.json({ 
      personal: {
        this_month_sales: parseFloat(personalData?.this_month_sales || 0),
        this_month_orders: parseInt(personalData?.this_month_orders || 0),
        bagsSoldThisMonth: parseInt(personalData?.bagsSoldThisMonth || 0),
        total_sales: parseFloat(personalData?.total_sales || 0),
        total_orders: parseInt(personalData?.total_orders || 0),
        total_bags_sold: parseInt(personalData?.total_bags_sold || 0)
      },
      yearlyBreakdown: yearlyBreakdown.map(month => ({
        month: month.month,
        orders: parseInt(month.orders),
        revenue: parseFloat(month.revenue),
        bags: parseInt(month.bags)
      })),
      leaderboard: [] // No leaderboard data in personal view
    });
  }
}

// Get top customers (replaces /api/sales/top-customers)
async function getTopCustomers(userEmail: string, view: string, limit: number) {
  if (view === 'leaderboard') {
    // Leaderboard view - show top customers across all sales team
    const leaderboardQuery = `
      SELECT 
        c.email,
        c.firstname,
        c.lastname,
        c.assignedto as owner,
        c.customertype,
        c.customercategory,
        c.status,
        c.phone,
        c.companyname,
        COUNT(DISTINCT o.ordernumber) as order_count,
        COALESCE(SUM(o.totalamount), 0) as total_spent,
        MAX(o.createdat) as last_order_date
      FROM customers c
      LEFT JOIN all_orders o ON c.id = o.customer_id
      WHERE c.assignedto IN ('iand@kineticdogfood.com', 'ericb@kineticdogfood.com', 'dave@kineticdogfood.com', 'zac@kineticdogfood.com')
        AND o.ordernumber IS NOT NULL
      GROUP BY c.email, c.firstname, c.lastname, c.assignedto, c.customertype, c.customercategory, c.status, c.phone, c.companyname
      ORDER BY total_spent DESC
      LIMIT ?
    `;

    const topCustomers = await db.prepare(leaderboardQuery).all(limit);
    return NextResponse.json({ topCustomers });

  } else {
    // Personal view - show top customers for the logged-in user
    const personalQuery = `
      SELECT 
        c.email,
        c.firstname,
        c.lastname,
        c.assignedto as owner,
        c.customertype,
        c.customercategory,
        c.status,
        c.phone,
        c.companyname,
        COUNT(DISTINCT o.ordernumber) as order_count,
        COALESCE(SUM(o.totalamount), 0) as total_spent,
        MAX(o.createdat) as last_order_date
      FROM customers c
      LEFT JOIN all_orders o ON c.id = o.customer_id
      WHERE c.assignedto = ? AND o.ordernumber IS NOT NULL
      GROUP BY c.email, c.firstname, c.lastname, c.assignedto, c.customertype, c.customercategory, c.status, c.phone, c.companyname
      ORDER BY total_spent DESC
      LIMIT ?
    `;

    const topCustomers = await db.prepare(personalQuery).all(userEmail, limit);
    return NextResponse.json({ topCustomers });
  }
}

// Get sales leaderboard (standalone function)
async function getSalesLeaderboard(userEmail: string, view: string) {
  const dashboard = await getSalesDashboard(userEmail, view);
  return NextResponse.json({ leaderboard: dashboard.leaderboard });
}
