import { NextResponse } from "next/server";
import db from "@/lib/database";

// Simple webhook endpoint for Zapier to POST QuickBooks invoices
export async function POST(request: Request) {
  try {
    // Check for Basic Auth authentication
    const authHeader = request.headers.get('authorization');
    const expectedUsername = process.env.WEBHOOK_USERNAME || 'kinetic';
    const expectedPassword = process.env.WEBHOOK_PASSWORD || 'webhook2024';
    const expectedAuth = `Basic ${btoa(`${expectedUsername}:${expectedPassword}`)}`;
    
    if (!authHeader || authHeader !== expectedAuth) {
      return NextResponse.json({ 
        error: "Unauthorized - Invalid credentials" 
      }, { status: 401 });
    }
    
    const body = await request.json();
    
    // Log the incoming webhook for debugging
    console.log('QuickBooks webhook received:', JSON.stringify(body, null, 2));
    
    // Extract invoice data from Zapier payload
    const {
      id,
      docNumber,
      customerName,
      customerEmail,
      totalAmount,
      currency = 'USD',
      dueDate,
      billingAddress,
      shippingAddress,
      lineItems = [],
      notes,
      createdAt
    } = body;

    if (!id || !docNumber) {
      return NextResponse.json({ 
        error: "Missing required fields: id and docNumber" 
      }, { status: 400 });
    }

    // Insert into quickbooks_orders table with line items as JSON
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO quickbooks_orders (
        id, createdAt, orderNumber, quickbooksInvoiceId, customerEmail, customerName, 
        totalAmount, currency, status, shippingAddress, billingAddress, dueDate, notes, ownerEmail, lineItems
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const orderId = `qb_invoice_${id}`;
    const status = 'pending'; // Default status
    const createdDate = createdAt || new Date().toISOString();

    // Store line items as JSON
    const lineItemsJson = lineItems && lineItems.length > 0 ? JSON.stringify(lineItems) : null;

    insertStmt.run(
      orderId,
      createdDate,
      docNumber,
      id,
      customerEmail || '',
      customerName || '',
      totalAmount || 0,
      currency,
      status,
      shippingAddress || null,
      billingAddress || null,
      dueDate || null,
      notes || '',
      null,
      lineItemsJson
    );

    // Insert customer if provided
    if (customerEmail && customerName) {
      const customerStmt = db.prepare(`
        INSERT OR REPLACE INTO quickbooks_customers (
          id, quickbooksId, email, firstName, lastName, phone, companyName, 
          billingAddress, shippingAddress, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const customerId = `qb_customer_${id}`;
      const nameParts = customerName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      customerStmt.run(
        customerId,
        id, // Using invoice ID as customer ID for now
        customerEmail,
        firstName,
        lastName,
        '', // Phone not provided
        '', // Company name not provided
        billingAddress || null,
        shippingAddress || null,
        createdDate,
        createdDate
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: `Invoice ${docNumber} processed successfully`,
      orderId: orderId
    });

  } catch (error) {
    console.error('QuickBooks webhook error:', error);
    return NextResponse.json({ 
      error: "Failed to process webhook",
      details: error.message 
    }, { status: 500 });
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ 
    status: "ok", 
    message: "QuickBooks webhook endpoint is ready",
    url: "/api/webhooks/quickbooks",
    authentication: "Basic Auth required",
    username: process.env.WEBHOOK_USERNAME || 'kinetic',
    password: process.env.WEBHOOK_PASSWORD || 'webhook2024'
  });
}
