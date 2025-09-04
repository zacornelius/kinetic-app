import { NextResponse } from "next/server";
import db from "@/lib/database";

export async function GET() {
  try {
    const orders = db.prepare(`
      SELECT 
        id,
        createdAt,
        orderNumber,
        quickbooksInvoiceId,
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
      ORDER BY createdAt DESC
    `).all();

    return NextResponse.json(orders);
  } catch (error) {
    console.error("Error fetching QuickBooks orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch QuickBooks orders" },
      { status: 500 }
    );
  }
}
