import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/database";

export async function GET() {
  try {
    // Get all orders with line items from all_orders table
    const orders = await db.prepare(`
      SELECT 
        o.id,
        o.ordernumber as "orderNumber",
        o.customeremail as "customerEmail",
        o.customername as "customerName",
        o.lineitems as "lineItems",
        COALESCE(o.business_unit, c.business_unit) as "businessUnit",
        o.createdat as "createdAt"
      FROM all_orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.lineitems IS NOT NULL AND o.lineitems != '' AND o.lineitems != 'null' AND o.lineitems != 'undefined'
      ORDER BY o.createdat DESC
    `).all();
    
    // Parse line items from JSON and flatten them
    const allLineItems = [];
    orders.forEach(order => {
      try {
        // Skip if lineItems is null, undefined, or empty string
        if (!order.lineItems || order.lineItems === 'null' || order.lineItems === 'undefined') {
          return;
        }
        
        const lineItems = JSON.parse(order.lineItems);
        
        // Ensure lineItems is an array
        if (!Array.isArray(lineItems)) {
          return;
        }
        
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
            businessUnit: order.businessUnit,
            createdAt: order.createdAt,
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