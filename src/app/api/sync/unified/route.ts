import { NextResponse } from "next/server";
import db from "@/lib/database";

export async function POST() {
  try {
    console.log("Starting unified sync - populating all_orders from source tables...");
    
    // Clear existing all_orders data
    db.prepare("DELETE FROM all_orders").run();
    console.log("Cleared existing all_orders data");
    
    // Sync Shopify orders to all_orders
    const shopifyOrders = db.prepare(`
      SELECT 
        id,
        createdAt,
        orderNumber,
        customerEmail,
        customerName,
        totalAmount,
        currency,
        status,
        shippingAddress,
        trackingNumber,
        notes,
        ownerEmail,
        lineItems
      FROM shopify_orders
    `).all();
    
    console.log(`Found ${shopifyOrders.length} Shopify orders to sync`);
    
    const insertAllOrder = db.prepare(`
      INSERT INTO all_orders (
        id, createdAt, orderNumber, customerEmail, customerName, 
        totalAmount, currency, status, shippingAddress, trackingNumber, 
        notes, ownerEmail, source, sourceId, lineItems
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    let syncedCount = 0;
    for (const order of shopifyOrders) {
      insertAllOrder.run(
        order.id,
        order.createdAt,
        order.orderNumber,
        order.customerEmail,
        order.customerName,
        order.totalAmount,
        order.currency,
        order.status,
        order.shippingAddress,
        order.trackingNumber,
        order.notes,
        order.ownerEmail,
        'shopify',
        order.id,
        order.lineItems
      );
      syncedCount++;
    }
    
    console.log(`Synced ${syncedCount} Shopify orders to all_orders`);
    
    // Sync QuickBooks orders to all_orders (if any exist)
    const quickbooksOrders = db.prepare(`
      SELECT 
        id,
        createdAt,
        orderNumber,
        customerEmail,
        customerName,
        totalAmount,
        currency,
        status,
        shippingAddress,
        billingAddress,
        dueDate,
        notes,
        ownerEmail,
        lineItems
      FROM quickbooks_orders
    `).all();
    
    console.log(`Found ${quickbooksOrders.length} QuickBooks orders to sync`);
    
    const insertQuickBooksOrder = db.prepare(`
      INSERT INTO all_orders (
        id, createdAt, orderNumber, customerEmail, customerName, 
        totalAmount, currency, status, shippingAddress, billingAddress, 
        dueDate, notes, ownerEmail, source, sourceId, lineItems
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const order of quickbooksOrders) {
      insertQuickBooksOrder.run(
        order.id,
        order.createdAt,
        order.orderNumber,
        order.customerEmail,
        order.customerName,
        order.totalAmount,
        order.currency,
        order.status,
        order.shippingAddress,
        order.billingAddress,
        order.dueDate,
        order.notes,
        order.ownerEmail,
        'quickbooks',
        order.id,
        order.lineItems
      );
      syncedCount++;
    }
    
    console.log(`Synced ${quickbooksOrders.length} QuickBooks orders to all_orders`);
    
    // Get final counts
    const totalAllOrders = db.prepare("SELECT COUNT(*) as count FROM all_orders").get() as { count: number };
    const totalShopifyOrders = db.prepare("SELECT COUNT(*) as count FROM shopify_orders").get() as { count: number };
    const totalQuickBooksOrders = db.prepare("SELECT COUNT(*) as count FROM quickbooks_orders").get() as { count: number };
    
    console.log("Unified sync completed successfully!");
    console.log(`Total all_orders: ${totalAllOrders.count}`);
    console.log(`Total shopify_orders: ${totalShopifyOrders.count}`);
    console.log(`Total quickbooks_orders: ${totalQuickBooksOrders.count}`);
    
    return NextResponse.json({
      success: true,
      message: `Successfully synced ${syncedCount} orders to unified table`,
      stats: {
        allOrders: totalAllOrders.count,
        shopifyOrders: totalShopifyOrders.count,
        quickbooksOrders: totalQuickBooksOrders.count
      }
    });
    
  } catch (error) {
    console.error("Unified sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync unified data", details: error.message },
      { status: 500 }
    );
  }
}
