import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/database";
import { getCustomerOwner, updateCustomerStatus } from "@/lib/customer-assignment";

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
  source: "shopify" | "quickbooks" | "manual" | "distributor" | "digital";
  sourceId: string;
  businessUnit?: string;
  poNumber?: string; // Extracted from notes for quote-converted orders
  invoiceEmail?: string; // Extracted from notes for quote-converted orders
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
      SELECT 
        o.id,
        o.createdat as "createdAt",
        o.ordernumber as "orderNumber",
        o.shopifyorderid as "shopifyOrderId",
        o.customeremail as "customerEmail",
        o.customername as "customerName",
        o.totalamount as "totalAmount",
        o.currency,
        o.status,
        o.shippingaddress as "shippingAddress",
        o.trackingnumber as "trackingNumber",
        o.notes,
        o.owneremail as "ownerEmail",
        o.lineitems as "lineItems",
        c.assignedto as "assignedOwner",
        o.source,
        o.sourceid as "sourceId",
        o.business_unit as "businessUnit",
        CASE 
          WHEN o.notes LIKE '%PO Number:%' THEN 
            TRIM(SUBSTRING(o.notes FROM 'PO Number: ([^\n]+)'))
          ELSE NULL 
        END as "poNumber",
        CASE 
          WHEN o.notes LIKE '%Invoice Email:%' THEN 
            TRIM(SUBSTRING(o.notes FROM 'Invoice Email: ([^\n]+)'))
          ELSE NULL 
        END as "invoiceEmail"
      FROM (
        SELECT id, createdat::timestamp as createdat, ordernumber, shopifyorderid, customeremail, customername, totalamount, currency, status, shippingaddress, trackingnumber, notes, owneremail, lineitems, 'shopify' as source, id as sourceid, business_unit FROM shopify_orders
        UNION ALL
        SELECT id, createdat::timestamp as createdat, ordernumber, null as shopifyorderid, customeremail, customername, totalamount, currency, status, shippingaddress, trackingnumber, notes, owneremail, lineitems, source, sourceid, business_unit FROM distributor_orders
        UNION ALL
        SELECT id, createdat as createdat, ordernumber, null as shopifyorderid, customeremail, customername, totalamount, currency, status, shippingaddress, trackingnumber, notes, owneremail, lineitems, source, sourceid, business_unit FROM digital_orders
      ) o
      LEFT JOIN customers c ON LOWER(o.customeremail) = LOWER(c.email)
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
      query += ' AND o.customeremail LIKE ?';
      params.push(`%${customerEmail}%`);
    }
    
    query += ' ORDER BY o.createdat DESC';
    
    const data = await db.prepare(query).all(...params) as Order[];
    
    // Parse lineItems JSON strings
    const processedData = data.map(order => ({
      ...order,
      lineItems: order.lineItems ? JSON.parse(order.lineItems as string) : null
    }));
    
    return NextResponse.json(processedData);
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
    const existingOrder = await db.prepare('SELECT id FROM shopify_orders WHERE ordernumber = ?').get(orderNumber);
    if (existingOrder) {
      return NextResponse.json({ error: "Order number already exists" }, { status: 409 });
    }
    
    const id = generateId();
    const createdAt = new Date().toISOString();
    const finalSourceId = sourceId || id;
    
    const insertOrder = db.prepare(`
      INSERT INTO shopify_orders (id, createdat, ordernumber, customeremail, customername, totalamount, currency, status, shippingaddress, trackingnumber, notes, owneremail)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    await insertOrder.run(
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
    
    // Update customer record with order information
    const customer = await db.prepare('SELECT id FROM customers WHERE email = $1').get(customerEmail) as { id: string } | undefined;
    if (customer) {
      // Update customer's order count and total spent
      await db.prepare(`
        UPDATE customers 
        SET totalorders = totalorders + 1, 
            totalspent = totalspent + COALESCE($1, 0),
            updatedat = $2
        WHERE id = $3
      `).run(totalAmount || 0, createdAt, customer.id);
      
      // Update customer status and type
      await updateCustomerStatus(customer.id);
    }
    
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
    const existingOrder = await db.prepare('SELECT * FROM shopify_orders WHERE id = ?').get(id) as Order;
    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    
    // Build update query dynamically
    const fieldMapping: { [key: string]: string } = {
      'orderNumber': 'ordernumber',
      'customerEmail': 'customeremail',
      'customerName': 'customername',
      'totalAmount': 'totalamount',
      'currency': 'currency',
      'status': 'status',
      'shippingAddress': 'shippingaddress',
      'billingAddress': 'billingaddress',
      'trackingNumber': 'trackingnumber',
      'dueDate': 'duedate',
      'notes': 'notes',
      'ownerEmail': 'owneremail'
    };
    
    const updateFields: string[] = [];
    const params: any[] = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (fieldMapping[key]) {
        updateFields.push(`${fieldMapping[key]} = ?`);
        params.push(value);
      }
    }
    
    if (updateFields.length === 0) {
      return NextResponse.json({ error: "No valid updates provided" }, { status: 400 });
    }
    
    params.push(id);
    
    const updateQuery = `UPDATE shopify_orders SET ${updateFields.join(', ')} WHERE id = ?`;
    await db.prepare(updateQuery).run(...params);
    
    // Return updated order
    const updatedOrder = await db.prepare('SELECT * FROM shopify_orders WHERE id = ?').get(id) as Order;
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
    const result = await deleteOrder.run(id);
    
    if (result.changes === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting order:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

