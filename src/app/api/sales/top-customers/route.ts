import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { cache, cacheKeys } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');
    const view = searchParams.get('view') || 'personal'; // 'personal' or 'leaderboard'
    const limit = parseInt(searchParams.get('limit') || '5');

    if (!userEmail) {
      return NextResponse.json({ error: 'User email is required' }, { status: 400 });
    }

    // Check cache first
    const cacheKey = cacheKeys.topCustomers(userEmail, view, limit);
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // Optimized query with better performance
    if (view === 'leaderboard') {
      // Leaderboard view - show top customers across all sales team
      const leaderboardQuery = `
        WITH customer_orders AS (
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
            o.totalamount,
            o.createdat::timestamp as createdat,
            o.ordernumber
          FROM customers c
          INNER JOIN all_orders o ON LOWER(c.email) = LOWER(o.customeremail)
          WHERE c.assignedto IN ('iand@kineticdogfood.com', 'ericb@kineticdogfood.com', 'Dave@kineticdogfood.com', 'lindsey@kineticdogfood.com')
        )
        SELECT 
          email,
          firstname,
          lastname,
          owner,
          customertype,
          customercategory,
          status,
          phone,
          companyname,
          COUNT(DISTINCT ordernumber) as order_count,
          COALESCE(SUM(totalamount), 0) as total_spent,
          MAX(createdat) as last_order_date
        FROM customer_orders
        GROUP BY email, firstname, lastname, owner, customertype, customercategory, status, phone, companyname
        ORDER BY total_spent DESC
        LIMIT $1
      `;

      const topCustomers = await db.prepare(leaderboardQuery).all(limit);
      const result = { topCustomers };
      
      // Cache for 5 minutes (customer data changes less frequently)
      cache.set(cacheKey, result, 5 * 60 * 1000);
      
      return NextResponse.json(result);
    } else {
      // Personal view - show top customers for the logged-in user
      const personalQuery = `
        WITH customer_orders AS (
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
            o.totalamount,
            o.createdat::timestamp as createdat,
            o.ordernumber
          FROM customers c
          INNER JOIN all_orders o ON LOWER(c.email) = LOWER(o.customeremail)
          WHERE c.assignedto = $1
        )
        SELECT 
          email,
          firstname,
          lastname,
          assignedto,
          customertype,
          customercategory,
          status,
          phone,
          companyname,
          COUNT(DISTINCT ordernumber) as order_count,
          COALESCE(SUM(totalamount), 0) as total_spent,
          MAX(createdat) as last_order_date
        FROM customer_orders
        GROUP BY email, firstname, lastname, assignedto, customertype, customercategory, status, phone, companyname
        ORDER BY total_spent DESC
        LIMIT $2
      `;

      const topCustomers = await db.prepare(personalQuery).all(userEmail, limit);
      const result = { topCustomers };
      
      // Cache for 5 minutes (customer data changes less frequently)
      cache.set(cacheKey, result, 5 * 60 * 1000);
      
      return NextResponse.json(result);
    }
  } catch (error) {
    console.error('Top customers API error:', error);
    return NextResponse.json({ error: 'Failed to fetch top customers' }, { status: 500 });
  }
}
