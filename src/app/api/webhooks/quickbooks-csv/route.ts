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
      reportData, // Main transaction data (Zac Report.csv)
      customerData, // Customer contact data (Zac Customer Contact List.csv)
      lineItemsData, // Line items data (Zac Line items.csv)
      reportDate, // Date of the report
      totalRows
    } = body;

    if (!reportData || !Array.isArray(reportData)) {
      return NextResponse.json({ 
        error: "Missing or invalid reportData array" 
      }, { status: 400 });
    }

    console.log(`Processing ${reportData.length} report rows, ${customerData?.length || 0} customer rows, ${lineItemsData?.length || 0} line item rows from QuickBooks report`);

    // Create lookup maps for efficient merging
    const customerMap = new Map();
    const lineItemsMap = new Map();

    // Process customer data first to create lookup map
    if (customerData && Array.isArray(customerData)) {
      for (const customer of customerData) {
        const customerName = customer['Customer full name'] || customer['Customer full name'] || '';
        if (customerName) {
          customerMap.set(customerName, {
            email: customer.Email || '',
            phone: customer['Phone numbers'] || '',
            fullName: customer['Full name'] || customerName,
            billAddress: customer['Bill address'] || '',
            shipAddress: customer['Ship address'] || ''
          });
        }
      }
    }

    // Process line items data to create lookup map
    if (lineItemsData && Array.isArray(lineItemsData)) {
      for (const lineItem of lineItemsData) {
        const invoiceNum = lineItem.Num || '';
        const customerName = lineItem['Customer full name'] || '';
        const key = `${invoiceNum}_${customerName}`;
        
        if (!lineItemsMap.has(key)) {
          lineItemsMap.set(key, []);
        }
        
        lineItemsMap.get(key).push({
          product: lineItem['Product/Service'] || '',
          quantity: parseFloat(lineItem.Quantity || 0),
          price: parseFloat(lineItem['Sales price'] || 0),
          amount: parseFloat(lineItem.Amount || 0),
          description: lineItem['Memo/Description'] || ''
        });
      }
    }

    // Process each report row (main transaction data)
    let processedCount = 0;
    let newOrdersCount = 0;
    let updatedOrdersCount = 0;
    let newCustomersCount = 0;
    let updatedCustomersCount = 0;

    for (const row of reportData) {
      try {
        const invoiceNum = row.Num || '';
        const customerName = row.Name || '';
        const key = `${invoiceNum}_${customerName}`;
        
        // Get customer details from lookup map
        const customerInfo = customerMap.get(customerName) || {};
        
        // Get line items from lookup map
        const lineItems = lineItemsMap.get(key) || [];
        
        // Map report data to our format
        const orderData = {
          id: `qb_csv_${invoiceNum}`,
          orderNumber: invoiceNum,
          customerName: customerName,
          customerEmail: customerInfo.email || '',
          totalAmount: parseFloat((row.Amount || '0').replace(/,/g, '')),
          currency: 'USD',
          status: 'paid', // CSV reports are typically for paid transactions
          createdAt: row.Date || new Date().toISOString(),
          dueDate: row['Due date'] || null,
          billingAddress: customerInfo.billAddress || row['Delivery address'] || null,
          shippingAddress: customerInfo.shipAddress || row['Delivery address'] || null,
          notes: row['Memo/Description'] || '',
          lineItems: lineItems.length > 0 ? lineItems : null
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
            orderData.orderNumber,
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
                firstName = ?, lastName = ?, phone = ?,
                billingAddress = ?, shippingAddress = ?, updatedAt = ?
              WHERE email = ?
            `);
            
            const nameParts = (customerInfo.fullName || orderData.customerName).split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';
            
            updateCustomer.run(
              firstName,
              lastName,
              customerInfo.phone || '',
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
            const nameParts = (customerInfo.fullName || orderData.customerName).split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';
            
            insertCustomer.run(
              customerId,
              orderData.orderNumber,
              orderData.customerEmail,
              firstName,
              lastName,
              customerInfo.phone || '',
              '', // companyName
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
        console.error('Error processing report row:', rowError, 'Row data:', row);
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
      message: `QuickBooks CSV processed successfully. ${processedCount} orders processed from 3 files.`,
      stats: {
        reportRows: reportData.length,
        customerRows: customerData?.length || 0,
        lineItemRows: lineItemsData?.length || 0,
        processedOrders: processedCount,
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
