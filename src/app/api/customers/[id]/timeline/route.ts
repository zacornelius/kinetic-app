import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/database";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customerId } = await params;

  // Get customer data from customers table - try by ID first, then by email
  let customer = await db.prepare(`SELECT email, assignedto FROM customers WHERE id = ?`).get(customerId);
  
  // If not found by ID, try by email (in case we're passed an email instead of ID)
  if (!customer) {
    customer = await db.prepare(`SELECT email, assignedto FROM customers WHERE email = ?`).get(customerId);
  }

  if (!customer) {
    return NextResponse.json({ interactions: [] });
  }

  const customerEmail = customer.email;

  // Get inquiries
  const inquiries = await db.prepare(`
    SELECT 
      'inquiry' as type,
      id,
      message as content,
      createdat as "createdAt",
      category,
      status
    FROM inquiries
    WHERE customeremail = ? AND status != 'not_relevant'
    ORDER BY createdat DESC
  `).all(customerEmail);

  // No need for customer inquiry data since we're using the actual inquiries table

    // Get orders from shopify_orders table
    const orders = await db.prepare(`
      SELECT 
        'order' as type,
        id,
        'Order #' || ordernumber as subject,
        'Order #' || ordernumber as content,
        createdat as "createdAt",
        ordernumber,
        totalamount,
        status
      FROM shopify_orders 
      WHERE customeremail = ?
      ORDER BY createdat DESC
    `).all(customerEmail);

    // Get notes
    const notes = await db.prepare(`
      SELECT 
        'note' as type,
        id,
        'Note' as subject,
        note as content,
        authoremail,
        createdat as "createdAt",
        type as noteType,
        isprivate
      FROM customer_notes 
      WHERE customerid = ?
      ORDER BY createdat DESC
    `).all(customerId);

  // Format all interactions
  const allInteractions = [
    ...inquiries.map(i => ({
      id: i.id,
      type: i.type,
      subject: 'Inquiry',
      content: i.content, // Use inquiry message directly
      authorEmail: customer.assignedto || 'system',
      createdAt: i.createdAt, // Use inquiry date
      metadata: { category: i.category, status: i.status }
    })),
    ...orders.map(o => ({
      id: o.id,
      type: o.type,
      subject: o.subject,
      content: o.content,
      authorEmail: customer.assignedto || 'system',
      createdAt: o.createdAt,
      metadata: { orderNumber: o.orderNumber, totalAmount: o.totalAmount, status: o.status }
    })),
    ...notes.map(n => ({
      id: n.id,
      type: n.type,
      subject: n.subject,
      content: n.content,
      authorEmail: n.authorEmail,
      createdAt: n.createdAt,
      metadata: { type: n.noteType, isPrivate: n.isPrivate }
    }))
  ];

    // Sort by creation date (latest first)
    allInteractions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ interactions: allInteractions });
  } catch (error) {
    console.error('Error fetching customer timeline:', error);
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
