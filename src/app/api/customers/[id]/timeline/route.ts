import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/database";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customerId } = await params;

  // Get customer data from unified table
  const customer = db.prepare(`SELECT email, firstInteractionDate, reason, customerType, numberOfDogs, inquiryStatus, assignedOwner FROM customers_new WHERE id = ?`).get(customerId);

  if (!customer) {
    return NextResponse.json({ interactions: [] });
  }

  const customerEmail = customer.email;

  // Get inquiries
  const inquiries = db.prepare(`
    SELECT 
      'inquiry' as type,
      id,
      message as content,
      createdAt,
      category,
      status
    FROM inquiries
    WHERE customerEmail = ? AND status != 'not_relevant'
    ORDER BY createdAt DESC
  `).all(customerEmail);

  // Add customer inquiry data if available (from CSV) - only if no inquiries exist in database
  const hasInquiries = inquiries.length > 0;
  const customerInquiry = !hasInquiries && customer.firstInteractionDate ? {
    type: 'customer_inquiry',
    id: `customer_inquiry_${customerId}`,
    content: 'Initial Inquiry',
    authorEmail: customer.assignedOwner || 'system',
    createdAt: customer.firstInteractionDate,
    metadata: {
      reason: customer.reason,
      customerType: customer.customerType,
      numberOfDogs: customer.numberOfDogs,
      status: customer.inquiryStatus,
      owner: customer.assignedOwner
    }
  } : null;

    // Get orders
    const orders = db.prepare(`
      SELECT 
        'order' as type,
        id,
        'Order #' || orderNumber as subject,
        'Order #' || orderNumber as content,
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
    ...(customerInquiry ? [customerInquiry] : []),
    ...inquiries.map(i => ({
      id: i.id,
      type: i.type,
      subject: 'Inquiry',
      content: i.content, // Use inquiry message directly
      authorEmail: customer.assignedOwner || 'system',
      createdAt: i.createdAt, // Use inquiry date
      metadata: { category: i.category, status: i.status }
    })),
    ...orders.map(o => ({
      id: o.id,
      type: o.type,
      subject: o.subject,
      content: o.content,
      authorEmail: customer.assignedOwner || 'system',
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
