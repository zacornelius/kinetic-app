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
    const lastOrder = db.prepare('SELECT shopifyOrderId FROM orders WHERE shopifyOrderId IS NOT NULL ORDER BY createdAt DESC LIMIT 1').get() as { shopifyOrderId: string } | undefined;
    
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
      return NextResponse.json({
        success: true,
        message: `Incremental sync completed. ${result.stats.inserted} new orders added.`,
        stats: result.stats
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
