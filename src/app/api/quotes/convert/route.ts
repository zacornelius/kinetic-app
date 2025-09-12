import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/database";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { quoteId, poNumber, invoiceEmail } = body;

    if (!quoteId || !poNumber || !invoiceEmail) {
      return NextResponse.json({ 
        error: "quoteId, poNumber, and invoiceEmail are required" 
      }, { status: 400 });
    }

    // Get quote details
    const quoteQuery = `
      SELECT 
        q.*,
        c.email as customer_email,
        c.firstname as customer_firstname,
        c.lastname as customer_lastname
      FROM quotes q
      JOIN customers c ON q.customer_id = c.id
      WHERE q.quote_id = ?
    `;
    
    const quote = await db.prepare(quoteQuery).get(quoteId);
    
    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    if (quote.status !== 'quoted') {
      return NextResponse.json({ 
        error: "Quote is not in 'quoted' status" 
      }, { status: 400 });
    }

    // Update quote with PO and invoice email
    const updateQuoteQuery = `
      UPDATE quotes 
      SET po_number = ?, invoice_email = ?, status = 'pending', updated_at = CURRENT_TIMESTAMP
      WHERE quote_id = ?
    `;
    
    await db.prepare(updateQuoteQuery).run(poNumber, invoiceEmail, quoteId);

    // Convert Shopify draft order to real order
    const shop = process.env.SHOPIFY_SHOP;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!shop || !accessToken) {
      return NextResponse.json({ 
        error: "Shopify configuration missing" 
      }, { status: 500 });
    }

    // Get the draft order details first
    const draftOrderResponse = await fetch(
      `https://${shop}.myshopify.com/admin/api/2024-10/draft_orders/${quote.shopify_draft_order_id}.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken
        }
      }
    );

    if (!draftOrderResponse.ok) {
      const errorText = await draftOrderResponse.text();
      console.error('Failed to get draft order:', errorText);
      return NextResponse.json({ 
        error: "Failed to get draft order details",
        details: errorText
      }, { status: 500 });
    }

    const draftOrderData = await draftOrderResponse.json();
    const draftOrder = draftOrderData.draft_order;

    // Create a new order directly with pending financial status
    const newOrderData = {
      order: {
        line_items: draftOrder.line_items,
        customer: draftOrder.customer,
        billing_address: draftOrder.billing_address,
        shipping_address: draftOrder.shipping_address || draftOrder.billing_address,
        note: `PO Number: ${poNumber}\nOriginal Quote: ${quoteId}\nManual Payment Required`,
        tags: 'pending,quote-converted',
        financial_status: 'pending',
        payment_gateway_names: ['manual']
      }
    };

    const createOrderResponse = await fetch(
      `https://${shop}.myshopify.com/admin/api/2024-10/orders.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken
        },
        body: JSON.stringify(newOrderData)
      }
    );

    if (!createOrderResponse.ok) {
      const errorText = await createOrderResponse.text();
      console.error('Failed to create order:', errorText);
      return NextResponse.json({ 
        error: "Failed to create order",
        details: errorText
      }, { status: 500 });
    }

    const createdOrder = await createOrderResponse.json();
    const realOrderId = createdOrder.order.id;

    // Delete the original draft order since we created a new order
    const deleteDraftResponse = await fetch(
      `https://${shop}.myshopify.com/admin/api/2024-10/draft_orders/${quote.shopify_draft_order_id}.json`,
      {
        method: 'DELETE',
        headers: {
          'X-Shopify-Access-Token': accessToken
        }
      }
    );

    if (!deleteDraftResponse.ok) {
      console.warn('Failed to delete original draft order, but continuing with conversion');
    }

    // Update quote status to pending
    const finalUpdateQuery = `
      UPDATE quotes 
      SET status = 'pending', updated_at = CURRENT_TIMESTAMP
      WHERE quote_id = ?
    `;
    
    await db.prepare(finalUpdateQuery).run(quoteId);

    // Send invoice to procurement email
    const invoiceData = {
      order: {
        id: realOrderId,
        email: invoiceEmail,
        note: `PO Number: ${poNumber}\nOriginal Quote: ${quoteId}`
      }
    };

    const invoiceResponse = await fetch(
      `https://${shop}.myshopify.com/admin/api/2024-10/orders/${realOrderId}/transactions.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken
        },
        body: JSON.stringify({
          transaction: {
            kind: 'sale',
            status: 'pending',
            amount: quote.total_amount,
            gateway: 'manual',
            source: 'admin'
          }
        })
      }
    );

    if (!invoiceResponse.ok) {
      console.error('Failed to create pending transaction');
    }

    return NextResponse.json({
      success: true,
      message: 'Quote converted to order successfully',
      realOrderId,
      quoteId,
      status: 'pending'
    });

  } catch (error) {
    console.error('Quote conversion error:', error);
    return NextResponse.json({ 
      error: 'Failed to convert quote to order',
      details: error
    }, { status: 500 });
  }
}
