import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/database";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customerId } = await params;

    // Get customer email from unified table
    const customerEmail = db.prepare(`SELECT email FROM customers_new WHERE id = ?`).get(customerId)?.email;

    if (!customerEmail) {
      return NextResponse.json({ interactions: [] });
    }

    // Get inquiries
    const inquiries = db.prepare(`
      SELECT 
        'inquiry' as type,
        id,
        subject,
        subject as content,
        ownerEmail as authorEmail,
        createdAt,
        category,
        status
      FROM inquiries 
      WHERE customerEmail = ?
      ORDER BY createdAt DESC
    `).all(customerEmail);

    // Get orders
    const orders = db.prepare(`
      SELECT 
        'order' as type,
        id,
        'Order #' || orderNumber as subject,
        'Order #' || orderNumber as content,
        ownerEmail as authorEmail,
        createdAt,
        orderNumber,
        totalAmount,
        status
      FROM all_orders 
      WHERE customerEmail = ?
      ORDER BY createdAt DESC
    `).all(customerEmail);

    // Get notes
    const notes = db.prepare(`
      SELECT 
        'note' as type,
        id,
        'Note' as subject,
        note as content,
        authorEmail,
        createdAt,
        type as noteType,
        isPrivate
      FROM customer_notes 
      WHERE customerId = ?
      ORDER BY createdAt DESC
    `).all(customerId);

    // Format all interactions
    const allInteractions = [
      ...inquiries.map(i => ({
        id: i.id,
        type: i.type,
        subject: i.subject,
        content: i.content,
        authorEmail: i.authorEmail,
        createdAt: i.createdAt,
        metadata: { category: i.category, status: i.status }
      })),
      ...orders.map(o => ({
        id: o.id,
        type: o.type,
        subject: o.subject,
        content: o.content,
        authorEmail: o.authorEmail,
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

    // Sort by creation date
    allInteractions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ interactions: allInteractions });
  } catch (error) {
    console.error('Error fetching customer interactions:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
