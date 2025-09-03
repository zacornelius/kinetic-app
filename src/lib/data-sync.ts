import db from './database';

// Utility functions for synchronizing data between source and unified tables

export interface UnifiedCustomer {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  companyName?: string;
  billingAddress?: string;
  shippingAddress?: string;
  source: 'shopify' | 'quickbooks' | 'manual';
  sourceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UnifiedOrder {
  id: string;
  createdAt: string;
  orderNumber: string;
  customerEmail: string;
  customerName?: string;
  totalAmount?: number;
  currency: string;
  status: string;
  shippingAddress?: string;
  billingAddress?: string;
  trackingNumber?: string;
  dueDate?: string;
  notes?: string;
  ownerEmail?: string;
  source: 'shopify' | 'quickbooks' | 'manual';
  sourceId: string;
}

/**
 * Sync Shopify customers to unified customers table
 */
export function syncShopifyCustomersToUnified(): { synced: number; errors: number } {
  let synced = 0;
  let errors = 0;

  try {
    const shopifyCustomers = db.prepare(`
      SELECT id, email, firstName, lastName, phone, createdAt, updatedAt 
      FROM shopify_customers
    `).all();

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO all_customers (
        id, email, firstName, lastName, phone, companyName, billingAddress, 
        shippingAddress, source, sourceId, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'shopify', ?, ?, ?)
    `);
    
    const updateStmt = db.prepare(`
      UPDATE all_customers SET 
        firstName = ?, lastName = ?, phone = ?, updatedAt = ?
      WHERE email = ? AND source = 'shopify'
    `);

    for (const customer of shopifyCustomers) {
      try {
        // Try to insert first (will ignore if exists)
        const result = insertStmt.run(
          customer.id,
          customer.email,
          customer.firstName,
          customer.lastName,
          customer.phone,
          null, // companyName
          null, // billingAddress
          null, // shippingAddress
          customer.id, // sourceId
          customer.createdAt,
          customer.updatedAt
        );
        
        // If no rows were inserted, update existing record
        if (result.changes === 0) {
          updateStmt.run(
            customer.firstName,
            customer.lastName,
            customer.phone,
            customer.updatedAt,
            customer.email
          );
        }
        
        synced++;
      } catch (error) {
        console.error('Error syncing Shopify customer:', customer.id, error);
        errors++;
      }
    }
  } catch (error) {
    console.error('Error in syncShopifyCustomersToUnified:', error);
    errors++;
  }

  return { synced, errors };
}

/**
 * Sync QuickBooks customers to unified customers table
 */
export function syncQuickBooksCustomersToUnified(): { synced: number; errors: number } {
  let synced = 0;
  let errors = 0;

  try {
    const quickbooksCustomers = db.prepare(`
      SELECT id, quickbooksId, email, firstName, lastName, phone, companyName, 
             billingAddress, shippingAddress, createdAt, updatedAt 
      FROM quickbooks_customers
    `).all();

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO all_customers (
        id, email, firstName, lastName, phone, companyName, billingAddress, 
        shippingAddress, source, sourceId, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'quickbooks', ?, ?, ?)
    `);
    
    const updateStmt = db.prepare(`
      UPDATE all_customers SET 
        firstName = ?, lastName = ?, phone = ?, companyName = ?, 
        billingAddress = ?, shippingAddress = ?, updatedAt = ?
      WHERE email = ? AND source = 'quickbooks'
    `);

    for (const customer of quickbooksCustomers) {
      try {
        // Try to insert first (will ignore if exists)
        const result = insertStmt.run(
          customer.id,
          customer.email,
          customer.firstName,
          customer.lastName,
          customer.phone,
          customer.companyName,
          customer.billingAddress,
          customer.shippingAddress,
          customer.quickbooksId, // sourceId
          customer.createdAt,
          customer.updatedAt
        );
        
        // If no rows were inserted, update existing record
        if (result.changes === 0) {
          updateStmt.run(
            customer.firstName,
            customer.lastName,
            customer.phone,
            customer.companyName,
            customer.billingAddress,
            customer.shippingAddress,
            customer.updatedAt,
            customer.email
          );
        }
        
        synced++;
      } catch (error) {
        console.error('Error syncing QuickBooks customer:', customer.id, error);
        errors++;
      }
    }
  } catch (error) {
    console.error('Error in syncQuickBooksCustomersToUnified:', error);
    errors++;
  }

  return { synced, errors };
}

/**
 * Sync Shopify orders to unified orders table
 */
