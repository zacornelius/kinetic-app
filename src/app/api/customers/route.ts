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
        c.firstname as "firstName",
        c.lastname as "lastName",
        c.phone,
        c.companyname as "companyName",
        c.billingaddress as "billingAddress",
        c.shippingaddress as "shippingAddress",
        c.createdat as "createdAt",
        c.updatedat as "updatedAt",
        c.totalorders as "totalOrders",
        c.totalspent as "totalSpent",
        c.totalspent as lifetimeValue,
        c.createdat as lastOrderDate,
        c.createdat as firstOrderDate,
        c.assignedto as "assignedto",
        c.status,
        c.customertype as "customerType",
        c.customercategory as "customerCategory"
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
      ORDER BY lifetimeValue DESC, "totalOrders" DESC
    `;

    const customers = await db.prepare(query).all(...params);

    // Get order statistics for each customer
    const orderStatsQuery = `
      SELECT 
        LOWER(customeremail) as customer_email,
        SUM(totalamount) as lifetime_value,
        MAX(createdat::text) as last_order_date,
        MIN(createdat::text) as first_order_date,
        COUNT(*) as order_count
      FROM shopify_orders
      GROUP BY LOWER(customeremail)
    `;
    
    const orderStats = await db.prepare(orderStatsQuery).all();
    
    // Create a map of order statistics by customer email
    const orderStatsMap = new Map();
    orderStats.forEach(stat => {
      orderStatsMap.set(stat.customer_email, stat);
    });
    
    // Enhance customers with order statistics
    const enhancedCustomers = customers.map(customer => {
      const email = customer.email.toLowerCase();
      const stats = orderStatsMap.get(email);
      
      return {
        ...customer,
        lifetimeValue: stats ? parseFloat(stats.lifetime_value) : customer.totalSpent || 0,
        lastOrderDate: stats ? stats.last_order_date : customer.createdAt,
        firstOrderDate: stats ? stats.first_order_date : customer.createdAt
      };
    });

    return NextResponse.json(enhancedCustomers);
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
        id, email, firstname, lastname, phone, companyname, 
        source, status, customertype, createdat, updatedat, totalorders, totalspent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
    `).run(
      id, email, firstName || 'Unknown', lastName || 'Customer', 
      phone || null, companyName || null, source || 'manual', 
      status || 'contact', body.customertype || null, now, now
    );

    // Add to customer sources
    db.prepare(`
      INSERT INTO customer_sources (id, customerid, source, sourceid, firstseen, lastseen)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      Math.random().toString(36).substr(2, 9), id, source || 'website', id, now, now
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

