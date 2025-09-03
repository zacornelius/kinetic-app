import Database from 'better-sqlite3';
import { join } from 'path';

// Use persistent storage for Heroku (ephemeral filesystem)
const dbPath = process.env.NODE_ENV === 'production' 
  ? join(process.cwd(), 'kinetic.db')  // Heroku has persistent filesystem
  : join(process.cwd(), 'kinetic.db');

// Create database connection with WAL mode for better concurrency
const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = 1000');
db.pragma('temp_store = memory');

// Disable foreign key constraints for now to avoid issues during sync
db.pragma('foreign_keys = OFF');

// Create tables if they don't exist
function initializeDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `);

  // Inquiries table
  db.exec(`
    CREATE TABLE IF NOT EXISTS inquiries (
      id TEXT PRIMARY KEY,
      createdAt TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('bulk', 'issues', 'questions')),
      subject TEXT NOT NULL,
      customerEmail TEXT NOT NULL,
      ownerEmail TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'closed', 'not_relevant'))
    )
  `);

  // Shopify Customers table (renamed from customers)
  db.exec(`
    CREATE TABLE IF NOT EXISTS shopify_customers (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      firstName TEXT,
      lastName TEXT,
      phone TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  // QuickBooks Customers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS quickbooks_customers (
      id TEXT PRIMARY KEY,
      quickbooksId TEXT UNIQUE NOT NULL,
      email TEXT,
      firstName TEXT,
      lastName TEXT,
      phone TEXT,
      companyName TEXT,
      billingAddress TEXT,
      shippingAddress TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  // All Customers table (clean, deduplicated data from all sources)
  db.exec(`
    CREATE TABLE IF NOT EXISTS all_customers (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      firstName TEXT,
      lastName TEXT,
      phone TEXT,
      companyName TEXT,
      billingAddress TEXT,
      shippingAddress TEXT,
      source TEXT NOT NULL CHECK (source IN ('shopify', 'quickbooks', 'manual')),
      sourceId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  // Products table
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      shopifyProductId TEXT UNIQUE,
      sku TEXT UNIQUE,
      title TEXT NOT NULL,
      vendor TEXT,
      productType TEXT,
      price REAL,
      cost REAL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  // Shopify Orders table (renamed from orders)
  db.exec(`
    CREATE TABLE IF NOT EXISTS shopify_orders (
      id TEXT PRIMARY KEY,
      createdAt TEXT NOT NULL,
      orderNumber TEXT UNIQUE NOT NULL,
      shopifyOrderId TEXT,
      customerEmail TEXT NOT NULL,
      customerName TEXT,
      totalAmount REAL,
      currency TEXT DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
      shippingAddress TEXT,
      trackingNumber TEXT,
      notes TEXT,
      ownerEmail TEXT,
      lineItems TEXT
    )
  `);

  // QuickBooks Orders table
  db.exec(`
    CREATE TABLE IF NOT EXISTS quickbooks_orders (
      id TEXT PRIMARY KEY,
      createdAt TEXT NOT NULL,
      orderNumber TEXT UNIQUE NOT NULL,
      quickbooksInvoiceId TEXT UNIQUE NOT NULL,
      customerEmail TEXT,
      customerName TEXT,
      totalAmount REAL,
      currency TEXT DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'paid', 'overdue')),
      shippingAddress TEXT,
      billingAddress TEXT,
      dueDate TEXT,
      notes TEXT,
      ownerEmail TEXT,
      lineItems TEXT
    )
  `);

  // All Orders table (clean, deduplicated data from all sources)
  db.exec(`
    CREATE TABLE IF NOT EXISTS all_orders (
      id TEXT PRIMARY KEY,
      createdAt TEXT NOT NULL,
      orderNumber TEXT UNIQUE NOT NULL,
      customerEmail TEXT NOT NULL,
      customerName TEXT,
      totalAmount REAL,
      currency TEXT DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'paid', 'overdue')),
      shippingAddress TEXT,
      billingAddress TEXT,
      trackingNumber TEXT,
      dueDate TEXT,
      notes TEXT,
      ownerEmail TEXT,
      source TEXT NOT NULL CHECK (source IN ('shopify', 'quickbooks', 'manual')),
      sourceId TEXT NOT NULL,
      lineItems TEXT
    )
  `);



  // Migration: Move existing data to new table structure
  try {
    // Check if old tables exist and migrate data
    const oldCustomersExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='customers'").get();
    const oldOrdersExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='orders'").get();
    const oldLineItemsExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='orderLineItems'").get();
    
    if (oldCustomersExists && !db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='shopify_customers'").get()) {
      // Migrate customers to shopify_customers
      db.exec(`
        INSERT INTO shopify_customers (id, email, firstName, lastName, phone, createdAt, updatedAt)
        SELECT id, email, firstName, lastName, phone, createdAt, updatedAt FROM customers
      `);
      console.log('Migrated customers to shopify_customers');
    }
    
    if (oldOrdersExists && !db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='shopify_orders'").get()) {
      // Migrate orders to shopify_orders
      db.exec(`
        INSERT INTO shopify_orders (id, createdAt, orderNumber, customerEmail, customerName, totalAmount, currency, status, shippingAddress, trackingNumber, notes, ownerEmail)
        SELECT id, createdAt, orderNumber, customerEmail, customerName, totalAmount, currency, status, shippingAddress, trackingNumber, notes, ownerEmail FROM orders
      `);
      console.log('Migrated orders to shopify_orders');
    }
    

  } catch (error) {
    console.log('Migration completed or not needed:', error.message);
  }

  // Add missing columns to existing tables (migration)
  try {
    // Add companyName column to all_customers table if it doesn't exist
    db.exec(`ALTER TABLE all_customers ADD COLUMN companyName TEXT`);
  } catch (error) {
    // Column already exists, ignore error
  }

  try {
    // Add billingAddress column to all_customers table if it doesn't exist
    db.exec(`ALTER TABLE all_customers ADD COLUMN billingAddress TEXT`);
  } catch (error) {
    // Column already exists, ignore error
  }

  try {
    // Add shippingAddress column to all_customers table if it doesn't exist
    db.exec(`ALTER TABLE all_customers ADD COLUMN shippingAddress TEXT`);
  } catch (error) {
    // Column already exists, ignore error
  }

  try {
    // Add source column to all_customers table if it doesn't exist
    db.exec(`ALTER TABLE all_customers ADD COLUMN source TEXT DEFAULT 'manual'`);
  } catch (error) {
    // Column already exists, ignore error
  }

  try {
    // Add sourceId column to all_customers table if it doesn't exist
    db.exec(`ALTER TABLE all_customers ADD COLUMN sourceId TEXT`);
  } catch (error) {
    // Column already exists, ignore error
  }

  try {
    // Add billingAddress column to all_orders table if it doesn't exist
    db.exec(`ALTER TABLE all_orders ADD COLUMN billingAddress TEXT`);
  } catch (error) {
    // Column already exists, ignore error
  }

  try {
    // Add dueDate column to all_orders table if it doesn't exist
    db.exec(`ALTER TABLE all_orders ADD COLUMN dueDate TEXT`);
  } catch (error) {
    // Column already exists, ignore error
  }

  try {
    // Add source column to all_orders table if it doesn't exist
    db.exec(`ALTER TABLE all_orders ADD COLUMN source TEXT DEFAULT 'manual'`);
  } catch (error) {
    // Column already exists, ignore error
  }

  try {
    // Add sourceId column to all_orders table if it doesn't exist
    db.exec(`ALTER TABLE all_orders ADD COLUMN sourceId TEXT`);
  } catch (error) {
    // Column already exists, ignore error
  }

  // Create indexes for better performance
  try {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_inquiries_category ON inquiries(category);
      CREATE INDEX IF NOT EXISTS idx_inquiries_owner ON inquiries(ownerEmail);
      CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);
  } catch (error) {
    // Some indexes might fail if tables don't exist yet, ignore
  }

  // Create indexes for new tables (with error handling)
  try {
    db.exec(`
      -- Shopify tables indexes
      CREATE INDEX IF NOT EXISTS idx_shopify_customers_email ON shopify_customers(email);
      CREATE INDEX IF NOT EXISTS idx_shopify_orders_status ON shopify_orders(status);
      CREATE INDEX IF NOT EXISTS idx_shopify_orders_owner ON shopify_orders(ownerEmail);
      CREATE INDEX IF NOT EXISTS idx_shopify_orders_number ON shopify_orders(orderNumber);
      CREATE INDEX IF NOT EXISTS idx_shopify_orders_shopify_id ON shopify_orders(shopifyOrderId);
      
      -- QuickBooks tables indexes
      CREATE INDEX IF NOT EXISTS idx_quickbooks_customers_email ON quickbooks_customers(email);
      CREATE INDEX IF NOT EXISTS idx_quickbooks_customers_qb_id ON quickbooks_customers(quickbooksId);
      CREATE INDEX IF NOT EXISTS idx_quickbooks_orders_status ON quickbooks_orders(status);
      CREATE INDEX IF NOT EXISTS idx_quickbooks_orders_owner ON quickbooks_orders(ownerEmail);
      CREATE INDEX IF NOT EXISTS idx_quickbooks_orders_number ON quickbooks_orders(orderNumber);
      CREATE INDEX IF NOT EXISTS idx_quickbooks_orders_qb_id ON quickbooks_orders(quickbooksInvoiceId);
      
      -- All tables indexes
      CREATE INDEX IF NOT EXISTS idx_all_customers_email ON all_customers(email);
      CREATE INDEX IF NOT EXISTS idx_all_customers_source ON all_customers(source);
      CREATE INDEX IF NOT EXISTS idx_all_customers_source_id ON all_customers(sourceId);
      CREATE INDEX IF NOT EXISTS idx_all_orders_status ON all_orders(status);
      CREATE INDEX IF NOT EXISTS idx_all_orders_owner ON all_orders(ownerEmail);
      CREATE INDEX IF NOT EXISTS idx_all_orders_number ON all_orders(orderNumber);
      CREATE INDEX IF NOT EXISTS idx_all_orders_source ON all_orders(source);
      CREATE INDEX IF NOT EXISTS idx_all_orders_source_id ON all_orders(sourceId);
      
      -- Products indexes
      CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
      CREATE INDEX IF NOT EXISTS idx_products_shopify_id ON products(shopifyProductId);
    `);
  } catch (error) {
    // Some indexes might fail if tables don't exist yet, ignore
  }


}

// Initialize database on import
initializeDatabase();

export default db;
