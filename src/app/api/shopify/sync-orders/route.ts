import { NextResponse } from "next/server";
import db from "@/lib/database";

type ShopifyOrder = {
  id: number;
  order_number: string;
  email: string;
  customer?: {
    id?: number;
    first_name?: string;
    last_name?: string;
    phone?: string;
  };
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  total_shipping_price_set?: {
    shop_money: {
      amount: string;
      currency_code: string;
    };
  };
  total_discounts: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  shipping_address?: {
    address1?: string;
    address2?: string;
    city?: string;
    province?: string;
    country?: string;
    zip?: string;
  };
  billing_address?: {
    address1?: string;
    address2?: string;
    city?: string;
    province?: string;
    country?: string;
    zip?: string;
  };
  line_items: Array<{
    id: number;
    product_id?: number;
    variant_id?: number;
    sku?: string;
    title: string;
    name: string;
    quantity: number;
    price: string;
    total_discount: string;
    vendor?: string;
    product_type?: string;
  }>;
  created_at: string;
  updated_at: string;
  note?: string;
};

type Customer = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  companyName?: string;
  billingAddress?: string;
  shippingAddress?: string;
  createdAt: string;
  updatedAt: string;
};

type Product = {
  id: string;
  shopifyProductId?: string;
  sku?: string;
  title: string;
  vendor?: string;
  productType?: string;
  price?: number;
  cost?: number;
  createdAt: string;
  updatedAt: string;
};

type Order = {
  id: string;
  createdAt: string;
  orderNumber: string;
  shopifyOrderId: string;
  customerEmail: string;
  customerName?: string;
  totalAmount: number;
  currency: string;
  status: string;
  shippingAddress?: string;
  trackingNumber?: string;
  notes?: string;
  ownerEmail?: string;
};

type OrderLineItem = {
  id: string;
  orderId: string;
  productId?: string;
  shopifyVariantId?: string;
  sku?: string;
  title: string;
  quantity: number;
  price: number;
  totalPrice: number;
  vendor?: string;
};

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function mapShopifyOrderToCustomer(shopifyOrder: ShopifyOrder): Customer {
  // Format billing address
  const billingAddress = shopifyOrder.billing_address
    ? [
        shopifyOrder.billing_address.address1,
        shopifyOrder.billing_address.address2,
        shopifyOrder.billing_address.city,
        shopifyOrder.billing_address.province,
        shopifyOrder.billing_address.country,
        shopifyOrder.billing_address.zip
      ].filter(Boolean).join(', ')
    : undefined;

  // Format shipping address
  const shippingAddress = shopifyOrder.shipping_address
    ? [
        shopifyOrder.shipping_address.address1,
        shopifyOrder.shipping_address.address2,
        shopifyOrder.shipping_address.city,
        shopifyOrder.shipping_address.province,
        shopifyOrder.shipping_address.country,
        shopifyOrder.shipping_address.zip
      ].filter(Boolean).join(', ')
    : undefined;

  return {
    id: generateId(),
    email: shopifyOrder.email.toLowerCase(),
    firstName: shopifyOrder.customer?.first_name,
    lastName: shopifyOrder.customer?.last_name,
    phone: shopifyOrder.customer?.phone,
    companyName: shopifyOrder.customer?.first_name ? undefined : shopifyOrder.customer?.first_name, // Will be empty for now
    billingAddress,
    shippingAddress,
    createdAt: new Date(shopifyOrder.created_at).toISOString(),
    updatedAt: new Date(shopifyOrder.updated_at).toISOString(),
  };
}

