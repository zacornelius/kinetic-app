import { NextResponse } from "next/server";
import db from "@/lib/database";

export async function POST(request: Request) {
  try {
    const { shop, accessToken } = await request.json();

    if (!shop || !accessToken) {
      return NextResponse.json(
        { error: "Shop and access token are required" },
        { status: 400 }
      );
    }

    // Get the last synced order ID
    const lastOrder = db.prepare('SELECT shopifyOrderId FROM shopify_orders WHERE shopifyOrderId IS NOT NULL ORDER BY createdAt DESC LIMIT 1').get() as { shopifyOrderId: string } | undefined;
    
    if (!lastOrder) {
      return NextResponse.json({
        success: false,
        message: "No existing orders found. Please run a full sync first.",
        stats: { total: 0, inserted: 0, updated: 0 }
      });
    }

    // Call the main sync endpoint with the last order ID
    const syncResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/shopify/sync-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop,
        accessToken,
        limit: 250,
        sinceId: lastOrder.shopifyOrderId
      })
    });

    const result = await syncResponse.json();
    
    if (syncResponse.ok) {
      // Update customer records with new order data
      const newOrders = db.prepare(`
        SELECT DISTINCT customerEmail, customerName, totalAmount, currency 
        FROM shopify_orders 
        WHERE createdAt > datetime('now', '-1 hour')
      `).all();
      
      let customersUpdated = 0;
      for (const order of newOrders) {
        // Check if customer exists
        const existingCustomer = db.prepare('SELECT id FROM customers WHERE email = ?').get(order.customerEmail);
        
        if (!existingCustomer) {
          // Create new customer
          const customerId = `c_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          db.prepare(`
            INSERT INTO customers (
              id, email, firstName, lastName, phone, companyName,
              billingAddress, shippingAddress, createdAt, updatedAt, lastContactDate,
              totalInquiries, totalOrders, totalSpent,
              status, tags, notes, assignedTo, source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            customerId,
            order.customerEmail,
            order.customerName?.split(' ')[0] || '',
            order.customerName?.split(' ').slice(1).join(' ') || '',
            '', '', '', '', 
            new Date().toISOString(),
            new Date().toISOString(),
            new Date().toISOString(),
            0, 1, order.totalAmount || 0,
            'customer', '[]', '[]', null, 'shopify'
          );
          customersUpdated++;
        } else {
          // Update existing customer's order count and spending
          db.prepare(`
            UPDATE customers 
            SET totalOrders = totalOrders + 1,
                totalSpent = totalSpent + ?,
                updatedAt = ?,
                lastContactDate = ?
            WHERE email = ?
          `).run(order.totalAmount || 0, new Date().toISOString(), new Date().toISOString(), order.customerEmail);
          customersUpdated++;
        }
      }
      
      return NextResponse.json({
        success: true,
        message: `Incremental sync completed. ${result.stats.inserted} new orders added. Updated ${customersUpdated} customer records.`,
        stats: {
          ...result.stats,
          customersUpdated
        }
      });
    } else {
      return NextResponse.json(result, { status: syncResponse.status });
    }

  } catch (error) {
    console.error('Incremental sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync new orders" },
      { status: 500 }
    );
  }
}
