import { NextResponse } from "next/server";

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

    // Get the last synced order ID for incremental sync
    const db = (await import('@/lib/database')).default;
    const lastOrder = await db.prepare('SELECT shopifyOrderId FROM shopify_orders WHERE shopifyOrderId IS NOT NULL ORDER BY createdAt DESC LIMIT 1').get() as { shopifyOrderId: string } | undefined;

    if (!lastOrder) {
      return NextResponse.json({
        success: false,
        message: "No existing orders found. Please run a full sync first.",
        stats: { total: 0, inserted: 0, updated: 0 }
      });
    }

    // Call the main sync endpoint with server-side credentials for incremental sync
    const syncResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/shopify/sync-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop,
        accessToken,
        limit,
        maxPages,
        sinceId: lastOrder.shopifyOrderId // Incremental sync from last order
      }),
    });

    if (!syncResponse.ok) {
      const errorData = await syncResponse.json();
      return NextResponse.json(
        { error: `Incremental sync failed: ${errorData.error || syncResponse.statusText}` },
        { status: syncResponse.status }
      );
    }

    const result = await syncResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in incremental sync:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
