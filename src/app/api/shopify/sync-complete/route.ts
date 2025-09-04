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

async function processShopifyOrders(shopifyOrders: ShopifyOrder[]) {
  const customers: Customer[] = [];
  const products: Product[] = [];
  const orders: Order[] = [];
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
    }
  }

  return { customers, products, orders };
}

async function fetchAllShopifyOrdersComplete(shop: string, accessToken: string): Promise<ShopifyOrder[]> {
  const orders: ShopifyOrder[] = [];
  let sinceId = 0;
  let hasMoreOrders = true;
  let pageCount = 0;
  const limit = 250;

  // Helper function to add delay between requests
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  console.log('Starting COMPLETE sync of ALL orders from Shopify using since_id method...');
  console.log('Shop:', shop);
  console.log('Access token:', accessToken.substring(0, 10) + '...');

  while (hasMoreOrders) {
    pageCount++;
    const cleanShop = shop.replace('.myshopify.com', '');
    const url = `https://${cleanShop}.myshopify.com/admin/api/2023-10/orders.json?limit=${limit}&status=any&since_id=${sinceId}`;
    
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
    const fetchedOrders = data.orders;
    
    if (fetchedOrders.length === 0) {
      console.log(`Page ${pageCount}: No more orders found, stopping sync`);
      hasMoreOrders = false;
    } else {
      orders.push(...fetchedOrders);
      // Update sinceId to the last order's ID
      sinceId = Math.max(...fetchedOrders.map((order: ShopifyOrder) => order.id));
      console.log(`Page ${pageCount}: Fetched ${fetchedOrders.length} orders. Total so far: ${orders.length}. Next sinceId: ${sinceId}`);
      
      // If we got fewer orders than the limit, we've reached the end
      if (fetchedOrders.length < limit) {
        console.log(`Page ${pageCount}: Got fewer orders than limit (${fetchedOrders.length} < ${limit}), stopping sync`);
        hasMoreOrders = false;
      }
      
      // Add delay between requests
      await delay(200);
    }
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

    console.log('Starting COMPLETE sync of ALL orders from Shopify...');

    // Fetch ALL orders from Shopify using since_id method
    const shopifyOrders = await fetchAllShopifyOrdersComplete(shop, accessToken);
    
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
        INSERT OR REPLACE INTO shopify_orders (
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

      return { insertedCount, updatedCount };
    });

    const { insertedCount, updatedCount } = insertMany();

    console.log('Complete sync finished successfully!');

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
    console.error('Shopify complete sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync all orders" },
      { status: 500 }
    );
  }
}
