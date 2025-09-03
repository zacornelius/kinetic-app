import { NextResponse } from "next/server";
import { syncAllDataToUnified } from "@/lib/data-sync";

export async function POST() {
  try {
    console.log('Starting unified data synchronization...');
    
    const results = syncAllDataToUnified();
    
    return NextResponse.json({
      success: true,
      message: "Data synchronized to unified tables successfully",
      results
    });
  } catch (error) {
    console.error('Error in unified data sync:', error);
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error.message 
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Return current sync status
    const db = (await import('@/lib/database')).default;
    
    const shopifyCustomersCount = db.prepare('SELECT COUNT(*) as count FROM shopify_customers').get() as { count: number };
    const quickbooksCustomersCount = db.prepare('SELECT COUNT(*) as count FROM quickbooks_customers').get() as { count: number };
    const allCustomersCount = db.prepare('SELECT COUNT(*) as count FROM all_customers').get() as { count: number };
    
    const shopifyOrdersCount = db.prepare('SELECT COUNT(*) as count FROM shopify_orders').get() as { count: number };
    const quickbooksOrdersCount = db.prepare('SELECT COUNT(*) as count FROM quickbooks_orders').get() as { count: number };
    const allOrdersCount = db.prepare('SELECT COUNT(*) as count FROM all_orders').get() as { count: number };
    
    return NextResponse.json({
      customers: {
        shopify: shopifyCustomersCount.count,
        quickbooks: quickbooksCustomersCount.count,
        all: allCustomersCount.count
      },
      orders: {
        shopify: shopifyOrdersCount.count,
        quickbooks: quickbooksOrdersCount.count,
        all: allOrdersCount.count
      }
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
