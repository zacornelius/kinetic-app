import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/database";

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
  ownerEmail?: string;
  source: "shopify" | "quickbooks" | "manual";
  sourceId: string;
};

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

// Seed initial orders if database is empty
function seedInitialOrders() {
  const orderCount = db.prepare('SELECT COUNT(*) as count FROM all_orders').get() as { count: number };
  
  if (orderCount.count === 0) {
    const insertOrder = db.prepare(`
      INSERT INTO all_orders (id, createdAt, orderNumber, customerEmail, customerName, totalAmount, currency, status, shippingAddress, billingAddress, trackingNumber, dueDate, notes, ownerEmail, source, sourceId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertOrder.run(
      "1", 
      new Date().toISOString(), 
      "ORD-001", 
      "customer1@example.com", 
      "John Doe", 
      299.99, 
      "USD", 
      "pending", 
      "123 Main St, City, State 12345", 
      "123 Main St, City, State 12345",
      null, 
      null,
      "First order", 
      null,
      "manual",
      "1"
    );
    insertOrder.run(
      "2", 
      new Date().toISOString(), 
      "ORD-002", 
      "customer2@example.com", 
      "Jane Smith", 
      149.50, 
      "USD", 
      "shipped", 
      "456 Oak Ave, City, State 67890", 
      "456 Oak Ave, City, State 67890",
      "TRK123456789", 
      null,
      "Express shipping", 
      null,
      "manual",
      "2"
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    seedInitialOrders();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const source = searchParams.get("source");
    const customerEmail = searchParams.get("customerEmail");
    
    let query = 'SELECT * FROM all_orders WHERE 1=1';
    const params: any[] = [];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    if (source) {
      query += ' AND source = ?';
      params.push(source);
    }
    
    if (customerEmail) {
      query += ' AND customerEmail LIKE ?';
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
    const existingOrder = db.prepare('SELECT id FROM all_orders WHERE orderNumber = ?').get(orderNumber);
    if (existingOrder) {
      return NextResponse.json({ error: "Order number already exists" }, { status: 409 });
    }
    
    const id = generateId();
    const createdAt = new Date().toISOString();
    const finalSourceId = sourceId || id;
    
    const insertOrder = db.prepare(`
      INSERT INTO all_orders (id, createdAt, orderNumber, customerEmail, customerName, totalAmount, currency, status, shippingAddress, billingAddress, trackingNumber, dueDate, notes, ownerEmail, source, sourceId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      billingAddress || null,
      trackingNumber || null, 
      dueDate || null,
      notes || null, 
      ownerEmail || null,
      source,
      finalSourceId
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
    const existingOrder = db.prepare('SELECT * FROM all_orders WHERE id = ?').get(id) as Order;
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
    
    const updateQuery = `UPDATE all_orders SET ${updateFields.join(', ')} WHERE id = ?`;
    db.prepare(updateQuery).run(...params);
    
    // Return updated order
    const updatedOrder = db.prepare('SELECT * FROM all_orders WHERE id = ?').get(id) as Order;
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
    
    const deleteOrder = db.prepare('DELETE FROM all_orders WHERE id = ?');
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