function mapShopifyLineItemToProduct(lineItem: ShopifyOrder['line_items'][0]): Product {
  return {
    id: generateId(),
    shopifyProductId: lineItem.product_id?.toString(),
    sku: lineItem.sku,
    title: lineItem.title,
    vendor: lineItem.vendor,
    productType: lineItem.product_type,
    price: parseFloat(lineItem.price),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function mapShopifyOrderToOrder(shopifyOrder: ShopifyOrder): Order {
  const customerName = shopifyOrder.customer 
    ? `${shopifyOrder.customer.first_name || ''} ${shopifyOrder.customer.last_name || ''}`.trim()
    : undefined;

  const shippingAddress = shopifyOrder.shipping_address
    ? [
        shopifyOrder.shipping_address.address1,
        shopifyOrder.shipping_address.address2,
        shopifyOrder.shipping_address.city,
        shopifyOrder.shipping_address.province,
        shopifyOrder.shipping_address.country,
        shopifyOrder.shipping_address.zip
      ].filter(Boolean).join(', ')
    : undefined;

  // Map Shopify status to our status
  let status = 'pending';
  if (shopifyOrder.fulfillment_status === 'fulfilled') {
    status = 'delivered';
  } else if (shopifyOrder.fulfillment_status === 'partial') {
    status = 'shipped';
  } else if (shopifyOrder.financial_status === 'paid') {
    status = 'processing';
  }

  return {
    id: generateId(),
    createdAt: new Date(shopifyOrder.created_at).toISOString(),
    orderNumber: shopifyOrder.order_number.toString(),
    shopifyOrderId: shopifyOrder.id.toString(),
    customerEmail: shopifyOrder.email.toLowerCase(),
    customerName,
    totalAmount: parseFloat(shopifyOrder.total_price),
    currency: shopifyOrder.currency,
    status,
    shippingAddress,
    notes: shopifyOrder.note,
    lineItems: JSON.stringify(shopifyOrder.line_items),
  };
}

function mapShopifyLineItemToOrderLineItem(
  lineItem: ShopifyOrder['line_items'][0], 
  orderId: string, 
  productId?: string
): OrderLineItem {
  // Extract SKU from name field for "Build a Pallet" items
  let extractedSku = lineItem.sku;
  let displayTitle = lineItem.title;
  
  if (lineItem.title === "Build a Pallet" && lineItem.name) {
    // Extract the product name from "Build a Pallet - Product Name"
    const productName = lineItem.name.replace("Build a Pallet - ", "");
    displayTitle = productName;
    
    // Try to extract SKU from the product name
    // This is a heuristic - you may need to adjust based on your actual SKU patterns
    if (productName.includes("Vital 24K")) {
      extractedSku = "Vital-24K";
    } else if (productName.includes("Active 26K")) {
      extractedSku = "Active-26K";
    } else if (productName.includes("Ultra 32K")) {
      extractedSku = "Ultra-32K";
    } else if (productName.includes("Power 30K")) {
      extractedSku = "Power-30K";
    } else if (productName.includes("Puppy 28K")) {
      extractedSku = "Puppy-28K";
    } else if (productName.includes("Build a Pallet")) {
      extractedSku = "Build-Pallet";
    }
  }

  return {
    id: generateId(),
    orderId,
    productId,
    shopifyVariantId: lineItem.variant_id?.toString(),
    sku: extractedSku,
    title: displayTitle,
    quantity: lineItem.quantity,
    price: parseFloat(lineItem.price),
    totalPrice: parseFloat(lineItem.price) * lineItem.quantity - parseFloat(lineItem.total_discount),
    vendor: lineItem.vendor,
  };
}

async function processShopifyOrders(shopifyOrders: ShopifyOrder[]) {
  const customers: Customer[] = [];
  const products: Product[] = [];
  const orders: Order[] = [];
  const lineItems: OrderLineItem[] = [];
  const customerMap = new Map<string, string>(); // email -> customerId
  const productMap = new Map<string, string>(); // sku -> productId

  for (const shopifyOrder of shopifyOrders) {
    // Process customer
    const customer = mapShopifyOrderToCustomer(shopifyOrder);
    if (!customerMap.has(customer.email)) {
      customers.push(customer);
      customerMap.set(customer.email, customer.id);
    }

    // Process order
    const order = mapShopifyOrderToOrder(shopifyOrder);
    orders.push(order);

    // Process line items and products
    for (const lineItem of shopifyOrder.line_items) {
      // Create product if it doesn't exist
      if (lineItem.sku && !productMap.has(lineItem.sku)) {
        const product = mapShopifyLineItemToProduct(lineItem);
        products.push(product);
        productMap.set(lineItem.sku, product.id);
      }

      // Create line item
      const orderLineItem = mapShopifyLineItemToOrderLineItem(
        lineItem, 
        order.id, 
        lineItem.sku ? productMap.get(lineItem.sku) : undefined
      );
      lineItems.push(orderLineItem);
    }
  }

  return { customers, products, orders, lineItems };
}

async function fetchShopifyOrders(shop: string, accessToken: string, limit: number = 250, sinceId?: string, maxPages: number = 100, onProgress?: (progress: { fetched: number, page: number }) => void): Promise<ShopifyOrder[]> {
  const orders: ShopifyOrder[] = [];
  let pageInfo = '';
  let hasNextPage = true;
  let pageCount = 0;
  const seenPageInfos = new Set<string>();

  // Helper function to add delay between requests
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  while (hasNextPage) {
    pageCount++;
    // Ensure shop name doesn't already include .myshopify.com
    const cleanShop = shop.replace('.myshopify.com', '');
    // Don't include status parameter when using page_info for pagination
    let url: string;
    if (pageInfo) {
      url = `https://${cleanShop}.myshopify.com/admin/api/2023-10/orders.json?limit=${limit}&page_info=${pageInfo}`;
    } else if (sinceId) {
      // For incremental sync, get orders created after the last synced order
      url = `https://${cleanShop}.myshopify.com/admin/api/2023-10/orders.json?limit=${limit}&since_id=${sinceId}`;
    } else {
      // Full sync - get all orders from the end (newest first)
      url = `https://${cleanShop}.myshopify.com/admin/api/2023-10/orders.json?limit=${limit}&status=any&order=created_at+desc`;
    }
    
    console.log('Making request to:', url);
    console.log('Shop:', cleanShop);
    console.log('Access token:', accessToken.substring(0, 10) + '...');
    
    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Error response body:', errorText);
      
      // Handle rate limiting with retry
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 2000; // Default 2 seconds
        console.log(`Rate limited. Waiting ${waitTime}ms before retry...`);
        await delay(waitTime);
        continue; // Retry the same request
      }
      
      throw new Error(`Shopify API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    orders.push(...data.orders);
    console.log(`Fetched ${data.orders.length} orders. Total so far: ${orders.length}`);

    // Call progress callback
    if (onProgress) {
      onProgress({ fetched: orders.length, page: pageCount });
    }

    // Check for pagination
    const linkHeader = response.headers.get('Link');
    if (linkHeader && linkHeader.includes('rel="next"')) {
      const nextMatch = linkHeader.match(/page_info=([^&>]+)/);
      if (nextMatch) {
        const newPageInfo = nextMatch[1];
        // Prevent infinite loops by checking if we've seen this page before
        if (seenPageInfos.has(newPageInfo)) {
          console.log('Detected pagination loop, but continuing to get all orders');
          // Don't stop, just continue to get all orders
        }
        seenPageInfos.add(newPageInfo);
        pageInfo = newPageInfo;
        // Add minimal delay between requests to respect rate limits
        await delay(100); // Reduced to 100ms for faster sync
      } else {
        hasNextPage = false;
      }
    } else {
      hasNextPage = false;
    }

    // Safety limit to prevent infinite loops
    if (pageCount > maxPages) {
      console.log(`Reached safety limit of ${maxPages} pages, stopping sync`);
      hasNextPage = false;
    }
    
    // For incremental syncs with sinceId, also limit by total orders fetched
    if (sinceId && orders.length >= (limit * maxPages)) {
      console.log(`Reached order limit for incremental sync (${orders.length} orders), stopping sync`);
      hasNextPage = false;
    }
  }

  return orders;
}

export async function POST(request: Request) {
  try {
    const { shop, accessToken, limit, sinceId, maxPages } = await request.json();

    if (!shop || !accessToken) {
      return NextResponse.json(
        { error: "Shop and access token are required" },
        { status: 400 }
      );
    }

    // Get the last synced order ID for incremental sync
    let lastOrderId: string | undefined = sinceId;
    if (sinceId === undefined) {
      // For full sync, don't use sinceId - get all orders from the beginning
      lastOrderId = undefined;
    }

    // Fetch orders from Shopify - all orders or incremental
    const shopifyOrders = await fetchShopifyOrders(shop, accessToken, limit || 250, lastOrderId, maxPages || 5, (progress) => {
      console.log(`Progress: Fetched ${progress.fetched} orders from ${progress.page} pages`);
    });
    
    // Process orders with full data structure
    const processedData = await processShopifyOrders(shopifyOrders);

    // Use transaction for better performance
    const insertMany = db.transaction(() => {
      let insertedCount = 0;
      let updatedCount = 0;

      // Insert customers into shopify_customers table
      const customerStmt = db.prepare(`
        INSERT INTO shopify_customers (
          id, email, firstName, lastName, phone, companyName, billingAddress, shippingAddress, createdAt, updatedAt
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          firstName = EXCLUDED.firstName,
          lastName = EXCLUDED.lastName,
          phone = EXCLUDED.phone,
          companyName = EXCLUDED.companyName,
          billingAddress = EXCLUDED.billingAddress,
          shippingAddress = EXCLUDED.shippingAddress,
          updatedAt = EXCLUDED.updatedAt
      `);

      for (const customer of processedData.customers) {
        const existing = db.prepare('SELECT id FROM shopify_customers WHERE email = $1').get(customer.email);
        if (!existing) {
          customerStmt.run(
            customer.id, customer.email, customer.firstName, customer.lastName,
            customer.phone, customer.companyName, customer.billingAddress, customer.shippingAddress,
            customer.createdAt, customer.updatedAt
          );
        }
      }

      // Insert products
      const productStmt = db.prepare(`
        INSERT INTO products (
          id, shopifyProductId, sku, title, vendor, productType, price, cost, createdAt, updatedAt
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          shopifyProductId = EXCLUDED.shopifyProductId,
          sku = EXCLUDED.sku,
          title = EXCLUDED.title,
          vendor = EXCLUDED.vendor,
          productType = EXCLUDED.productType,
          price = EXCLUDED.price,
          cost = EXCLUDED.cost,
          updatedAt = EXCLUDED.updatedAt
      `);

      for (const product of processedData.products) {
        const existing = db.prepare('SELECT id FROM products WHERE sku = $1 OR shopifyProductId = $2').get(product.sku, product.shopifyProductId);
        if (!existing) {
          productStmt.run(
            product.id, product.shopifyProductId, product.sku, product.title,
            product.vendor, product.productType, product.price, product.cost,
            product.createdAt, product.updatedAt
          );
        }
      }

      // Insert orders into shopify_orders table
      const orderStmt = db.prepare(`
        INSERT INTO shopify_orders (
          id, createdAt, orderNumber, shopifyOrderId, customerEmail, customerName, 
          totalAmount, currency, status, shippingAddress, notes, ownerEmail, lineItems
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          createdAt = EXCLUDED.createdAt,
          orderNumber = EXCLUDED.orderNumber,
          shopifyOrderId = EXCLUDED.shopifyOrderId,
          customerEmail = EXCLUDED.customerEmail,
          customerName = EXCLUDED.customerName,
          totalAmount = EXCLUDED.totalAmount,
          currency = EXCLUDED.currency,
          status = EXCLUDED.status,
          shippingAddress = EXCLUDED.shippingAddress,
          notes = EXCLUDED.notes,
          ownerEmail = EXCLUDED.ownerEmail,
          lineItems = EXCLUDED.lineItems
      `);

      for (const order of processedData.orders) {
        const existing = db.prepare('SELECT id FROM shopify_orders WHERE orderNumber = $1').get(order.orderNumber);
        
        if (existing) {
          updatedCount++;
        } else {
          insertedCount++;
        }

        orderStmt.run(
          order.id, order.createdAt, order.orderNumber, order.shopifyOrderId,
          order.customerEmail, order.customerName, order.totalAmount, 
          order.currency, order.status, order.shippingAddress, order.notes, order.ownerEmail, order.lineItems
        );
      }

      // Line items are now stored as JSON in the shopify_orders table
      // No separate line items table needed

      return { insertedCount, updatedCount };
    });

    const { insertedCount, updatedCount } = insertMany();

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${processedData.orders.length} orders with ${processedData.lineItems.length} line items from Shopify`,
      stats: {
        orders: processedData.orders.length,
        customers: processedData.customers.length,
        products: processedData.products.length,
        lineItems: processedData.lineItems.length,
        inserted: insertedCount,
        updated: updatedCount
      }
    });

  } catch (error) {
    console.error('Shopify sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync orders" },
      { status: 500 }
    );
  }
}

// GET endpoint to check sync status
export async function GET() {
  try {
    const totalOrders = await db.prepare('SELECT COUNT(*) as count FROM shopify_orders').get() as { count: number };
    const recentOrders = await db.prepare(`
      SELECT orderNumber, customerEmail, totalAmount, status, createdAt 
      FROM shopify_orders 
      ORDER BY createdAt DESC 
      LIMIT 10
    `).all();

    return NextResponse.json({
      totalOrders: totalOrders.count,
      recentOrders
    });
  } catch (error) {
    console.error('Error fetching sync status:', error);
    return NextResponse.json(
      { error: "Failed to fetch sync status" },
      { status: 500 }
    );
  }
}
