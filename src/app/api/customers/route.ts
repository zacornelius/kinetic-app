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
        c.createdAt,
        c.updatedAt,
        c.totalOrders,
        c.totalSpent as lifetimeValue,
        COALESCE(
          (SELECT MAX(o.createdAt) FROM shopify_orders o WHERE LOWER(o.customerEmail) = LOWER(c.email)),
          c.lastContactDate
        ) as lastOrderDate,
        COALESCE(
          (SELECT MIN(o.createdAt) FROM shopify_orders o WHERE LOWER(o.customerEmail) = LOWER(c.email)),
          c.createdAt
        ) as firstOrderDate
      FROM customers c
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (source) {
      query += ' AND EXISTS (SELECT 1 FROM customer_sources cs WHERE cs.customerId = c.id AND cs.source = ?)';
      params.push(source);
    }
    
    if (email) {
      query += ' AND c.email LIKE ?';
      params.push(`%${email}%`);
    }
    
    query += `
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, firstName, lastName, phone, companyName, source, status } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Generate a unique ID
    const id = Math.random().toString(36).substr(2, 9);
    const now = new Date().toISOString();

    // Insert customer
    db.prepare(`
      INSERT INTO customers (
        id, email, firstName, lastName, phone, companyName, 
        source, status, createdAt, updatedAt, totalOrders, totalSpent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
    `).run(
      id, email, firstName || 'Unknown', lastName || 'Customer', 
      phone || null, companyName || null, source || 'manual', 
      status || 'contact', now, now
    );

    // Add to customer sources
    db.prepare(`
      INSERT INTO customer_sources (id, customerId, source, sourceId)
      VALUES (?, ?, ?, ?)
    `).run(
      Math.random().toString(36).substr(2, 9), id, source || 'website', id
    );

    return NextResponse.json({ 
      id, 
      email, 
      firstName: firstName || 'Unknown', 
      lastName: lastName || 'Customer',
      status: status || 'contact'
    });

  } catch (error) {
    console.error("Error creating customer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

