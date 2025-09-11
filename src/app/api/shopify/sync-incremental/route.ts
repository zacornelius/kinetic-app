import { NextResponse } from "next/server";
import db from "@/lib/database";

export async function POST(request: Request) {
  try {
    const { limit = 250, maxPages = 2 } = await request.json();

    // Get environment variables (server-side only)
    const shop = process.env.SHOPIFY_SHOP;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!shop || !accessToken) {
      return NextResponse.json(
        { error: "Shopify configuration not found in environment variables" },
        { status: 500 }
      );
    }

    // Get the last synced order ID
    const lastOrder = await db.prepare('SELECT "shopifyorderid" FROM shopify_orders WHERE "shopifyorderid" IS NOT NULL ORDER BY "createdat" DESC LIMIT 1').get() as { shopifyorderid: string } | undefined;
    
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
        limit,
        maxPages,
        sinceId: lastOrder.shopifyorderid
      })
    });

    const result = await syncResponse.json();
    
    if (syncResponse.ok) {
      // Return the same data structure as the main sync for consistency
      return NextResponse.json({
        success: true,
        message: `Incremental sync completed. ${result.stats.inserted} new orders added.`,
        stats: {
          total: result.stats.orders || 0,
          inserted: result.stats.inserted || 0,
          updated: result.stats.updated || 0,
          orders: result.stats.orders || 0,
          customers: result.stats.customers || 0,
          products: result.stats.products || 0,
          lineItems: result.stats.lineItems || 0
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
