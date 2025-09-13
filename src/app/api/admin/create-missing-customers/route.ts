import { NextResponse } from "next/server";
import db from "@/lib/database";

export async function POST() {
  try {
    console.log('Creating missing customers from orders...');

    // Find orders where customer doesn't exist in customers table from ALL sources
    const missingCustomersQuery = `
      SELECT DISTINCT
        email,
        name,
        source,
        MIN(first_order_date) as first_order_date,
        SUM(order_count) as order_count,
        SUM(total_spent) as total_spent
      FROM (
        SELECT 
          customeremail as email,
          customername as name,
          'shopify' as source,
          MIN(createdat::timestamp) as first_order_date,
          COUNT(*) as order_count,
          SUM(totalamount) as total_spent
        FROM shopify_orders
        WHERE customeremail IS NOT NULL AND customeremail != ''
        GROUP BY customeremail, customername
        
        UNION ALL
        
        SELECT 
          customeremail as email,
          customername as name,
          'distributor' as source,
          MIN(createdat::timestamp) as first_order_date,
          COUNT(*) as order_count,
          SUM(totalamount) as total_spent
        FROM distributor_orders
        WHERE customeremail IS NOT NULL AND customeremail != ''
        GROUP BY customeremail, customername
        
        UNION ALL
        
        SELECT 
          customeremail as email,
          customername as name,
          'digital' as source,
          MIN(createdat::timestamp) as first_order_date,
          COUNT(*) as order_count,
          SUM(totalamount) as total_spent
        FROM digital_orders
        WHERE customeremail IS NOT NULL AND customeremail != ''
        GROUP BY customeremail, customername
      ) all_orders
      WHERE NOT EXISTS (
        SELECT 1 FROM customers c 
        WHERE LOWER(c.email) = LOWER(all_orders.email)
      )
      GROUP BY email, name, source
      ORDER BY first_order_date DESC
    `;

    const missingCustomers = await db.prepare(missingCustomersQuery).all() as Array<{
      email: string;
      name: string;
      source: string;
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
          customer.source,
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
