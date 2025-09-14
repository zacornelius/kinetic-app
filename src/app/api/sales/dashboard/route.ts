import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { cache, cacheKeys } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');
    const view = searchParams.get('view') || 'personal'; // 'personal' or 'leaderboard'

    if (!userEmail) {
      return NextResponse.json({ error: 'User email is required' }, { status: 400 });
    }

    // Check cache first
    const cacheKey = cacheKeys.salesDashboard(userEmail, view);
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Calculate date ranges - optimized for better performance
    const thisMonthStart = new Date(currentYear, currentMonth - 1, 1);
    const twelveMonthsAgo = new Date(currentYear - 1, currentMonth - 1, 1);

    if (view === 'leaderboard') {
      // Dynamic leaderboard query - get top 3 performers by revenue this month
      const leaderboardQuery = `
        WITH monthly_sales AS (
          SELECT 
            c.assignedto as owner,
            COUNT(DISTINCT o.ordernumber) as this_month_orders,
            COALESCE(SUM(o.totalamount), 0) as this_month_sales,
            DATE_TRUNC('month', o.createdat::timestamp) as month
          FROM customers c
          JOIN all_orders o ON LOWER(c.email) = LOWER(o.customeremail)
          WHERE c.assignedto IS NOT NULL
            AND o.createdat::timestamp >= $1
          GROUP BY c.assignedto, DATE_TRUNC('month', o.createdat::timestamp)
        )
        SELECT 
          owner,
          SUM(this_month_orders) as this_month_orders,
          SUM(this_month_sales) as this_month_sales,
          COUNT(DISTINCT month) as months_active
        FROM monthly_sales
        WHERE month >= $2
        GROUP BY owner
        ORDER BY this_month_sales DESC
        LIMIT 3
      `;

      const leaderboard = await db.prepare(leaderboardQuery).all(
        thisMonthStart.toISOString(),
        twelveMonthsAgo.toISOString()
      );

      // Get monthly breakdown for the last 12 months
      const monthlyBreakdownQuery = `
        SELECT 
          c.assignedto as owner,
          TO_CHAR(o.createdat::timestamp, 'YYYY-MM') as month,
          COUNT(DISTINCT o.ordernumber) as orders,
          COALESCE(SUM(o.totalamount), 0) as revenue
        FROM customers c
        JOIN all_orders o ON LOWER(c.email) = LOWER(o.customeremail)
        WHERE c.assignedto IN ('iand@kineticdogfood.com', 'ericb@kineticdogfood.com', 'dave@kineticdogfood.com', '')
          AND o.createdat::timestamp >= $1
        GROUP BY c.assignedto, TO_CHAR(o.createdat::timestamp, 'YYYY-MM')
        ORDER BY c.assignedto, month
      `;

      const monthlyData = await db.prepare(monthlyBreakdownQuery).all(
        twelveMonthsAgo.toISOString()
      );

      // Get bags data for all team members (we'll filter to top 3 after)
      const bagsQuery = `
        SELECT 
          c.assignedto as owner,
          COALESCE(SUM((li->>'quantity')::integer), 0) as bags_sold
        FROM customers c
        JOIN all_orders o ON LOWER(c.email) = LOWER(o.customeremail)
        CROSS JOIN LATERAL jsonb_array_elements(o.lineitems::jsonb) as li
        WHERE c.assignedto IS NOT NULL
          AND o.createdat::timestamp >= $1
        GROUP BY c.assignedto
      `;
      
      const bagsData = await db.prepare(bagsQuery).all(thisMonthStart.toISOString());

      // Name mapping for display - flexible for any team member
      const nameMap: { [key: string]: string } = {
        'iand@kineticdogfood.com': 'Ian',
        'ericb@kineticdogfood.com': 'Eric',
        'dave@kineticdogfood.com': 'Dave',
        'lindsey@kineticdogfood.com': 'Lindsey',
        'zac@kineticdogfood.com': 'Zac'
      };

      const result = { 
        leaderboard: leaderboard.map(member => {
          const bags = bagsData.find(b => b.owner === member.owner);
          return {
            owner: member.owner,
            displayName: nameMap[member.owner] || member.owner.split('@')[0],
            orders: parseInt(member.this_month_orders),
            revenue: parseFloat(member.this_month_sales),
            bagsSold: parseInt(bags?.bags_sold || 0),
            months_active: parseInt(member.months_active)
          };
        }), 
        monthlyData: monthlyData.map(p => ({
          ...p,
          month: `${p.month}-01`,
          orders: parseInt(p.orders),
          revenue: parseFloat(p.revenue)
        }))
      };

      // Cache the result for 2 minutes (leaderboard data changes frequently)
      cache.set(cacheKey, result, 2 * 60 * 1000);
      
      return NextResponse.json(result);
    } else {
      // Optimized personal view - single query with aggregations
      const personalQuery = `
        WITH monthly_sales AS (
          SELECT 
            COUNT(DISTINCT o.ordernumber) as this_month_orders,
            COALESCE(SUM(o.totalamount), 0) as this_month_sales,
            DATE_TRUNC('month', o.createdat::timestamp) as month
          FROM customers c
          JOIN all_orders o ON LOWER(c.email) = LOWER(o.customeremail)
          WHERE c.assignedto = $1
            AND o.createdat::timestamp >= $2
          GROUP BY DATE_TRUNC('month', o.createdat::timestamp)
        )
        SELECT 
          SUM(this_month_orders) as this_month_orders,
          SUM(this_month_sales) as this_month_sales
        FROM monthly_sales
        WHERE month >= $3
      `;

      const personalData = await db.prepare(personalQuery).all(
        userEmail,
        twelveMonthsAgo.toISOString(),
        thisMonthStart.toISOString()
      );

      // Get monthly breakdown for the last 12 months
      const monthlyBreakdownQuery = `
        SELECT 
          TO_CHAR(o.createdat::timestamp, 'YYYY-MM') as month,
          COUNT(DISTINCT o.ordernumber) as orders,
          COALESCE(SUM(o.totalamount), 0) as revenue
        FROM customers c
        JOIN all_orders o ON LOWER(c.email) = LOWER(o.customeremail)
        WHERE c.assignedto = $1
          AND o.createdat::timestamp >= $2
        GROUP BY TO_CHAR(o.createdat::timestamp, 'YYYY-MM')
        ORDER BY month
      `;

      const monthlyData = await db.prepare(monthlyBreakdownQuery).all(
        userEmail,
        twelveMonthsAgo.toISOString()
      );

      // Calculate totals from monthly data
      const totalOrders = monthlyData.reduce((sum, month) => sum + parseInt(month.orders), 0);
      const totalSales = monthlyData.reduce((sum, month) => sum + parseFloat(month.revenue), 0);
      
      // Calculate 3-month totals
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const threeMonthData = monthlyData.filter(month => new Date(month.month + '-01') >= threeMonthsAgo);
      const threeMonthOrders = threeMonthData.reduce((sum, month) => sum + parseInt(month.orders), 0);
      const threeMonthSales = threeMonthData.reduce((sum, month) => sum + parseFloat(month.revenue), 0);
      
      // Calculate 6-month totals
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const sixMonthData = monthlyData.filter(month => new Date(month.month + '-01') >= sixMonthsAgo);
      const sixMonthOrders = sixMonthData.reduce((sum, month) => sum + parseInt(month.orders), 0);
      const sixMonthSales = sixMonthData.reduce((sum, month) => sum + parseFloat(month.revenue), 0);

      const personalDataFormatted = {
        total_orders: totalOrders,
        total_sales: totalSales,
        this_month_orders: parseInt(personalData[0]?.this_month_orders || 0),
        this_month_sales: parseFloat(personalData[0]?.this_month_sales || 0),
        three_month_orders: threeMonthOrders,
        three_month_sales: threeMonthSales,
        six_month_orders: sixMonthOrders,
        six_month_sales: sixMonthSales,
        twelve_month_orders: totalOrders,
        twelve_month_sales: totalSales
      };

      const result = { 
        personal: personalDataFormatted, 
        monthlyData: monthlyData.map(p => ({
          ...p,
          month: `${p.month}-01`,
          orders: parseInt(p.orders),
          revenue: parseFloat(p.revenue)
        }))
      };

      // Cache the result for 3 minutes (personal data changes less frequently)
      cache.set(cacheKey, result, 3 * 60 * 1000);
      
      return NextResponse.json(result);
    }
  } catch (error) {
    console.error('Sales dashboard API error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      userEmail: searchParams.get('userEmail'),
      view: searchParams.get('view')
    });
    return NextResponse.json({ error: 'Failed to fetch sales data', details: error.message }, { status: 500 });
  }
}
