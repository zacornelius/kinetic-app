import { NextResponse } from "next/server";
import db from "@/lib/database";

// Helper function to parse CSV data
function parseCSV(csvText: string) {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    if (values.length === headers.length && values[0]) { // Skip empty rows
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      rows.push(row);
    }
  }
  
  return rows;
}

// Helper function to fetch CSV from URL
async function fetchCSVFromURL(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    console.error('Error fetching CSV from URL:', error);
    throw error;
  }
}

// Webhook endpoint for QuickBooks CSV data from Zapier (raw CSV format)
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
    console.log('QuickBooks CSV webhook received with raw CSV data');
    
    // Extract CSV data from Zapier payload
    // Support both URLs and raw content, and handle separate Zaps
    const customerURL = body.customerURL || body.customer_url || body.customerCSVUrl;
    const lineItemsURL = body.lineItemsURL || body.line_items_url || body.lineItemsCSVUrl;
    
    const customerCSV = body.customerCSV || body.customer_csv || body.customerData || body.customer_data || 
                       body['Zac customer contact list'] || body['zac customer contact list'] || 
                       body['Kinetic Nutrition Group LLC_Zac Customer Contact List.csv'] ||
                       body['Kinetic Nutrition Group LLC_Zac Customer Contact List'];
    const lineItemsCSV = body.lineItemsCSV || body.line_items_csv || body.lineItemsData || body.line_items_data || 
                        body.lineItems || body.line_items || body['zac line items'] || body['Zac line items'] ||
                        body['Kinetic Nutrition Group LLC_Zac Line items.csv'] ||
                        body['Kinetic Nutrition Group LLC_Zac Line items'];

    let finalCustomerCSV = customerCSV;
    let finalLineItemsCSV = lineItemsCSV;

    // If URLs are provided, fetch the CSV content
    if (customerURL) {
      console.log('Fetching customer CSV from URL:', customerURL);
      finalCustomerCSV = await fetchCSVFromURL(customerURL);
    }
    
    if (lineItemsURL) {
      console.log('Fetching line items CSV from URL:', lineItemsURL);
      finalLineItemsCSV = await fetchCSVFromURL(lineItemsURL);
    }
    
    console.log('Available fields in payload:', Object.keys(body));
    console.log('Customer CSV found:', !!finalCustomerCSV);
    console.log('Line Items CSV found:', !!finalLineItemsCSV);

    // Handle separate Zaps - at least one CSV must be provided
    if (!finalCustomerCSV && !finalLineItemsCSV) {
      return NextResponse.json({ 
        error: "Missing CSV data. Please provide either customer or line items CSV data.",
        receivedFields: Object.keys(body),
        supportedFields: ['customerCSV', 'lineItemsCSV', 'customerURL', 'lineItemsURL']
      }, { status: 400 });
    }

    // Parse CSV data (handle partial data from separate Zaps)
    const customerData = finalCustomerCSV ? parseCSV(finalCustomerCSV) : [];
    const lineItemsData = finalLineItemsCSV ? parseCSV(finalLineItemsCSV) : [];

    console.log(`Parsed ${customerData.length} customer rows and ${lineItemsData.length} line item rows`);

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

    // Process data from separate Zaps
    let processedOrders = 0;
    let processedCustomers = 0;

    // Process customer data if provided
    if (customerData.length > 0) {
      console.log(`Processing ${customerData.length} customer records`);
      
      for (const customer of customerData) {
        const customerName = customer['Customer full name'] || '';
        const email = customer['Email'] || '';
        
        if (customerName && email) {
          // Check if customer already exists
          const existingCustomer = db.prepare(`
            SELECT id FROM quickbooks_customers WHERE email = ?
          `).get(email);

          if (existingCustomer) {
            // Update existing customer
            db.prepare(`
              UPDATE quickbooks_customers SET
                firstName = ?, lastName = ?, phone = ?, 
                billingAddress = ?, shippingAddress = ?, updatedAt = ?
              WHERE email = ?
            `).run(
              customer['Full name']?.split(' ')[0] || '',
              customer['Full name']?.split(' ').slice(1).join(' ') || '',
              customer['Phone'] || '',
              customer['Bill address'] || '',
              customer['Ship address'] || '',
              new Date().toISOString(),
              email
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
              customerId, customerName, email,
              customer['Full name']?.split(' ')[0] || '',
              customer['Full name']?.split(' ').slice(1).join(' ') || '',
              customer['Phone'] || '',
              '', // companyName
              customer['Bill address'] || '',
              customer['Ship address'] || '',
              new Date().toISOString(),
              new Date().toISOString()
            );
            processedCustomers++;
          }
        }
      }
    }

    // Process line items data if provided
    if (lineItemsData.length > 0) {
      console.log(`Processing ${lineItemsData.length} line item records`);
      
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

    // Determine what type of data was processed
    const dataType = customerData.length > 0 && lineItemsData.length > 0 ? 'both' : 
                     customerData.length > 0 ? 'customers' : 'line items';
    
    return NextResponse.json({
      success: true,
      message: `Successfully processed QuickBooks ${dataType} data. ${processedOrders} orders and ${processedCustomers} customers processed.`,
      stats: {
        dataType: dataType,
        ordersProcessed: processedOrders,
        customersProcessed: processedCustomers,
        totalLineItems: lineItemsData.length,
        totalCustomers: customerData.length,
        customerMapSize: customerMap.size
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