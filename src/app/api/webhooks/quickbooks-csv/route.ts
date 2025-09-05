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
    if (values.length === headers.length && values[0]) {
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      rows.push(row);
    }
  }
  
  return rows;
}

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
    console.log('QuickBooks CSV webhook received');
    console.log('Received fields:', Object.keys(body));
    console.log('Body content:', JSON.stringify(body, null, 2));
    
    // Extract data - support both CSV and JSON formats
    const customerCSV = body.customerCSV || body.customer_csv || body.customerData || body.customer_data || 
                       body['Zac customer contact list'] || body['Kinetic Nutrition Group LLC_Zac Customer Contact List.csv'];
    const lineItemsCSV = body.lineItemsCSV || body.line_items_csv || body.lineItemsData || body.line_items_data || 
                        body['zac line items'] || body['Kinetic Nutrition Group LLC_Zac Line items.csv'];
    
    // Also support direct JSON arrays
    const customerJSON = body.customers || body.customerList || body.customer_data_array || body.customerData;
    const lineItemsJSON = body.lineItems || body.lineItemsList || body.line_items_data_array || body.lineItemsData;
    
    // If no specific fields found, try to find any field that looks like data
    let fallbackData = null;
    if (!customerCSV && !lineItemsCSV && !customerJSON && !lineItemsJSON) {
      // Look for any field that might contain data
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === 'string' && value.length > 100) {
          // This looks like CSV data
          fallbackData = value;
          console.log(`Found potential CSV data in field: ${key}`);
          break;
        } else if (Array.isArray(value) && value.length > 0) {
          // This looks like JSON array data
          fallbackData = value;
          console.log(`Found potential JSON data in field: ${key}`);
          break;
        }
      }
    }

    if (!customerCSV && !lineItemsCSV && !customerJSON && !lineItemsJSON && !fallbackData) {
      return NextResponse.json({ 
        error: "Missing data. Please provide either CSV data (customerCSV/lineItemsCSV) or JSON data (customers/lineItems).",
        receivedFields: Object.keys(body),
        supportedFormats: {
          csv: ['customerCSV', 'lineItemsCSV'],
          json: ['customers', 'lineItems']
        }
      }, { status: 400 });
    }

    // Parse data - handle both CSV and JSON formats
    let customerData = [];
    let lineItemsData = [];
    
    if (customerCSV) {
      customerData = parseCSV(customerCSV);
    } else if (customerJSON && Array.isArray(customerJSON)) {
      customerData = customerJSON;
    } else if (fallbackData && typeof fallbackData === 'string') {
      // Try to parse fallback data as CSV
      customerData = parseCSV(fallbackData);
    } else if (fallbackData && Array.isArray(fallbackData)) {
      // Try to use fallback data as JSON
      customerData = fallbackData;
    }
    
    if (lineItemsCSV) {
      lineItemsData = parseCSV(lineItemsCSV);
    } else if (lineItemsJSON && Array.isArray(lineItemsJSON)) {
      lineItemsData = lineItemsJSON;
    } else if (fallbackData && typeof fallbackData === 'string' && customerData.length === 0) {
      // If we used fallback for customers, try again for line items
      lineItemsData = parseCSV(fallbackData);
    } else if (fallbackData && Array.isArray(fallbackData) && customerData.length === 0) {
      // If we used fallback for customers, try again for line items
      lineItemsData = fallbackData;
    }

    console.log(`Parsed ${customerData.length} customer rows and ${lineItemsData.length} line item rows`);

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

        // Helper function to parse date
        const parseDate = (dateStr: string) => {
          if (!dateStr) return new Date().toISOString();
          
          if (dateStr.includes('/')) {
            const [month, day, year] = dateStr.split('/');
            return new Date(year, month - 1, day).toISOString();
          }
          
          return new Date().toISOString();
        };

        // Create order data
        const orderData = {
          id: `qb_csv_${invoiceNum}`,
          orderNumber: invoiceNum,
          customerName: customerName,
          customerEmail: '', // Will be filled from customer data if available
          totalAmount: amount,
          currency: 'USD',
          status: 'paid',
          createdAt: parseDate(transactionDate),
          dueDate: null,
          billingAddress: null,
          shippingAddress: null,
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
              customerName = ?, totalAmount = ?, 
              billingAddress = ?, shippingAddress = ?, notes = ?, lineItems = ?
            WHERE orderNumber = ?
          `).run(
            orderData.customerName, orderData.totalAmount,
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
        totalCustomers: customerData.length
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