export function syncShopifyOrdersToUnified(): { synced: number; errors: number } {
  let synced = 0;
  let errors = 0;

  try {
    const shopifyOrders = db.prepare(`
      SELECT id, createdAt, orderNumber, shopifyOrderId, customerEmail, customerName, 
             totalAmount, currency, status, shippingAddress, trackingNumber, notes, ownerEmail, lineItems
      FROM shopify_orders
    `).all();

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO all_orders (
        id, createdAt, orderNumber, customerEmail, customerName, totalAmount, currency, 
        status, shippingAddress, billingAddress, trackingNumber, dueDate, notes, 
        ownerEmail, source, sourceId, lineItems
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'shopify', ?, ?)
    `);
    
    const updateStmt = db.prepare(`
      UPDATE all_orders SET 
        customerName = ?, totalAmount = ?, status = ?, shippingAddress = ?, 
        trackingNumber = ?, notes = ?, ownerEmail = ?, lineItems = ?
      WHERE orderNumber = ? AND source = 'shopify'
    `);

    for (const order of shopifyOrders) {
      try {
        // Try to insert first (will ignore if exists)
        const result = insertStmt.run(
          order.id,
          order.createdAt,
          order.orderNumber,
          order.customerEmail,
          order.customerName,
          order.totalAmount,
          order.currency,
          order.status,
          order.shippingAddress,
          null, // billingAddress
          order.trackingNumber,
          null, // dueDate
          order.notes,
          order.ownerEmail,
          order.shopifyOrderId || order.id, // sourceId
          order.lineItems
        );
        
        // If no rows were inserted, update existing record
        if (result.changes === 0) {
          updateStmt.run(
            order.customerName,
            order.totalAmount,
            order.status,
            order.shippingAddress,
            order.trackingNumber,
            order.notes,
            order.ownerEmail,
            order.lineItems,
            order.orderNumber
          );
        }
        
        synced++;
      } catch (error) {
        console.error('Error syncing Shopify order:', order.id, error);
        errors++;
      }
    }
  } catch (error) {
    console.error('Error in syncShopifyOrdersToUnified:', error);
    errors++;
  }

  return { synced, errors };
}

/**
 * Sync QuickBooks orders to unified orders table
 */
export function syncQuickBooksOrdersToUnified(): { synced: number; errors: number } {
  let synced = 0;
  let errors = 0;

  try {
    const quickbooksOrders = db.prepare(`
      SELECT id, createdAt, orderNumber, quickbooksInvoiceId, customerEmail, customerName, 
             totalAmount, currency, status, shippingAddress, billingAddress, dueDate, notes, ownerEmail
      FROM quickbooks_orders
    `).all();

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO all_orders (
        id, createdAt, orderNumber, customerEmail, customerName, totalAmount, currency, 
        status, shippingAddress, billingAddress, trackingNumber, dueDate, notes, 
        ownerEmail, source, sourceId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'quickbooks', ?)
    `);
    
    const updateStmt = db.prepare(`
      UPDATE all_orders SET 
        customerName = ?, totalAmount = ?, status = ?, shippingAddress = ?, 
        billingAddress = ?, dueDate = ?, notes = ?, ownerEmail = ?
      WHERE orderNumber = ? AND source = 'quickbooks'
    `);

    for (const order of quickbooksOrders) {
      try {
        // Try to insert first (will ignore if exists)
        const result = insertStmt.run(
          order.id,
          order.createdAt,
          order.orderNumber,
          order.customerEmail,
          order.customerName,
          order.totalAmount,
          order.currency,
          order.status,
          order.shippingAddress,
          order.billingAddress,
          null, // trackingNumber
          order.dueDate,
          order.notes,
          order.ownerEmail,
          order.quickbooksInvoiceId // sourceId
        );
        
        // If no rows were inserted, update existing record
        if (result.changes === 0) {
          updateStmt.run(
            order.customerName,
            order.totalAmount,
            order.status,
            order.shippingAddress,
            order.billingAddress,
            order.dueDate,
            order.notes,
            order.ownerEmail,
            order.orderNumber
          );
        }
        
        synced++;
      } catch (error) {
        console.error('Error syncing QuickBooks order:', order.id, error);
        errors++;
      }
    }
  } catch (error) {
    console.error('Error in syncQuickBooksOrdersToUnified:', error);
    errors++;
  }

  return { synced, errors };
}

/**
 * Sync all data from source tables to unified tables
 */
export function syncAllDataToUnified(): {
  customers: { shopify: { synced: number; errors: number }; quickbooks: { synced: number; errors: number } };
  orders: { shopify: { synced: number; errors: number }; quickbooks: { synced: number; errors: number } };
} {
  console.log('Starting data synchronization...');
  
  const shopifyCustomers = syncShopifyCustomersToUnified();
  const quickbooksCustomers = syncQuickBooksCustomersToUnified();
  const shopifyOrders = syncShopifyOrdersToUnified();
  const quickbooksOrders = syncQuickBooksOrdersToUnified();

  console.log('Data synchronization completed:', {
    customers: { shopify: shopifyCustomers, quickbooks: quickbooksCustomers },
    orders: { shopify: shopifyOrders, quickbooks: quickbooksOrders }
  });

  return {
    customers: { shopify: shopifyCustomers, quickbooks: quickbooksCustomers },
    orders: { shopify: shopifyOrders, quickbooks: quickbooksOrders }
  };
}

/**
 * Get unified customers with optional filtering
 */
export function getUnifiedCustomers(filters?: {
  source?: 'shopify' | 'quickbooks' | 'manual';
  email?: string;
}): UnifiedCustomer[] {
  let query = 'SELECT * FROM all_customers WHERE 1=1';
  const params: any[] = [];

  if (filters?.source) {
    query += ' AND source = ?';
    params.push(filters.source);
  }

  if (filters?.email) {
    query += ' AND email LIKE ?';
    params.push(`%${filters.email}%`);
  }

  query += ' ORDER BY createdAt DESC';

  return db.prepare(query).all(...params) as UnifiedCustomer[];
}

/**
 * Get unified orders with optional filtering
 */
export function getUnifiedOrders(filters?: {
  source?: 'shopify' | 'quickbooks' | 'manual';
  status?: string;
  customerEmail?: string;
}): UnifiedOrder[] {
  let query = 'SELECT * FROM all_orders WHERE 1=1';
  const params: any[] = [];

  if (filters?.source) {
    query += ' AND source = ?';
    params.push(filters.source);
  }

  if (filters?.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }

  if (filters?.customerEmail) {
    query += ' AND customerEmail LIKE ?';
    params.push(`%${filters.customerEmail}%`);
  }

  query += ' ORDER BY createdAt DESC';

  return db.prepare(query).all(...params) as UnifiedOrder[];
}
