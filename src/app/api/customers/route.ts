import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/database";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');
    const email = searchParams.get('email');

    let query = `
      SELECT 
        c.id,
        c.email,
        c.firstName,
        c.lastName,
        c.phone,
        c.companyName,
        c.billingAddress,
        c.shippingAddress,
        c.source,
        c.sourceId,
        c.createdAt,
        c.updatedAt,
        COUNT(DISTINCT o.id) as totalOrders,
        COALESCE(SUM(o.totalAmount), 0) as lifetimeValue,
        MAX(o.createdAt) as lastOrderDate,
        MIN(o.createdAt) as firstOrderDate
      FROM all_customers c
      LEFT JOIN all_orders o ON c.email = o.customerEmail
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (source) {
      query += ' AND c.source = ?';
      params.push(source);
    }
    
    if (email) {
      query += ' AND c.email LIKE ?';
      params.push(`%${email}%`);
    }
    
    query += `
      GROUP BY c.id, c.email, c.firstName, c.lastName, c.phone, c.companyName, 
               c.billingAddress, c.shippingAddress, c.source, c.sourceId, c.createdAt, c.updatedAt
      ORDER BY lifetimeValue DESC, totalOrders DESC
    `;

    const customers = db.prepare(query).all(...params);

    return NextResponse.json(customers);
  } catch (error) {
    console.error("Error fetching customers:", error);
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 }
    );
  }
}

