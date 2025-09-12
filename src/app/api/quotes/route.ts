import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/database";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assignedTo = searchParams.get('assignedTo');
    const status = searchParams.get('status');

    if (!assignedTo) {
      return NextResponse.json({ error: "assignedTo parameter is required" }, { status: 400 });
    }

    let query = `
      SELECT 
        q.id,
        q.quote_id as "quoteId",
        q.shopify_draft_order_id as "shopifyDraftOrderId",
        q.customer_id as "customerId",
        q.customer_email as "customerEmail",
        q.invoice_email as "invoiceEmail",
        q.po_number as "poNumber",
        q.status,
        q.total_amount as "totalAmount",
        q.pallet_items as "palletItems",
        q.custom_message as "customMessage",
        q.created_at as "createdAt",
        q.updated_at as "updatedAt",
        c.firstname as "customerFirstName",
        c.lastname as "customerLastName",
        c.phone as "customerPhone",
        c.companyname as "customerCompany"
      FROM quotes q
      JOIN customers c ON q.customer_id = c.id
      WHERE c.assignedto = ?
    `;
    
    const params: any[] = [assignedTo];
    
    if (status) {
      query += ' AND q.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY q.created_at DESC';

    const quotes = await db.prepare(query).all(...params);

    // Parse JSON fields
    const processedQuotes = quotes.map(quote => ({
      ...quote,
      palletItems: typeof quote.palletItems === 'string' ? JSON.parse(quote.palletItems) : quote.palletItems
    }));

    return NextResponse.json(processedQuotes);
  } catch (error) {
    console.error("Error fetching quotes:", error);
    return NextResponse.json(
      { error: "Failed to fetch quotes" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { quoteId, poNumber, invoiceEmail, status } = body;

    if (!quoteId) {
      return NextResponse.json({ error: "quoteId is required" }, { status: 400 });
    }

    let updateFields = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (poNumber !== undefined) {
      updateFields.push(`po_number = $${paramIndex}`);
      params.push(poNumber);
      paramIndex++;
    }

    if (invoiceEmail !== undefined) {
      updateFields.push(`invoice_email = $${paramIndex}`);
      params.push(invoiceEmail);
      paramIndex++;
    }

    if (status !== undefined) {
      updateFields.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(quoteId);

    const query = `
      UPDATE quotes 
      SET ${updateFields.join(', ')}
      WHERE quote_id = ?
    `;

    const result = await db.prepare(query).run(...params);

    if (result.changes === 0) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Quote updated successfully" });
  } catch (error) {
    console.error("Error updating quote:", error);
    return NextResponse.json(
      { error: "Failed to update quote" },
      { status: 500 }
    );
  }
}
