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
        o.id,
        o.createdAt,
        o.orderNumber,
        o.totalAmount,
        o.currency,
        o.status,
        o.shippingAddress,
        o.trackingNumber,
        o.notes,
        o.ownerEmail,
        COALESCE(
          GROUP_CONCAT(
            oli.title || ' (Qty: ' || oli.quantity || ', $' || oli.totalPrice || ')',
            '; '
          ), 
          'No line items'
        ) as lineItems
      FROM orders o
      LEFT JOIN orderLineItems oli ON o.id = oli.orderId
      WHERE o.customerEmail = ?
      GROUP BY o.id, o.createdAt, o.orderNumber, o.totalAmount, o.currency, o.status, o.shippingAddress, o.trackingNumber, o.notes, o.ownerEmail
      ORDER BY o.createdAt DESC
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
