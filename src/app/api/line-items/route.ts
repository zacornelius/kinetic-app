import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/database";

export async function GET() {
  try {
    const lineItems = db.prepare(`
      SELECT 
        oli.id,
        oli.orderId,
        oli.productId,
        oli.shopifyVariantId,
        oli.sku,
        oli.title,
        oli.quantity,
        oli.price,
        oli.totalPrice,
        oli.vendor,
        o.orderNumber,
        o.customerEmail,
        o.customerName
      FROM orderLineItems oli
      LEFT JOIN orders o ON oli.orderId = o.id
      ORDER BY o.createdAt DESC, oli.title
    `).all();

    return NextResponse.json(lineItems);
  } catch (error) {
    console.error("Error fetching line items:", error);
    return NextResponse.json(
      { error: "Failed to fetch line items" },
      { status: 500 }
    );
  }
}
