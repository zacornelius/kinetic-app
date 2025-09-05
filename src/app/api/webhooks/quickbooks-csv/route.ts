import { NextResponse } from "next/server";
import db from "@/lib/database";

// Helper function to parse CSV data
function parseCSV(csvText: string) {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  
  // Find the actual header row (skip any title rows)
  let headerRowIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if (line.includes('product/service') || line.includes('transaction date') || line.includes('customer full name')) {
      headerRowIndex = i;
      break;
    }
  }
  
  const headers = lines[headerRowIndex].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows = [];
  
  for (let i = headerRowIndex + 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    if (values.length >= headers.length && values[0]) {
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      rows.push(row);
    }
  }
  
  return rows;
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
    let fallbackDataType = null;
    if (!customerCSV && !lineItemsCSV && !customerJSON && !lineItemsJSON) {
      // Look for any field that might contain data
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === 'string' && value.length > 100) {
          // This looks like CSV data - try to determine if it's customer or line items
          const firstLine = value.split('\n')[0].toLowerCase();
          console.log(`CSV header line: ${firstLine}`);
          
          if (firstLine.includes('product/service') || firstLine.includes('transaction date') || firstLine.includes('num') || firstLine.includes('quantity') || firstLine.includes('sales price')) {
            fallbackDataType = 'lineItems';
            console.log(`Found potential line items CSV data in field: ${key}`);
          } else if (firstLine.includes('customer full name') || firstLine.includes('email') || firstLine.includes('full name') || firstLine.includes('phone')) {
            fallbackDataType = 'customers';
            console.log(`Found potential customer CSV data in field: ${key}`);
          } else {
            // Look for more specific patterns in the data
            const lines = value.split('\n');
            const hasProductService = lines.some(line => line.toLowerCase().includes('product/service'));
            const hasTransactionDate = lines.some(line => line.toLowerCase().includes('transaction date'));
            const hasQuantity = lines.some(line => line.toLowerCase().includes('quantity'));
            
            if (hasProductService || hasTransactionDate || hasQuantity) {
              fallbackDataType = 'lineItems';
              console.log(`Found line items CSV data in field: ${key} (detected by content analysis)`);
            } else {
              fallbackDataType = 'customers';
              console.log(`Found potential CSV data in field: ${key} (defaulting to customers)`);
            }
          }
          fallbackData = value;
          break;
        } else if (Array.isArray(value) && value.length > 0) {
          // This looks like JSON array data
          fallbackData = value;
          fallbackDataType = 'customers'; // Default to customers for JSON
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
    } else if (fallbackData && fallbackDataType === 'customers') {
      if (typeof fallbackData === 'string') {
        customerData = parseCSV(fallbackData);
      } else if (Array.isArray(fallbackData)) {
        customerData = fallbackData;
      }
    }
    
    if (lineItemsCSV) {
      lineItemsData = parseCSV(lineItemsCSV);
    } else if (lineItemsJSON && Array.isArray(lineItemsJSON)) {
      lineItemsData = lineItemsJSON;
    } else if (fallbackData && fallbackDataType === 'lineItems') {
      if (typeof fallbackData === 'string') {
        lineItemsData = parseCSV(fallbackData);
      } else if (Array.isArray(fallbackData)) {
        lineItemsData = fallbackData;
      }
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

    // Process line items data if provided - GROUP BY INVOICE NUMBER
    if (lineItemsData.length > 0) {
      console.log(`Processing ${lineItemsData.length} line item records`);
      
      // Group line items by invoice number
      const ordersByInvoice: { [key: string]: any[] } = {};
      
      for (const row of lineItemsData) {
        const invoiceNum = row['Num'] || '';
        const customerName = row['Customer full name'] || '';
        
        if (!invoiceNum || !customerName) {
          console.log('Skipping row with missing invoice number or customer name:', row);
          continue;
        }
        
        if (!ordersByInvoice[invoiceNum]) {
          ordersByInvoice[invoiceNum] = [];
        }
        
        ordersByInvoice[invoiceNum].push(row);
      }
      
      console.log(`Found ${Object.keys(ordersByInvoice).length} unique invoices`);
      
      // Process each invoice as a single order
      for (const [invoiceNum, lineItems] of Object.entries(ordersByInvoice)) {
        const firstItem = lineItems[0];
        const customerName = firstItem['Customer full name'] || '';
        const transactionDate = firstItem['Transaction date'] || '';
        const memo = firstItem['Memo/Description'] || '';
        
        // Calculate total amount from all line items
        const totalAmount = lineItems.reduce((sum, item) => {
          const amount = parseFloat((item['Amount'] || '0').replace(/,/g, ''));
          return sum + amount;
        }, 0);
        
        // Find customer email from customer data
        let customerEmail = '';
        if (customerData.length > 0) {
          const customer = customerData.find(c => c['Customer full name'] === customerName);
          if (customer) {
            customerEmail = customer['Email'] || '';
          }
        }
        
        // Create line items array
        const processedLineItems = lineItems.map(item => ({
          product: item['Product/Service'] || '',
          quantity: parseFloat(item['Quantity'] || '0'),
          price: parseFloat((item['Sales price'] || '0').replace(/,/g, '')),
          amount: parseFloat((item['Amount'] || '0').replace(/,/g, '')),
          description: item['Memo/Description'] || ''
        }));
        
        // Create order data
        const orderData = {
          id: `qb_csv_${invoiceNum}`,
          orderNumber: invoiceNum,
          customerName: customerName,
          customerEmail: customerEmail,
          totalAmount: totalAmount,
          currency: 'USD',
          status: 'paid',
          createdAt: parseDate(transactionDate),
          dueDate: null,
          billingAddress: null,
          shippingAddress: null,
          notes: memo,
          lineItems: JSON.stringify(processedLineItems)
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