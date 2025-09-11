import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { limit = 250, maxPages = 10 } = await request.json();

    // Get environment variables (server-side only)
    const shop = process.env.SHOPIFY_SHOP;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!shop || !accessToken) {
      return NextResponse.json(
        { error: "Shopify configuration not found in environment variables" },
        { status: 500 }
      );
    }

    // Call the main sync endpoint with server-side credentials for full sync (no sinceId)
    const syncResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/shopify/sync-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop,
        accessToken,
        limit,
        maxPages
        // No sinceId = full sync from newest orders
      }),
    });

    if (!syncResponse.ok) {
      const errorData = await syncResponse.json();
      return NextResponse.json(
        { error: `Full sync failed: ${errorData.error || syncResponse.statusText}` },
        { status: syncResponse.status }
      );
    }

    const result = await syncResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in full sync:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}