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
  lineItems?: string; // JSON string of line items
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
  return {
    id: generateId(),
    email: shopifyOrder.email.toLowerCase(),
    firstName: shopifyOrder.customer?.first_name,
    lastName: shopifyOrder.customer?.last_name,
    phone: shopifyOrder.customer?.phone,
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

  // Convert line items to JSON
  const lineItemsJson = JSON.stringify(shopifyOrder.line_items.map(item => ({
    id: item.id,
    title: item.title,
    name: item.name,
    quantity: item.quantity,
    price: parseFloat(item.price),
    totalPrice: parseFloat(item.price) * item.quantity - parseFloat(item.total_discount),
    sku: item.sku,
    vendor: item.vendor,
    productType: item.product_type,
    variantId: item.variant_id,
    productId: item.product_id
  })));

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
    lineItems: lineItemsJson,
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

async function fetchAllShopifyOrders(shop: string, accessToken: string): Promise<ShopifyOrder[]> {
  const orders: ShopifyOrder[] = [];
  let pageInfo = '';
  let hasNextPage = true;
  let pageCount = 0;
  const seenPageInfos = new Set<string>();

  // Helper function to add delay between requests
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  console.log('Starting to fetch ALL orders from Shopify...');
  console.log('Shop:', shop);
  console.log('Access token:', accessToken.substring(0, 10) + '...');

  while (hasNextPage) {
    pageCount++;
    const cleanShop = shop.replace('.myshopify.com', '');
    let url: string;
    
    if (pageInfo) {
      url = `https://${cleanShop}.myshopify.com/admin/api/2023-10/orders.json?limit=250&page_info=${pageInfo}`;
    } else {
      // Start from the beginning (oldest orders first)
      url = `https://${cleanShop}.myshopify.com/admin/api/2023-10/orders.json?limit=250&status=any&order=created_at+asc`;
    }
    
    console.log(`Page ${pageCount}: Making request to:`, url);
    console.log(`Current total orders: ${orders.length}`);
    
    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Error response body:', errorText);
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      // Handle rate limiting with retry
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 2000;
        console.log(`Rate limited. Waiting ${waitTime}ms before retry...`);
        await delay(waitTime);
        continue;
      }
      
      throw new Error(`Shopify API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    orders.push(...data.orders);
    console.log(`Page ${pageCount}: Fetched ${data.orders.length} orders. Total so far: ${orders.length}`);

    // Check for pagination
    const linkHeader = response.headers.get('Link');
    console.log(`Page ${pageCount}: Link header:`, linkHeader);
    
    if (linkHeader && linkHeader.includes('rel="next"')) {
      const nextMatch = linkHeader.match(/page_info=([^&>]+)/);
      if (nextMatch) {
        const newPageInfo = nextMatch[1];
        console.log(`Page ${pageCount}: Next page_info:`, newPageInfo);
        
        if (seenPageInfos.has(newPageInfo)) {
          console.log('Detected pagination loop, stopping sync');
          hasNextPage = false;
        } else {
          seenPageInfos.add(newPageInfo);
          pageInfo = newPageInfo;
          console.log(`Page ${pageCount}: Continuing to next page...`);
          await delay(200); // 200ms delay between requests
        }
      } else {
        console.log(`Page ${pageCount}: No page_info found in Link header`);
        hasNextPage = false;
      }
    } else {
      console.log(`Page ${pageCount}: No next page found in Link header`);
      hasNextPage = false;
    }

    // No safety limit - get ALL orders
    console.log(`Completed page ${pageCount}, total orders: ${orders.length}`);
  }

  console.log(`Finished fetching ALL orders. Total: ${orders.length} orders from ${pageCount} pages`);
  return orders;
}

export async function POST(request: Request) {
  try {
    const { shop, accessToken } = await request.json();

    if (!shop || !accessToken) {
      return NextResponse.json(
        { error: "Shop and access token are required" },
        { status: 400 }
      );
    }

    console.log('Starting FULL sync of ALL orders from Shopify...');

    // Fetch ALL orders from Shopify
    const shopifyOrders = await fetchAllShopifyOrders(shop, accessToken);
    
    console.log(`Processing ${shopifyOrders.length} orders...`);
    
    // Process orders with full data structure
    const processedData = await processShopifyOrders(shopifyOrders);

    console.log('Inserting data into database...');

    // Use transaction for better performance
    const insertMany = db.transaction(() => {
      let insertedCount = 0;
      let updatedCount = 0;

      // Insert customers into shopify_customers table
      const customerStmt = db.prepare(`
        INSERT OR IGNORE INTO shopify_customers (
          id, email, firstName, lastName, phone, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const customer of processedData.customers) {
        const existing = db.prepare('SELECT id FROM shopify_customers WHERE email = ?').get(customer.email);
        if (!existing) {
          customerStmt.run(
            customer.id, customer.email, customer.firstName, customer.lastName,
            customer.phone, customer.createdAt, customer.updatedAt
          );
          insertedCount++;
        }
      }

      // Insert products
      const productStmt = db.prepare(`
        INSERT OR IGNORE INTO products (
          id, shopifyProductId, sku, title, vendor, productType, price, cost, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const product of processedData.products) {
        const existing = db.prepare('SELECT id FROM products WHERE sku = ? OR shopifyProductId = ?').get(product.sku, product.shopifyProductId);
        if (!existing) {
          productStmt.run(
            product.id, product.shopifyProductId, product.sku, product.title,
            product.vendor, product.productType, product.price, product.cost,
            product.createdAt, product.updatedAt
          );
          insertedCount++;
        }
      }

      // Insert orders into shopify_orders table
      const orderStmt = db.prepare(`
        INSERT OR IGNORE INTO shopify_orders (
          id, createdAt, orderNumber, shopifyOrderId, customerEmail, customerName, 
          totalAmount, currency, status, shippingAddress, notes, ownerEmail, lineItems
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const order of processedData.orders) {
        const existing = db.prepare('SELECT id FROM shopify_orders WHERE orderNumber = ?').get(order.orderNumber);
        
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

      // Line items are now stored as JSON in the orders table, no separate processing needed

      return { insertedCount, updatedCount };
    });

    const { insertedCount, updatedCount } = insertMany();

    console.log('Sync completed successfully!');

    return NextResponse.json({
      success: true,
      message: `Successfully synced ALL ${processedData.orders.length} orders (with line items) from Shopify`,
      stats: {
        orders: processedData.orders.length,
        customers: processedData.customers.length,
        products: processedData.products.length,
        inserted: insertedCount,
        updated: updatedCount
      }
    });

  } catch (error) {
    console.error('Shopify full sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync all orders" },
      { status: 500 }
    );
  }
}
