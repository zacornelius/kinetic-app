import { NextResponse } from "next/server";
import db from "@/lib/database";
import { mergeCustomerDataOnPurchase } from "@/lib/data-sync";

export async function POST() {
  try {
    console.log("Starting unified sync - populating all_orders from source tables...");
    
    // Clear existing all_orders data
    db.prepare("DELETE FROM all_orders").run();
    console.log("Cleared existing all_orders data");
    
    // Sync Shopify orders to all_orders
    const shopifyOrders = await db.prepare(`
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
    const quickbooksOrders = await db.prepare(`
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
    
    // Sync customers to all_customers
    console.log("Syncing customers to all_customers...");
    
    // Clear existing all_customers
    db.prepare("DELETE FROM all_customers").run();
    
    // Sync Shopify customers
    const shopifyCustomers = await db.prepare(`
      SELECT id, email, firstName, lastName, phone, companyName,
             billingAddress, shippingAddress, createdAt, updatedAt
      FROM shopify_customers
    `).all();
    
    for (const customer of shopifyCustomers) {
      // Use INSERT OR REPLACE to handle customers that exist in both Shopify and QuickBooks
      db.prepare(`
        INSERT OR REPLACE INTO all_customers (
          id, email, firstName, lastName, phone, companyName,
          billingAddress, shippingAddress, createdAt, updatedAt, source, sourceId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        customer.id, customer.email, customer.firstName, customer.lastName,
        customer.phone, customer.companyName || '',
        customer.billingAddress || null,
        customer.shippingAddress || null,
        customer.createdAt, customer.updatedAt,
        'shopify', customer.id
      );
    }
    
    console.log(`Synced ${shopifyCustomers.length} Shopify customers to all_customers`);
    
    // Sync QuickBooks customers
    const quickbooksCustomers = await db.prepare(`
      SELECT id, email, firstName, lastName, phone, companyName,
             billingAddress, shippingAddress, createdAt, updatedAt, quickbooksId
      FROM quickbooks_customers
    `).all();
    
    for (const customer of quickbooksCustomers) {
      // Use INSERT OR REPLACE to handle customers that exist in both Shopify and QuickBooks
      db.prepare(`
        INSERT OR REPLACE INTO all_customers (
          id, email, firstName, lastName, phone, companyName,
          billingAddress, shippingAddress, createdAt, updatedAt, source, sourceId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        customer.id, customer.email, customer.firstName, customer.lastName,
        customer.phone, customer.companyName, customer.billingAddress,
        customer.shippingAddress, customer.createdAt, customer.updatedAt,
        'quickbooks', customer.quickbooksId
      );
    }
    
    console.log(`Synced ${quickbooksCustomers.length} QuickBooks customers to all_customers`);
    
    // Get final counts
    const totalAllOrders = await db.prepare("SELECT COUNT(*) as count FROM all_orders").get() as { count: number };
    const totalShopifyOrders = await db.prepare("SELECT COUNT(*) as count FROM shopify_orders").get() as { count: number };
    const totalQuickBooksOrders = await db.prepare("SELECT COUNT(*) as count FROM quickbooks_orders").get() as { count: number };
    const totalAllCustomers = await db.prepare("SELECT COUNT(*) as count FROM all_customers").get() as { count: number };
    const totalShopifyCustomers = await db.prepare("SELECT COUNT(*) as count FROM shopify_customers").get() as { count: number };
    const totalQuickBooksCustomers = await db.prepare("SELECT COUNT(*) as count FROM quickbooks_customers").get() as { count: number };
    
    // Merge customer data for prospects who have made purchases
    console.log("Merging customer data for prospects who have made purchases...");
    const mergeResult = mergeCustomerDataOnPurchase();
    console.log(`Merged ${mergeResult.merged} customers from prospect to customer status`);
    if (mergeResult.errors > 0) {
      console.log(`Encountered ${mergeResult.errors} errors during merge`);
    }

    console.log("Unified sync completed successfully!");
    console.log(`Total all_orders: ${totalAllOrders.count}`);
    console.log(`Total shopify_orders: ${totalShopifyOrders.count}`);
    console.log(`Total quickbooks_orders: ${totalQuickBooksOrders.count}`);
    console.log(`Total all_customers: ${totalAllCustomers.count}`);
    console.log(`Total shopify_customers: ${totalShopifyCustomers.count}`);
    console.log(`Total quickbooks_customers: ${totalQuickBooksCustomers.count}`);
    
    return NextResponse.json({
      success: true,
      message: `Successfully synced ${syncedCount} orders and ${shopifyCustomers.length + quickbooksCustomers.length} customers to unified tables`,
      stats: {
        allOrders: totalAllOrders.count,
        shopifyOrders: totalShopifyOrders.count,
        quickbooksOrders: totalQuickBooksOrders.count,
        allCustomers: totalAllCustomers.count,
        shopifyCustomers: totalShopifyCustomers.count,
        quickbooksCustomers: totalQuickBooksCustomers.count
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
