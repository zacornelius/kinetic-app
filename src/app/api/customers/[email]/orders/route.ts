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

    // Process line items to show effective SKU and quantity
    const processedOrders = orders.map(order => {
      let processedLineItems = [];
      
      if (order.lineItems) {
        try {
          const lineItems = JSON.parse(order.lineItems);
          processedLineItems = lineItems.map((item, index) => {
            // Calculate effective SKU
            const getEffectiveSKU = () => {
              if (item.title?.includes('Active 26K Pallet')) {
                return 'Active 26K';
              } else if (item.title?.includes('Power 30K Pallet')) {
                return 'Power 30K';
              } else if (item.title?.includes('Vital 24K Pallet')) {
                return 'Vital 24K';
              } else if (item.title === 'Build a Pallet') {
                // For "Build a Pallet", we need to determine the actual SKU from the variant or product info
                // This would need to be enhanced based on your specific data structure
                return 'Custom Pallet';
              } else if (item.title?.includes('Pallet')) {
                // Generic pallet handling - extract base product name
                return item.title.replace(' Pallet', '');
              }
              // For non-pallet products, show the product name or SKU
              return item.name || item.sku || (item.variantId ? `V-${item.variantId}` : "N/A");
            };

            // Calculate effective quantity
            const getEffectiveQuantity = () => {
              // Handle "Build a Pallet" - quantity is units of that SKU on the pallet
              if (item.title === 'Build a Pallet') {
                return item.quantity;
              }
              // Handle pre-built pallet products - multiply quantity by 50
              else if (item.title?.includes('Pallet')) {
                return item.quantity * 50;
              }
              // For non-pallet products, show regular quantity
              return item.quantity;
            };

            return {
              effectiveSKU: getEffectiveSKU(),
              effectiveQuantity: getEffectiveQuantity(),
              originalTitle: item.title,
              originalQuantity: item.quantity,
              price: parseFloat(item.price || 0),
              totalPrice: (parseFloat(item.price || 0) * parseInt(item.quantity || 0)) - parseFloat(item.total_discount || 0)
            };
          });
        } catch (e) {
          console.error('Error parsing line items for order:', order.orderNumber, e);
          processedLineItems = [];
        }
      }

      return {
        ...order,
        processedLineItems
      };
    });

    return NextResponse.json(processedOrders);
  } catch (error) {
    console.error("Error fetching customer orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer orders" },
      { status: 500 }
    );
  }
}
