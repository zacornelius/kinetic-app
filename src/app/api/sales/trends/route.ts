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
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const twelveMonthsAgo = new Date(currentYear - 1, currentMonth - 1, 1);

    if (view === 'leaderboard') {
      // Leaderboard view - show trends for all sales team members
      const trendsQuery = `
        WITH monthly_data AS (
          SELECT 
            c.assignedto as owner,
            TO_CHAR(o.createdat::timestamp, 'YYYY-MM') as month,
            COUNT(DISTINCT o.ordernumber) as orders,
            COALESCE(SUM(o.totalamount), 0) as revenue
          FROM customers c
          JOIN all_orders o ON LOWER(c.email) = LOWER(o.customeremail)
          WHERE c.assignedto IN ('iand@kineticdogfood.com', 'ericb@kineticdogfood.com', 'Dave@kineticdogfood.com', 'lindsey@kineticdogfood.com')
            AND o.createdat::timestamp >= $1
          GROUP BY c.assignedto, TO_CHAR(o.createdat::timestamp, 'YYYY-MM')
        )
        SELECT 
          month,
          SUM(orders) as orders,
          SUM(revenue) as revenue,
          COUNT(DISTINCT owner) as active_team_members
        FROM monthly_data
        GROUP BY month
        ORDER BY month
      `;

      const trendsData = await db.prepare(trendsQuery).all(twelveMonthsAgo.toISOString());
      
      // Calculate bags sold for each month (sum of all line item quantities)
      const bagsQuery = `
        WITH monthly_bags AS (
          SELECT 
            c.assignedto as owner,
            TO_CHAR(o.createdat::timestamp, 'YYYY-MM') as month,
            COALESCE(SUM((li->>'quantity')::integer), 0) as bags
          FROM customers c
          JOIN all_orders o ON LOWER(c.email) = LOWER(o.customeremail)
          CROSS JOIN LATERAL json_array_elements(o.lineitems::json) AS li
          WHERE c.assignedto IN ('iand@kineticdogfood.com', 'ericb@kineticdogfood.com', 'Dave@kineticdogfood.com', 'lindsey@kineticdogfood.com')
            AND o.createdat::timestamp >= $1
          GROUP BY c.assignedto, TO_CHAR(o.createdat::timestamp, 'YYYY-MM')
        )
        SELECT 
          month,
          SUM(bags) as bags
        FROM monthly_bags
        GROUP BY month
        ORDER BY month
      `;

      const bagsData = await db.prepare(bagsQuery).all(twelveMonthsAgo.toISOString());
      
      // Combine trends and bags data
      const combinedData = trendsData.map(trend => {
        const bags = bagsData.find(b => b.month === trend.month);
        return {
          month: `${trend.month}-01`,
          orders: parseInt(trend.orders),
          revenue: parseFloat(trend.revenue),
          bags: parseInt(bags?.bags || 0),
          activeTeamMembers: trend.active_team_members
        };
      });

      return NextResponse.json({ trends: combinedData });

    } else {
      // Personal view - show trends for specific user
      const trendsQuery = `
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

      const trendsData = await db.prepare(trendsQuery).all(userEmail, twelveMonthsAgo.toISOString());
      
      // Calculate bags sold for each month (sum of all line item quantities)
      const bagsQuery = `
        SELECT 
          TO_CHAR(o.createdat::timestamp, 'YYYY-MM') as month,
          COALESCE(SUM((li->>'quantity')::integer), 0) as bags
        FROM customers c
        JOIN all_orders o ON LOWER(c.email) = LOWER(o.customeremail)
        CROSS JOIN LATERAL json_array_elements(o.lineitems::json) AS li
        WHERE c.assignedto = $1
          AND o.createdat::timestamp >= $2
        GROUP BY TO_CHAR(o.createdat::timestamp, 'YYYY-MM')
        ORDER BY month
      `;

      const bagsData = await db.prepare(bagsQuery).all(userEmail, twelveMonthsAgo.toISOString());
      
      // Combine trends and bags data
      const combinedData = trendsData.map(trend => {
        const bags = bagsData.find(b => b.month === trend.month);
        return {
          month: `${trend.month}-01`,
          orders: parseInt(trend.orders),
          revenue: parseFloat(trend.revenue),
          bags: parseInt(bags?.bags || 0)
        };
      });

      return NextResponse.json({ trends: combinedData });
    }

  } catch (error) {
    console.error('Sales trends API error:', error);
    return NextResponse.json({ error: 'Failed to fetch sales trends' }, { status: 500 });
  }
}
