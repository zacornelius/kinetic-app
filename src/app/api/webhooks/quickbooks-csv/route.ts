import { NextResponse } from "next/server";
import db from "@/lib/database";

// Webhook endpoint for QuickBooks CSV data from Zapier (simplified 2-file format)
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
    
    // Extract CSV data from Zapier payload (simplified 2-file format)
    const {
      customerData, // Customer contact data (Kinetic Nutrition Group LLC_Zac Customer Contact List.csv)
      lineItemsData, // Line items data (Kinetic Nutrition Group LLC_Zac Line items.csv)
      reportDate, // Date of the report
      totalRows
    } = body;

    if (!lineItemsData || !Array.isArray(lineItemsData)) {
      return NextResponse.json({ 
        error: "Missing or invalid lineItemsData array" 
      }, { status: 400 });
    }

    console.log(`Processing ${lineItemsData.length} line item rows, ${customerData?.length || 0} customer rows from QuickBooks report`);

    // Create lookup map for customer data
    const customerMap = new Map();

    // Process customer data first to create lookup map
    if (customerData && Array.isArray(customerData)) {
      for (const customer of customerData) {
        const customerName = customer['Customer full name'] || '';
        if (customerName) {
          customerMap.set(customerName, {
            email: customer['Email'] || '',
            firstName: customer['Full name']?.split(' ')[0] || '',
            lastName: customer['Full name']?.split(' ').slice(1).join(' ') || '',
            phone: customer['Phone'] || '',
            billAddress: customer['Bill address'] || '',
            shipAddress: customer['Ship address'] || ''
          });
        }
      }
    }

    console.log(`Created customer lookup map with ${customerMap.size} customers`);

    // Helper function to parse date
    const parseDate = (dateStr) => {
      if (!dateStr) return new Date().toISOString();
      
      // Handle MM/DD/YYYY format
      if (dateStr.includes('/')) {
        const [month, day, year] = dateStr.split('/');
        return new Date(year, month - 1, day).toISOString();
      }
      
      // Handle YYYY-MM-DD format
      if (dateStr.includes('-')) {
        return new Date(dateStr).toISOString();
      }
      
      return new Date().toISOString();
    };

    // Process line items data (which now contains all transaction data)
    let processedOrders = 0;
    let processedCustomers = 0;

    for (const row of lineItemsData) {
      const invoiceNum = row['Num'] || '';
      const customerName = row['Customer full name'] || '';
      const productName = row['Product/Service'] || '';
      const quantity = parseFloat(row['Quantity'] || '0');
      const salesPrice = parseFloat((row['Sales price'] || '0').replace(/,/g, ''));
      const amount = parseFloat((row['Amount'] || '0').replace(/,/g, ''));
      const transactionDate = row['Transaction date'] || '';
      const memo = row['Memo/Description'] || '';

      if (!invoiceNum || !customerName) {
        console.log('Skipping row with missing invoice number or customer name:', row);
        continue;
      }

      // Get customer info from lookup map
      const customerInfo = customerMap.get(customerName) || {};

      // Create order data
      const orderData = {
        id: `qb_csv_${invoiceNum}`,
        orderNumber: invoiceNum,
        customerName: customerName,
        customerEmail: customerInfo.email || '',
        totalAmount: amount,
        currency: 'USD',
        status: 'paid', // CSV reports are typically for paid transactions
        createdAt: parseDate(transactionDate),
        dueDate: null,
        billingAddress: customerInfo.billAddress || null,
        shippingAddress: customerInfo.shipAddress || null,
        notes: memo,
        lineItems: JSON.stringify([{
          product: productName,
          quantity: quantity,
          price: salesPrice,
          amount: amount,
          description: memo
        }])
      };

      // Check if order already exists
      const existingOrder = db.prepare(`
        SELECT id FROM quickbooks_orders 
        WHERE orderNumber = ? OR quickbooksInvoiceId = ?
      `).get(invoiceNum, invoiceNum);

      if (existingOrder) {
        // Update existing order
        db.prepare(`
          UPDATE quickbooks_orders SET
            customerName = ?, customerEmail = ?, totalAmount = ?, 
            billingAddress = ?, shippingAddress = ?, notes = ?, lineItems = ?
          WHERE orderNumber = ?
        `).run(
          orderData.customerName, orderData.customerEmail, orderData.totalAmount,
          orderData.billingAddress, orderData.shippingAddress, orderData.notes, orderData.lineItems,
          invoiceNum
        );
      } else {
        // Insert new order
        db.prepare(`
          INSERT INTO quickbooks_orders (
            id, createdAt, orderNumber, customerEmail, customerName, totalAmount,
            currency, status, shippingAddress, billingAddress, dueDate, notes, 
            ownerEmail, quickbooksInvoiceId, lineItems
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          orderData.id, orderData.createdAt, orderData.orderNumber, orderData.customerEmail,
          orderData.customerName, orderData.totalAmount, orderData.currency, orderData.status,
          orderData.shippingAddress, orderData.billingAddress, orderData.dueDate, orderData.notes,
          '', invoiceNum, orderData.lineItems
        );
        processedOrders++;
      }

      // Insert/update customer if we have customer data
      if (customerInfo.email) {
        const existingCustomer = db.prepare(`
          SELECT id FROM quickbooks_customers WHERE email = ?
        `).get(customerInfo.email);

        if (existingCustomer) {
          // Update existing customer
          db.prepare(`
            UPDATE quickbooks_customers SET
              firstName = ?, lastName = ?, phone = ?, 
              billingAddress = ?, shippingAddress = ?, updatedAt = ?
            WHERE email = ?
          `).run(
            customerInfo.firstName, customerInfo.lastName, customerInfo.phone,
            customerInfo.billAddress, customerInfo.shipAddress, new Date().toISOString(),
            customerInfo.email
          );
        } else {
          // Insert new customer
          const customerId = `qb_customer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          db.prepare(`
            INSERT INTO quickbooks_customers (
              id, quickbooksId, email, firstName, lastName, phone,
              companyName, billingAddress, shippingAddress, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            customerId, invoiceNum, customerInfo.email, customerInfo.firstName, 
            customerInfo.lastName, customerInfo.phone, '', customerInfo.billAddress, 
            customerInfo.shipAddress, orderData.createdAt, new Date().toISOString()
          );
          processedCustomers++;
        }
      }
    }

    console.log(`Processed ${processedOrders} new orders and ${processedCustomers} new customers`);

    // Sync to unified tables
    try {
      const unifiedResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/sync/unified`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (unifiedResponse.ok) {
        const unifiedResult = await unifiedResponse.json();
        console.log('Unified sync completed:', unifiedResult);
      } else {
        console.error('Unified sync failed:', await unifiedResponse.text());
      }
    } catch (syncError) {
      console.error('Error calling unified sync:', syncError);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${processedOrders} orders and ${processedCustomers} customers from QuickBooks CSV data`,
      stats: {
        ordersProcessed: processedOrders,
        customersProcessed: processedCustomers,
        totalLineItems: lineItemsData.length,
        totalCustomers: customerMap.size
      }
    });

  } catch (error) {
    console.error('QuickBooks CSV webhook error:', error);
    return NextResponse.json(
      { 
        error: "Failed to process QuickBooks CSV data", 
        details: error.message 
      },
      { status: 500 }
    );
  }
}