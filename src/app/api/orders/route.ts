import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/database";
import { getCustomerOwner } from "@/lib/customer-assignment";

type Order = {
  id: string;
  createdAt: string;
  orderNumber: string;
  customerEmail: string;
  customerName?: string;
  totalAmount?: number;
  currency: string;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "paid" | "overdue";
  shippingAddress?: string;
  billingAddress?: string;
  trackingNumber?: string;
  dueDate?: string;
  notes?: string;
  assignedOwner?: string; // Derived from customer record
  source: "shopify" | "quickbooks" | "manual";
  sourceId: string;
};

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

// Seed initial orders if database is empty

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const source = searchParams.get("source");
    const customerEmail = searchParams.get("customerEmail");
    
    let query = `
      SELECT o.*, c.assignedTo as assignedOwner, 'shopify' as source, o.id as sourceId
      FROM shopify_orders o
      LEFT JOIN customers c ON LOWER(o.customerEmail) = LOWER(c.email)
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }
    
    if (source) {
      query += ' AND o.source = ?';
      params.push(source);
    }
    
    if (customerEmail) {
      query += ' AND o.customerEmail LIKE ?';
      params.push(`%${customerEmail}%`);
    }
    
    query += ' ORDER BY createdAt DESC';
    
    const data = db.prepare(query).all(...params) as Order[];
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      orderNumber, 
      customerEmail, 
      customerName, 
      totalAmount, 
      currency = "USD", 
      status = "pending", 
      shippingAddress, 
      billingAddress,
      trackingNumber, 
      dueDate,
      notes, 
      ownerEmail,
      source = "manual",
      sourceId
    } = body;
    
    if (!orderNumber || !customerEmail) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    // Check if order number already exists
    const existingOrder = db.prepare('SELECT id FROM shopify_orders WHERE orderNumber = ?').get(orderNumber);
    if (existingOrder) {
      return NextResponse.json({ error: "Order number already exists" }, { status: 409 });
    }
    
    const id = generateId();
    const createdAt = new Date().toISOString();
    const finalSourceId = sourceId || id;
    
    const insertOrder = db.prepare(`
      INSERT INTO shopify_orders (id, createdAt, orderNumber, customerEmail, customerName, totalAmount, currency, status, shippingAddress, trackingNumber, notes, ownerEmail)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertOrder.run(
      id, 
      createdAt, 
      orderNumber, 
      customerEmail, 
      customerName || null, 
      totalAmount || null, 
      currency, 
      status, 
      shippingAddress || null, 
      trackingNumber || null, 
      notes || null, 
      ownerEmail || null
    );
    
    const newOrder: Order = {
      id,
      createdAt,
      orderNumber,
      customerEmail,
      customerName,
      totalAmount,
      currency,
      status,
      shippingAddress,
      billingAddress,
      trackingNumber,
      dueDate,
      notes,
      ownerEmail,
      source,
      sourceId: finalSourceId,
    };
    
    return NextResponse.json(newOrder, { status: 201 });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    
    if (!id) {
      return NextResponse.json({ error: "Missing order ID" }, { status: 400 });
    }
    
    // Check if order exists
    const existingOrder = db.prepare('SELECT * FROM shopify_orders WHERE id = ?').get(id) as Order;
    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    
    // Build update query dynamically
    const allowedFields = [
      'orderNumber', 'customerEmail', 'customerName', 'totalAmount', 'currency', 
      'status', 'shippingAddress', 'billingAddress', 'trackingNumber', 'dueDate', 'notes', 'ownerEmail'
    ];
    
    const updateFields: string[] = [];
    const params: any[] = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = ?`);
        params.push(value);
      }
    }
    
    if (updateFields.length === 0) {
      return NextResponse.json({ error: "No valid updates provided" }, { status: 400 });
    }
    
    params.push(id);
    
    const updateQuery = `UPDATE shopify_orders SET ${updateFields.join(', ')} WHERE id = ?`;
    db.prepare(updateQuery).run(...params);
    
    // Return updated order
    const updatedOrder = db.prepare('SELECT * FROM shopify_orders WHERE id = ?').get(id) as Order;
    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json({ error: "Missing order ID" }, { status: 400 });
    }
    
    const deleteOrder = db.prepare('DELETE FROM shopify_orders WHERE id = ?');
    const result = deleteOrder.run(id);
    
    if (result.changes === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting order:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

