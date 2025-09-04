import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/database";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const { email: emailParam } = await params;
    const email = decodeURIComponent(emailParam);
    
    const orders = db.prepare(`
      SELECT 
        id,
        createdAt,
        orderNumber,
        totalAmount,
        currency,
        status,
        shippingAddress,
        trackingNumber,
        notes,
        ownerEmail,
        lineItems
      FROM all_orders
      WHERE customerEmail = ?
      ORDER BY createdAt DESC
    `).all(email);

    return NextResponse.json(orders);
  } catch (error) {
    console.error("Error fetching customer orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer orders" },
      { status: 500 }
    );
  }
}
