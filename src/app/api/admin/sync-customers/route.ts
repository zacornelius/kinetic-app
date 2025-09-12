import { NextResponse } from "next/server";
import db from "@/lib/database";

export async function POST() {
  try {
    console.log('Starting customer sync from shopify_customers to customers...');

    // Get all shopify customers that don't exist in main customers table
    const syncQuery = `
      INSERT INTO customers (
        id, email, firstname, lastname, phone, companyname, 
        shippingaddress, billingaddress, createdat, updatedat,
        source, assignedto, status, customertype, customercategory
      )
      SELECT 
        sc.id,
        sc.email,
        sc.firstname,
        sc.lastname,
        sc.phone,
        sc.companyname,
        sc.shippingaddress,
        sc.billingaddress,
        sc.createdat::timestamp,
        sc.updatedat::timestamp,
        'shopify' as source,
        NULL as assignedto,
        'Active' as status,
        'Customer' as customertype,
        NULL as customercategory
      FROM shopify_customers sc
      WHERE NOT EXISTS (
        SELECT 1 FROM customers c 
        WHERE LOWER(c.email) = LOWER(sc.email)
      )
      ON CONFLICT (email) DO NOTHING
    `;

    const syncResult = await db.prepare(syncQuery).run();
    console.log(`Synced ${syncResult.changes} customers from shopify_customers to customers table`);

    // Update customer order counts and totals
    console.log('Updating customer order counts and totals...');
    const updateQuery = `
      UPDATE customers 
      SET 
        totalorders = (
          SELECT COUNT(*) 
          FROM shopify_orders 
          WHERE LOWER(customeremail) = LOWER(customers.email)
        ),
        totalspent = (
          SELECT COALESCE(SUM(totalamount), 0)
          FROM shopify_orders 
          WHERE LOWER(customeremail) = LOWER(customers.email)
        ),
        updatedat = CURRENT_TIMESTAMP
      WHERE source = 'shopify'
    `;
    
    const updateResult = await db.prepare(updateQuery).run();
    console.log(`Updated order counts for ${updateResult.changes} customers`);

    // Get the newly synced customers
    const newCustomersQuery = `
      SELECT id, email, firstname, lastname 
      FROM customers 
      WHERE source = 'shopify' 
      AND updatedat > CURRENT_TIMESTAMP - INTERVAL '1 minute'
      ORDER BY updatedat DESC
      LIMIT 10
    `;
    
    const newCustomers = await db.prepare(newCustomersQuery).all() as Array<{
      id: string;
      email: string;
      firstname: string;
      lastname: string;
    }>;

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${syncResult.changes} customers and updated ${updateResult.changes} customer totals`,
      newCustomers: newCustomers,
      stats: {
        synced: syncResult.changes,
        updated: updateResult.changes
      }
    });

  } catch (error) {
    console.error('Error syncing customers:', error);
    return NextResponse.json({ 
      error: "Failed to sync customers",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
