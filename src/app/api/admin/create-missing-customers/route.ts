import { NextResponse } from "next/server";
import db from "@/lib/database";

export async function POST() {
  try {
    console.log('Creating missing customers from orders...');

    // Find orders where customer doesn't exist in customers table
    const missingCustomersQuery = `
      SELECT DISTINCT
        so.customeremail as email,
        so.customername as name,
        MIN(so.createdat) as first_order_date,
        COUNT(*) as order_count,
        SUM(so.totalamount) as total_spent
      FROM shopify_orders so
      WHERE NOT EXISTS (
        SELECT 1 FROM customers c 
        WHERE LOWER(c.email) = LOWER(so.customeremail)
      )
      AND so.customeremail IS NOT NULL
      AND so.customeremail != ''
      GROUP BY so.customeremail, so.customername
      ORDER BY first_order_date DESC
    `;

    const missingCustomers = await db.prepare(missingCustomersQuery).all() as Array<{
      email: string;
      name: string;
      first_order_date: string;
      order_count: number;
      total_spent: number;
    }>;

    console.log(`Found ${missingCustomers.length} missing customers`);

    if (missingCustomers.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No missing customers found",
        created: 0
      });
    }

    let createdCount = 0;
    const createdCustomers = [];

    for (const customer of missingCustomers) {
      try {
        // Parse customer name
        const nameParts = customer.name ? customer.name.split(' ') : [];
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        // Generate unique ID
        const id = Math.random().toString(36).slice(2, 10);

        const insertQuery = `
          INSERT INTO customers (
            id, email, firstname, lastname, phone, companyname,
            shippingaddress, billingaddress, createdat, updatedat,
            source, assignedto, status, customertype, customercategory,
            totalorders, totalspent
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (email) DO NOTHING
        `;

        const result = await db.prepare(insertQuery).run(
          id,
          customer.email,
          firstName,
          lastName,
          null, // phone
          null, // companyname
          null, // shippingaddress
          null, // billingaddress
          customer.first_order_date,
          new Date().toISOString(),
          'shopify',
          null, // assignedto
          'Active',
          'Customer',
          null, // customercategory
          customer.order_count,
          customer.total_spent
        );

        if (result.changes > 0) {
          createdCount++;
          createdCustomers.push({
            email: customer.email,
            name: customer.name,
            orders: customer.order_count,
            total: customer.total_spent
          });
        }
      } catch (error) {
        console.error(`Error creating customer ${customer.email}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Created ${createdCount} missing customers`,
      created: createdCount,
      customers: createdCustomers
    });

  } catch (error) {
    console.error('Error creating missing customers:', error);
    return NextResponse.json({ 
      error: "Failed to create missing customers",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
