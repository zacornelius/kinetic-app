import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/database";

export async function GET() {
  try {
    // Get all orders with line items
    const orders = db.prepare(`
      SELECT 
        id,
        orderNumber,
        customerEmail,
        customerName,
        lineItems
      FROM all_orders
      WHERE lineItems IS NOT NULL AND lineItems != ''
      ORDER BY createdAt DESC
    `).all();
    
    // Parse line items from JSON and flatten them
    const allLineItems = [];
    orders.forEach(order => {
      try {
        const lineItems = JSON.parse(order.lineItems);
        lineItems.forEach((item, index) => {
          // Calculate total price: (price * quantity) - total_discount
          const price = parseFloat(item.price || 0);
          const quantity = parseInt(item.quantity || 0);
          const totalDiscount = parseFloat(item.total_discount || 0);
          const totalPrice = (price * quantity) - totalDiscount;
          
          allLineItems.push({
            id: `${order.id}-${index}`,
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerEmail: order.customerEmail,
            customerName: order.customerName,
            ...item,
            totalPrice: totalPrice
          });
        });
      } catch (e) {
        console.error('Error parsing line items for order:', order.orderNumber, e);
      }
    });
    
    return NextResponse.json(allLineItems);
  } catch (error) {
    console.error("Error fetching line items:", error);
    return NextResponse.json(
      { error: "Failed to fetch line items" },
      { status: 500 }
    );
  }
}