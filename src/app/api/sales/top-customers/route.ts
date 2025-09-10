import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');
    const view = searchParams.get('view') || 'personal'; // 'personal' or 'leaderboard'
    const limit = parseInt(searchParams.get('limit') || '5');

    if (!userEmail) {
      return NextResponse.json({ error: 'User email is required' }, { status: 400 });
    }

    if (view === 'leaderboard') {
      // Leaderboard view - show top customers across all sales team
      const leaderboardQuery = `
        SELECT 
          c.email,
          c.firstname,
          c.lastname,
          c.assignedto as owner,
          COUNT(DISTINCT o.ordernumber) as order_count,
          COALESCE(SUM(o.totalamount), 0) as total_spent,
          MAX(o.createdat) as last_order_date
        FROM customers c
        LEFT JOIN shopify_orders o ON c.email = o.customeremail
        WHERE c.assignedto IN ('iand@kineticdogfood.com', 'ericb@kineticdogfood.com', 'Dave@kineticdogfood.com')
          AND o.ordernumber IS NOT NULL
        GROUP BY c.email, c.firstname, c.lastname, c.assignedto
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
          COUNT(DISTINCT o.ordernumber) as order_count,
          COALESCE(SUM(o.totalamount), 0) as total_spent,
          MAX(o.createdat) as last_order_date
        FROM customers c
        LEFT JOIN shopify_orders o ON c.email = o.customeremail
        WHERE c.assignedto = ?
          AND o.ordernumber IS NOT NULL
        GROUP BY c.email, c.firstname, c.lastname
        ORDER BY total_spent DESC
        LIMIT ?
      `;

      const topCustomers = await db.prepare(personalQuery).all(userEmail, limit);
      return NextResponse.json({ topCustomers });
    }
  } catch (error) {
    console.error('Top customers API error:', error);
    return NextResponse.json({ error: 'Failed to fetch top customers' }, { status: 500 });
  }
}
