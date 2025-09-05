import { NextResponse } from "next/server";
import db from "@/lib/database";

// Webhook endpoint for QuickBooks CSV data from Zapier
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
    console.log('QuickBooks CSV webhook received:', JSON.stringify(body, null, 2));
    
    // Extract CSV data from Zapier payload
    const {
      csvData, // Array of CSV rows
      reportDate, // Date of the report
      totalRows
    } = body;

    if (!csvData || !Array.isArray(csvData)) {
      return NextResponse.json({ 
        error: "Missing or invalid csvData array" 
      }, { status: 400 });
    }

    console.log(`Processing ${csvData.length} CSV rows from QuickBooks report`);

    // Process each CSV row
    let processedCount = 0;
    let newOrdersCount = 0;
    let updatedOrdersCount = 0;
    let newCustomersCount = 0;
    let updatedCustomersCount = 0;

    for (const row of csvData) {
      try {
        // Map CSV columns to our format (adjust column names based on your CSV structure)
        const orderData = {
          // Order fields
          id: `qb_csv_${row.Transaction_ID || row['Transaction ID'] || Date.now()}`,
          orderNumber: row.Transaction_ID || row['Transaction ID'] || `QB-${Date.now()}`,
          customerName: row.Customer_Name || row['Customer Name'] || '',
          customerEmail: row.Customer_Email || row['Customer Email'] || '',
          totalAmount: parseFloat(row.Total || row.Amount || 0),
          currency: 'USD',
          status: 'paid', // CSV reports are typically for paid transactions
          createdAt: row.Transaction_Date || row['Transaction Date'] || new Date().toISOString(),
          dueDate: row.Due_Date || row['Due Date'] || null,
          billingAddress: row.Billing_Address || row['Billing Address'] || null,
          shippingAddress: row.Shipping_Address || row['Shipping Address'] || null,
          notes: row.Memo || row.Notes || '',
          
          // Line items (if available in CSV)
          lineItems: row.Line_Items ? JSON.parse(row.Line_Items) : null
        };

        // Check if order already exists
        const existingOrder = db.prepare(`
          SELECT id FROM quickbooks_orders 
          WHERE orderNumber = ? OR quickbooksInvoiceId = ?
        `).get(orderData.orderNumber, orderData.orderNumber);

        if (existingOrder) {
          // Update existing order
          const updateOrder = db.prepare(`
            UPDATE quickbooks_orders SET
              customerName = ?, customerEmail = ?, totalAmount = ?, 
              status = ?, createdAt = ?, dueDate = ?, billingAddress = ?, 
              shippingAddress = ?, notes = ?, lineItems = ?
            WHERE orderNumber = ?
          `);
          
          updateOrder.run(
            orderData.customerName,
            orderData.customerEmail,
            orderData.totalAmount,
            orderData.status,
            orderData.createdAt,
            orderData.dueDate,
            orderData.billingAddress,
            orderData.shippingAddress,
            orderData.notes,
            orderData.lineItems ? JSON.stringify(orderData.lineItems) : null,
            orderData.orderNumber
          );
          
          updatedOrdersCount++;
        } else {
          // Insert new order
          const insertOrder = db.prepare(`
            INSERT INTO quickbooks_orders (
              id, createdAt, orderNumber, quickbooksInvoiceId, customerEmail, 
              customerName, totalAmount, currency, status, shippingAddress, 
              billingAddress, dueDate, notes, ownerEmail, lineItems
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          
          insertOrder.run(
            orderData.id,
            orderData.createdAt,
            orderData.orderNumber,
            orderData.orderNumber, // Use orderNumber as quickbooksInvoiceId
            orderData.customerEmail,
            orderData.customerName,
            orderData.totalAmount,
            orderData.currency,
            orderData.status,
            orderData.shippingAddress,
            orderData.billingAddress,
            orderData.dueDate,
            orderData.notes,
            null, // ownerEmail
            orderData.lineItems ? JSON.stringify(orderData.lineItems) : null
          );
          
          newOrdersCount++;
        }

        // Handle customer data
        if (orderData.customerEmail && orderData.customerName) {
          const existingCustomer = db.prepare(`
            SELECT id FROM quickbooks_customers 
            WHERE email = ?
          `).get(orderData.customerEmail);

          if (existingCustomer) {
            // Update existing customer
            const updateCustomer = db.prepare(`
              UPDATE quickbooks_customers SET
                firstName = ?, lastName = ?, companyName = ?,
                billingAddress = ?, shippingAddress = ?, updatedAt = ?
              WHERE email = ?
            `);
            
            const nameParts = orderData.customerName.split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';
            
            updateCustomer.run(
              firstName,
              lastName,
              '', // companyName not available in this format
              orderData.billingAddress,
              orderData.shippingAddress,
              new Date().toISOString(),
              orderData.customerEmail
            );
            
            updatedCustomersCount++;
          } else {
            // Insert new customer
            const insertCustomer = db.prepare(`
              INSERT INTO quickbooks_customers (
                id, quickbooksId, email, firstName, lastName, phone, 
                companyName, billingAddress, shippingAddress, createdAt, updatedAt
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            const customerId = `qb_customer_${orderData.id}`;
            const nameParts = orderData.customerName.split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';
            
            insertCustomer.run(
              customerId,
              orderData.orderNumber, // Use orderNumber as quickbooksId
              orderData.customerEmail,
              firstName,
              lastName,
              '', // phone not available
              '', // companyName not available
              orderData.billingAddress,
              orderData.shippingAddress,
              orderData.createdAt,
              orderData.createdAt
            );
            
            newCustomersCount++;
          }
        }

        processedCount++;
      } catch (rowError) {
        console.error('Error processing CSV row:', rowError, 'Row data:', row);
        // Continue processing other rows
      }
    }

    // Sync to unified tables
    const unifiedResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/sync/unified`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const unifiedResult = await unifiedResponse.json();

    return NextResponse.json({
      success: true,
      message: `QuickBooks CSV processed successfully. ${processedCount} rows processed.`,
      stats: {
        totalRows: csvData.length,
        processedRows: processedCount,
        newOrders: newOrdersCount,
        updatedOrders: updatedOrdersCount,
        newCustomers: newCustomersCount,
        updatedCustomers: updatedCustomersCount,
        unified: unifiedResult.stats
      }
    });

  } catch (error) {
    console.error('QuickBooks CSV webhook error:', error);
    return NextResponse.json({ 
      error: "Failed to process CSV data",
      details: error.message 
    }, { status: 500 });
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ 
    status: "ok", 
    message: "QuickBooks CSV webhook endpoint is ready",
    url: "/api/webhooks/quickbooks-csv",
    authentication: "Basic Auth required",
    username: process.env.WEBHOOK_USERNAME || 'kinetic',
    password: process.env.WEBHOOK_PASSWORD || 'webhook2024'
  });
}
