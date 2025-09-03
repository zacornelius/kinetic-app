import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/database";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    let query = `
      SELECT 
        c.id,
        c.email,
        c.firstName,
        c.lastName,
        c.phone,
        c.createdAt,
        c.updatedAt,
        COUNT(DISTINCT o.id) as totalOrders,
        COALESCE(SUM(o.totalAmount), 0) as lifetimeValue,
        MAX(o.createdAt) as lastOrderDate,
        MIN(o.createdAt) as firstOrderDate
      FROM shopify_customers c
      LEFT JOIN shopify_orders o ON c.email = o.customerEmail
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (email) {
      query += ' AND c.email LIKE ?';
      params.push(`%${email}%`);
    }
    
    query += `
      GROUP BY c.id, c.email, c.firstName, c.lastName, c.phone, c.createdAt, c.updatedAt
      ORDER BY lifetimeValue DESC, totalOrders DESC
    `;

    const customers = db.prepare(query).all(...params);
    
    return NextResponse.json(customers);
  } catch (error) {
    console.error('Error fetching Shopify customers:', error);
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 }
    );
  }
}
