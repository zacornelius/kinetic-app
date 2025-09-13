import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';

interface InvoiceRequest {
  customerEmail: string;
  palletItems: {
    'Vital-24K': number;
    'Active-26K': number;
    'Puppy-28K': number;
    'Power-30K': number;
    'Ultra-32K': number;
  };
  shippingAddress: {
    firstName: string;
    lastName: string;
    address1: string;
    city: string;
    province: string;
    country: string;
    zip: string;
    phone?: string;
  };
  customMessage?: string;
  existingCustomerId?: string;
  assignedTo?: string; // Email of the logged-in user
}

export async function POST(request: NextRequest) {
  try {
    const body: InvoiceRequest = await request.json();
    
    // Validate required fields
    if (!body.customerEmail || !body.palletItems || !body.shippingAddress) {
      return NextResponse.json({ 
        error: 'Missing required fields: customerEmail, palletItems, shippingAddress' 
      }, { status: 400 });
    }

    // Validate shipping address fields
    const { firstName, lastName, address1, city, province, zip } = body.shippingAddress;
    if (!firstName || !lastName || !address1 || !city || !province || !zip) {
      return NextResponse.json({ 
        error: 'Missing required shipping address fields: firstName, lastName, address1, city, province, zip' 
      }, { status: 400 });
    }

    // Validate that at least one pallet item has quantity > 0
    const hasItems = Object.values(body.palletItems).some(qty => qty > 0);
    if (!hasItems) {
      return NextResponse.json({ 
        error: 'At least one pallet item must have a quantity greater than 0' 
      }, { status: 400 });
    }

    // Get Shopify credentials
    const shop = process.env.SHOPIFY_SHOP;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!shop || !accessToken) {
      return NextResponse.json({ 
        error: 'Shopify configuration not found' 
      }, { status: 500 });
    }

    // First, we need to get or create the Shopify customer
    // Create customer name from shipping address
    const customerName = `${body.shippingAddress.firstName} ${body.shippingAddress.lastName}`.trim();
    
    let shopifyCustomerId = await getOrCreateShopifyCustomer(
      shop, 
      accessToken, 
      body.customerEmail, 
      customerName,
      body.shippingAddress,
      body.existingCustomerId
    );

    console.log('Shopify customer ID:', shopifyCustomerId, 'Type:', typeof shopifyCustomerId);

    if (!shopifyCustomerId) {
      return NextResponse.json({ 
        error: 'Failed to create or find Shopify customer' 
      }, { status: 500 });
    }

    // Create line items for Build a Pallet with the exact 5 SKUs
    // Map SKUs to Build a Pallet variant IDs
    const skuToVariantMap = {
      'Vital-24K': 42751657312453,  // Vital 24K
      'Active-26K': 42732997345477, // Active 26K
      'Puppy-28K': 42732997378245,  // Puppy 28K
      'Power-30K': 42732997411013,  // Power 30K
      'Ultra-32K': 42732997443781   // Ultra 32K
    };

    const lineItemsWithVariants = [];
    for (const [sku, quantity] of Object.entries(body.palletItems)) {
      if (quantity > 0) {
        const variantId = skuToVariantMap[sku as keyof typeof skuToVariantMap];
        if (!variantId) {
          throw new Error(`Product variant not found for SKU: ${sku}`);
        }
        lineItemsWithVariants.push({
          variant_id: variantId,
          quantity: quantity,
          title: `Build a Pallet - ${sku}`
        });
      }
    }

    // Create the draft order
    const draftOrderData = {
      draft_order: {
        customer: {
          id: shopifyCustomerId
        },
        line_items: lineItemsWithVariants,
        shipping_address: body.shippingAddress,
        billing_address: body.shippingAddress, // Use shipping address as billing address too
        use_customer_default_address: false
      }
    };

    console.log('Creating draft order with shipping address:', body.shippingAddress);

    const draftOrderResponse = await fetch(`https://${shop}.myshopify.com/admin/api/2024-10/draft_orders.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken
      },
      body: JSON.stringify(draftOrderData)
    });

    if (!draftOrderResponse.ok) {
      const error = await draftOrderResponse.text();
      console.error('Draft order creation failed:', error);
      return NextResponse.json({ 
        error: 'Failed to create draft order',
        details: error
      }, { status: 500 });
    }

    const draftOrder = await draftOrderResponse.json();
    console.log('Draft order created with shipping address:', draftOrder.draft_order.shipping_address);
    const draftOrderId = draftOrder.draft_order.id;

    // Use Shopify's draft order name as the quote ID (e.g., #D1234)
    const shopifyQuoteId = draftOrder.draft_order.name || `#D${draftOrderId}`;
    
    // Get or create customer
    let customerId = body.existingCustomerId;
    if (!customerId) {
      // First check if customer already exists
      const existingCustomer = await db.prepare(`
        SELECT id FROM customers WHERE email = $1
      `).get(body.customerEmail);
      
      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        // Create new customer if doesn't exist
        customerId = Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();
        
        await db.prepare(`
          INSERT INTO customers (
            id, email, firstname, lastname, phone, companyname, 
            source, status, customertype, createdat, updatedat, totalorders, totalspent, assignedto
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `).run(
          customerId, body.customerEmail, body.shippingAddress.firstName, body.shippingAddress.lastName,
          body.shippingAddress.phone, body.shippingAddress.company || null, 'quote', 'contact', 
          'Contact', now, now, 0, 0, body.assignedTo || null
        );
      }
    }
    
    // Save quote record
    const palletItems = Object.entries(body.palletItems).filter(([_, qty]) => qty > 0);
    
    await db.prepare(`
      INSERT INTO quotes (
        quote_id, shopify_draft_order_id, customer_id, customer_email,
        total_amount, pallet_items, custom_message, shipping_address, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'quoted')
    `).run(
      shopifyQuoteId, draftOrderId, customerId, body.customerEmail,
      draftOrder.draft_order.total_price, JSON.stringify(palletItems), body.customMessage || null,
      body.shippingAddress ? JSON.stringify(body.shippingAddress) : null
    );
    
    // Send the invoice
    const invoiceData = {
      draft_order_invoice: {
        to: body.customerEmail,
        subject: `Quote ${shopifyQuoteId} from Kinetic Dog Food`,
        custom_message: body.customMessage || 'Thank you for your business! Please review and complete your payment.'
      }
    };

    // Retry mechanism for sending invoice (Shopify needs time to calculate)
    let invoiceResponse;
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    while (retryCount < maxRetries) {
      // Wait before retry (except first attempt)
      if (retryCount > 0) {
        console.log(`Retrying invoice send (attempt ${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }

      invoiceResponse = await fetch(`https://${shop}.myshopify.com/admin/api/2024-10/draft_orders/${draftOrderId}/send_invoice.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken
        },
        body: JSON.stringify(invoiceData)
      });

      if (invoiceResponse.ok) {
        break; // Success, exit retry loop
      }

      const error = await invoiceResponse.text();
      console.error(`Invoice sending failed (attempt ${retryCount + 1}):`, error);
      
      // Check if it's the "not finished calculating" error
      if (error.includes('not finished calculating')) {
        retryCount++;
        if (retryCount < maxRetries) {
          continue; // Retry
        }
      } else {
        // Different error, don't retry
        break;
      }
    }

    if (!invoiceResponse.ok) {
      const error = await invoiceResponse.text();
      console.error('Invoice sending failed after all retries:', error);
      return NextResponse.json({ 
        error: 'Draft order created but failed to send invoice after retries',
        draftOrderId,
        details: error,
        suggestion: 'The draft order was created successfully. You can manually send the invoice from Shopify admin or try again in a few moments.'
      }, { status: 500 });
    }

    const invoiceResult = await invoiceResponse.json();

    return NextResponse.json({
      success: true,
      message: 'Quote sent successfully',
      draftOrderId,
      customerEmail: body.customerEmail,
      totalAmount: draftOrder.draft_order.total_price,
      quoteUrl: draftOrder.draft_order.invoice_url,
      quoteId: shopifyQuoteId // Shopify's draft order name (e.g., #D1234)
    });

  } catch (error) {
    console.error('Quote creation error:', error);
    return NextResponse.json({ 
      error: 'Failed to create and send quote',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function getOrCreateShopifyCustomer(shop: string, accessToken: string, email: string, name?: string, shippingAddress?: any, existingCustomerId?: string): Promise<number | null> {
  try {
    // First, try to find existing customer
    const searchResponse = await fetch(`https://${shop}.myshopify.com/admin/api/2024-10/customers/search.json?query=email:${email}`, {
      headers: {
        'X-Shopify-Access-Token': accessToken
      }
    });

    if (searchResponse.ok) {
      const searchResult = await searchResponse.json();
      if (searchResult.customers && searchResult.customers.length > 0) {
        return searchResult.customers[0].id;
      }
    }

    // Customer not found, create new one
    const [firstName, ...lastNameParts] = (name || '').split(' ');
    const lastName = lastNameParts.join(' ') || '';

    const customerData = {
      customer: {
        email: email,
        first_name: firstName || shippingAddress?.firstName || '',
        last_name: lastName || shippingAddress?.lastName || '',
        phone: shippingAddress?.phone || ''
      }
    };

    // Note: Customer record updates are handled in the main function

    console.log('Creating customer with data:', JSON.stringify(customerData, null, 2));
    
    const createResponse = await fetch(`https://${shop}.myshopify.com/admin/api/2024-10/customers.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken
      },
      body: JSON.stringify(customerData)
    });

    console.log('Create response status:', createResponse.status);

    if (createResponse.ok) {
      const customer = await createResponse.json();
      console.log('Customer created successfully:', customer.customer.id);
      return customer.customer.id;
    }

    const errorText = await createResponse.text();
    console.error('Failed to create customer:', errorText);
    return null;
  } catch (error) {
    console.error('Error getting/creating customer:', error);
    return null;
  }
}

async function getProductVariantId(shop: string, accessToken: string, sku: string): Promise<number | null> {
  try {
    // Search for product by SKU
    const searchResponse = await fetch(`https://${shop}.myshopify.com/admin/api/2024-10/products.json?limit=250`, {
      headers: {
        'X-Shopify-Access-Token': accessToken
      }
    });

    if (!searchResponse.ok) {
      return null;
    }

    const products = await searchResponse.json();
    
    // Look for product with matching SKU
    for (const product of products.products) {
      for (const variant of product.variants) {
        if (variant.sku === sku) {
          return variant.id;
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding product variant:', error);
    return null;
  }
}
