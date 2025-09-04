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
    
    // Extract invoice data from Zapier/QuickBooks payload
    // Map QuickBooks field names to our expected format
    // Generate ID from customer name and date if not provided
    const id = body['319049596__Id'] || body.id || `qb_${Date.now()}`;
    const docNumber = body['319049596__DocNumber'] || body.docNumber || `INV-${Date.now()}`;
    const customerName = body['319049596__Customer__DisplayName'] || body.customerName;
    const customerEmail = body['319049596__BillEmail__Address'] || body.customerEmail;
    const totalAmount = body['319049596__TotalAmt'] || body.totalAmount;
    const currency = body.currency || 'USD';
    const dueDate = body['319049596__DueDate'] || body.dueDate;
    const billingAddress = body['319049596__BillAddr__Line1'] || body.billingAddress;
    const shippingAddress = body['319049596__ShipAddr__Line1'] || body.shippingAddress;
    const notes = body['319049596__PrivateNote'] || body.notes;
    const createdAt = body['319049596__TxnDate'] || body.createdAt;
    
    // Extract line items from QuickBooks format
    const lineItems = [];
    if (body['319049596__Lines'] && Array.isArray(body['319049596__Lines'])) {
      body['319049596__Lines'].forEach((line, index) => {
        if (line.Description) {
          lineItems.push({
            id: `qb_line_${id}_${index}`,
            name: line.Description,
            quantity: line.SalesItemLineDetail__Qty || 1,
            price: line.SalesItemLineDetail__UnitPrice || 0,
            total: (line.SalesItemLineDetail__Qty || 1) * (line.SalesItemLineDetail__UnitPrice || 0),
            description: line.Description
          });
        }
      });
    }

    if (!id || !docNumber) {
      return NextResponse.json({ 
        error: "Missing required fields: id and docNumber",
        received: Object.keys(body)
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
