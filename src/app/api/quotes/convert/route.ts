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

    // Convert draft order to real order using Shopify's "pay later" approach
    // This is much simpler and more reliable than creating a new order via API
    const convertDraftOrderResponse = await fetch(
      `https://${shop}.myshopify.com/admin/api/2024-10/draft_orders/${quote.shopify_draft_order_id}/complete.json`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken
        },
        body: JSON.stringify({
          draft_order: {
            payment_pending: true,
            note: `PO Number: ${poNumber}\nInvoice Email: ${invoiceEmail}\nOriginal Quote: ${quoteId}\nQuote ID: ${quote.id}\nManual Payment Required`
          }
        })
      }
    );

    if (!convertDraftOrderResponse.ok) {
      const errorText = await convertDraftOrderResponse.text();
      console.error('Failed to convert draft order to order:', errorText);
      return NextResponse.json({ 
        error: "Failed to convert draft order to order",
        details: errorText
      }, { status: 500 });
    }

    const convertedOrderData = await convertDraftOrderResponse.json();
    const realOrderId = convertedOrderData.draft_order.order_id;

    // Update quote status to pending
    const finalUpdateQuery = `
      UPDATE quotes 
      SET status = 'pending', updated_at = CURRENT_TIMESTAMP
      WHERE quote_id = ?
    `;
    
    await db.prepare(finalUpdateQuery).run(quoteId);

    // Create a pending transaction for the order
    const transactionResponse = await fetch(
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

    if (!transactionResponse.ok) {
      console.error('Failed to create pending transaction, but order was created successfully');
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
