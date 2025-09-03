import { NextResponse } from "next/server";
import db from "@/lib/database";

export async function GET() {
  try {
    // Test if database persists between requests
    const testKey = 'test_counter';
    
    // Try to get current counter
    let counter = 0;
    try {
      const result = db.prepare('SELECT value FROM test_counter WHERE key = ?').get(testKey);
      counter = result ? result.value : 0;
    } catch (error) {
      // Table doesn't exist, create it
      db.exec('CREATE TABLE IF NOT EXISTS test_counter (key TEXT PRIMARY KEY, value INTEGER)');
    }
    
    // Increment counter
    counter++;
    db.prepare('INSERT OR REPLACE INTO test_counter (key, value) VALUES (?, ?)').run(testKey, counter);
    
    // Check table counts
    const shopifyOrders = db.prepare('SELECT COUNT(*) as count FROM shopify_orders').get();
    const allOrders = db.prepare('SELECT COUNT(*) as count FROM all_orders').get();
    const shopifyCustomers = db.prepare('SELECT COUNT(*) as count FROM shopify_customers').get();
    const allCustomers = db.prepare('SELECT COUNT(*) as count FROM all_customers').get();
    
    return NextResponse.json({
      message: "Database persistence test",
      counter: counter,
      databasePath: process.env.NODE_ENV === 'production' ? 'Heroku persistent' : 'local',
      tableCounts: {
        shopifyOrders: shopifyOrders.count,
        allOrders: allOrders.count,
        shopifyCustomers: shopifyCustomers.count,
        allCustomers: allCustomers.count
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Database test failed" },
      { status: 500 }
    );
  }
}
