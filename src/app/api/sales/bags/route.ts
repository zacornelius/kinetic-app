import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');
    const view = searchParams.get('view') || 'personal';
    const month = searchParams.get('month'); // YYYY-MM format

    if (!userEmail) {
      return NextResponse.json({ error: 'User email is required' }, { status: 400 });
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const thisMonthStart = new Date(currentYear, currentMonth - 1, 1);
    const twelveMonthsAgo = new Date(currentYear - 1, currentMonth - 1, 1);

    let dateFilter = '';
    let params: any[] = [];

    if (month) {
      // Specific month
      const monthStart = new Date(month + '-01');
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
      dateFilter = 'AND o.createdat::timestamp >= $3 AND o.createdat::timestamp < $4';
      params = [userEmail, twelveMonthsAgo.toISOString(), monthStart.toISOString(), monthEnd.toISOString()];
    } else {
      // This month
      dateFilter = 'AND o.createdat::timestamp >= $3';
      params = [userEmail, twelveMonthsAgo.toISOString(), thisMonthStart.toISOString()];
    }

    if (view === 'leaderboard') {
      // Leaderboard view - bags sold by all team members
      const bagsQuery = `
        WITH bag_counts AS (
          SELECT 
            c.assignedto as owner,
            COALESCE(SUM((li->>'quantity')::integer), 0) as bags_sold
          FROM customers c
          JOIN all_orders o ON LOWER(c.email) = LOWER(o.customeremail)
          CROSS JOIN LATERAL json_array_elements(o.lineitems::json) AS li
          WHERE c.assignedto IN ('iand@kineticdogfood.com', 'ericb@kineticdogfood.com', 'Dave@kineticdogfood.com', 'lindsey@kineticdogfood.com')
            AND o.createdat::timestamp >= $1
            ${dateFilter}
          GROUP BY c.assignedto
        )
        SELECT 
          owner,
          bags_sold,
          CASE 
            WHEN owner = 'iand@kineticdogfood.com' THEN 'Ian'
            WHEN owner = 'ericb@kineticdogfood.com' THEN 'Eric'
            WHEN owner = 'Dave@kineticdogfood.com' THEN 'Dave'
            WHEN owner = 'lindsey@kineticdogfood.com' THEN 'Lindsey'
            ELSE SPLIT_PART(owner, '@', 1)
          END as displayName
        FROM bag_counts
        ORDER BY bags_sold DESC
      `;

      const bagsData = await db.prepare(bagsQuery).all(...params);
      return NextResponse.json({ bagsData });

    } else {
      // Personal view - bags sold by specific user
      const bagsQuery = `
        SELECT 
          COALESCE(SUM((li->>'quantity')::integer), 0) as bags_sold
        FROM customers c
        JOIN all_orders o ON LOWER(c.email) = LOWER(o.customeremail)
        CROSS JOIN LATERAL json_array_elements(o.lineitems::json) AS li
        WHERE c.assignedto = $1
          AND o.createdat::timestamp >= $2
          ${dateFilter}
      `;

      const result = await db.prepare(bagsQuery).all(...params);
      return NextResponse.json({ bagsSold: result[0]?.bags_sold || 0 });
    }

  } catch (error) {
    console.error('Bags API error:', error);
    return NextResponse.json({ error: 'Failed to fetch bags data' }, { status: 500 });
  }
}
