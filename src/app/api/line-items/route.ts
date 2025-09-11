import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/database";

export async function GET() {
  try {
    // Get all orders with line items from all order tables
    const orders = await db.prepare(`
      SELECT 
        id,
        ordernumber as "orderNumber",
        customeremail as "customerEmail",
        customername as "customerName",
        lineitems as "lineItems",
        business_unit as "businessUnit",
        createdat as "createdAt"
      FROM (
        SELECT id, ordernumber, customeremail, customername, lineitems, business_unit, createdat::timestamp as createdat FROM shopify_orders
        UNION ALL
        SELECT id, ordernumber, customeremail, customername, lineitems, business_unit, createdat::timestamp as createdat FROM distributor_orders
        UNION ALL
        SELECT id, ordernumber, customeremail, customername, lineitems, business_unit, createdat as createdat FROM digital_orders
      ) o
      WHERE lineitems IS NOT NULL AND lineitems != '' AND lineitems != 'null' AND lineitems != 'undefined'
      ORDER BY createdat DESC
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