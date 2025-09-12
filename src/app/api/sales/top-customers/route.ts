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
      // Leaderboard view - show top customers across all sales team (using shopify_orders only for now)
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
        LEFT JOIN (
          SELECT ordernumber, customeremail, totalamount, createdat::timestamp as createdat FROM shopify_orders
          UNION ALL
          SELECT ordernumber, customeremail, totalamount, createdat::timestamp as createdat FROM distributor_orders
          UNION ALL
          SELECT ordernumber, customeremail, totalamount, createdat::timestamp as createdat FROM digital_orders
        ) o ON c.email = o.customeremail
        WHERE c.assignedto IN ('iand@kineticdogfood.com', 'ericb@kineticdogfood.com', 'Dave@kineticdogfood.com')
          AND o.ordernumber IS NOT NULL
        GROUP BY c.email, c.firstname, c.lastname, c.assignedto, c.customertype, c.customercategory, c.status, c.phone, c.companyname
        ORDER BY total_spent DESC
        LIMIT $1
      `;

      const topCustomers = await db.prepare(leaderboardQuery).all(limit);
      return NextResponse.json({ topCustomers });
    } else {
      // Personal view - show top customers for the logged-in user (using shopify_orders only for now)
      const personalQuery = `
        SELECT 
          c.email,
          c.firstname,
          c.lastname,
          c.assignedto,
          c.customertype,
          c.customercategory,
          c.status,
          c.phone,
          c.companyname,
          COUNT(DISTINCT o.ordernumber) as order_count,
          COALESCE(SUM(o.totalamount), 0) as total_spent,
          MAX(o.createdat) as last_order_date
        FROM customers c
        LEFT JOIN (
          SELECT ordernumber, customeremail, totalamount, createdat::timestamp as createdat FROM shopify_orders
          UNION ALL
          SELECT ordernumber, customeremail, totalamount, createdat::timestamp as createdat FROM distributor_orders
          UNION ALL
          SELECT ordernumber, customeremail, totalamount, createdat::timestamp as createdat FROM digital_orders
        ) o ON c.email = o.customeremail
        WHERE c.assignedto = $1
          AND o.ordernumber IS NOT NULL
        GROUP BY c.email, c.firstname, c.lastname, c.assignedto, c.customertype, c.customercategory, c.status, c.phone, c.companyname
        ORDER BY total_spent DESC
        LIMIT $2
      `;

      const topCustomers = await db.prepare(personalQuery).all(userEmail, limit);
      return NextResponse.json({ topCustomers });
    }
  } catch (error) {
    console.error('Top customers API error:', error);
    return NextResponse.json({ error: 'Failed to fetch top customers' }, { status: 500 });
  }
}
