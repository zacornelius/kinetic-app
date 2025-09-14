import db from '@/lib/database';

/**
 * Normalizes Shopify line items JSON to the simplified format used in all_orders
 * Applies the same business logic as the normalization script:
 * - "X Pallet" orders become 50 bags of "X" with price/50
 * - "Build a Pallet" orders remain as-is
 * - Regular orders remain unchanged
 */
function normalizeShopifyLineItems(lineItems: string): string {
  try {
    const items = JSON.parse(lineItems);
    
    if (!Array.isArray(items)) {
      return lineItems; // Return original if not an array
    }
    
    const normalizedItems = items.map(item => {
      const title = item.title || item.name || 'Unknown Product';
      let quantity = parseInt(item.quantity) || 0;
      let price = parseFloat(item.price) || 0;
      let normalizedTitle = title;
      
      // Handle pallet orders - convert to individual bags
      if (title.includes(' Pallet') && !title.includes('Build a Pallet')) {
        // Extract the bag type from pallet name (e.g., "Active 26K Pallet" -> "Active 26K")
        normalizedTitle = title.replace(' Pallet', '');
        quantity = quantity * 50; // 1 pallet = 50 bags
        price = price / 50; // Price per bag
      }
      
      // For "Build a Pallet" orders, we'll keep them as-is for now
      // and handle the SKU matching logic in the API layer
      
      return {
        title: normalizedTitle,
        quantity: quantity,
        price: price,
        total: quantity * price,
        sku: item.sku || null,
        vendor: item.vendor || 'Kinetic Dog Food'
      };
    });
    
    return JSON.stringify(normalizedItems);
  } catch (error) {
    console.error('Error normalizing line items:', error);
    return lineItems; // Return original if parsing fails
  }
}

/**
 * Syncs a Shopify order to the all_orders table with normalized line items
 * This function should be called whenever a new order is added to shopify_orders
 */
export async function syncShopifyOrderToAllOrders(shopifyOrder: {
  id: string;
  orderNumber: string;
  customerEmail: string;
  customerName: string;
  totalAmount: number;
  currency: string;
  status: string;
  shippingAddress?: string;
  notes?: string;
  createdAt: string;
  lineItems: string;
}): Promise<void> {
  try {
    // Normalize the line items
    const normalizedLineItems = normalizeShopifyLineItems(shopifyOrder.lineItems);
    
    // Insert or update in all_orders table
    await db.query(`
      INSERT INTO all_orders (
        id,
        ordernumber,
        customeremail,
        customername,
        totalamount,
        currency,
        status,
        shippingaddress,
        notes,
        source,
        createdat,
        lineitems
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        ordernumber = EXCLUDED.ordernumber,
        customeremail = EXCLUDED.customeremail,
        customername = EXCLUDED.customername,
        totalamount = EXCLUDED.totalamount,
        currency = EXCLUDED.currency,
        status = EXCLUDED.status,
        shippingaddress = EXCLUDED.shippingaddress,
        notes = EXCLUDED.notes,
        source = EXCLUDED.source,
        createdat = EXCLUDED.createdat,
        lineitems = EXCLUDED.lineitems
    `, [
      shopifyOrder.id,
      shopifyOrder.orderNumber,
      shopifyOrder.customerEmail,
      shopifyOrder.customerName,
      shopifyOrder.totalAmount,
      shopifyOrder.currency,
      shopifyOrder.status,
      shopifyOrder.shippingAddress || null,
      shopifyOrder.notes || null,
      'shopify',
      shopifyOrder.createdAt,
      normalizedLineItems
    ]);
    
    console.log(`✅ Synced Shopify order ${shopifyOrder.orderNumber} to all_orders with normalized line items`);
  } catch (error) {
    console.error(`❌ Error syncing Shopify order ${shopifyOrder.orderNumber}:`, error);
    throw error;
  }
}

/**
 * Syncs multiple Shopify orders to all_orders table
 * Useful for batch processing
 */
export async function syncMultipleShopifyOrdersToAllOrders(orders: any[]): Promise<void> {
  console.log(`🔄 Syncing ${orders.length} Shopify orders to all_orders...`);
  
  for (const order of orders) {
    await syncShopifyOrderToAllOrders(order);
  }
  
  console.log(`✅ Successfully synced ${orders.length} orders`);
}

/**
 * Syncs all pending Shopify orders to all_orders
 * Finds orders in shopify_orders that don't exist in all_orders yet
 */
export async function syncPendingShopifyOrders(): Promise<{ synced: number; errors: number }> {
  try {
    console.log('🔄 Finding pending Shopify orders to sync...');
    
    // Find shopify orders that don't exist in all_orders yet
    const pendingOrders = await db.query(`
      SELECT 
        id, orderNumber, customerEmail, customerName,
        totalAmount, currency, status, shippingAddress,
        notes, createdAt, lineItems
      FROM shopify_orders 
      WHERE id NOT IN (SELECT id FROM all_orders WHERE source = 'shopify')
    `);
    
    console.log(`Found ${pendingOrders.length} pending orders to sync`);
    
    let synced = 0;
    let errors = 0;
    
    for (const order of pendingOrders) {
      try {
        await syncShopifyOrderToAllOrders(order);
        synced++;
      } catch (error) {
        console.error(`Error syncing order ${order.orderNumber}:`, error);
        errors++;
      }
    }
    
    console.log(`✅ Sync complete: ${synced} synced, ${errors} errors`);
    return { synced, errors };
  } catch (error) {
    console.error('Error in syncPendingShopifyOrders:', error);
    throw error;
  }
}

