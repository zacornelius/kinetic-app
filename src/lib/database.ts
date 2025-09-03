import Database from 'better-sqlite3';
import { join } from 'path';

// Use persistent storage for Heroku (ephemeral filesystem)
const dbPath = process.env.NODE_ENV === 'production' 
  ? '/tmp/kinetic.db' 
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

  // Unified Customers table (clean, deduplicated data)
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
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
      ownerEmail TEXT
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
      ownerEmail TEXT
    )
  `);

  // Unified Orders table (clean, deduplicated data)
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
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
      sourceId TEXT NOT NULL
    )
  `);

  // Order line items table (updated to work with unified orders)
  db.exec(`
    CREATE TABLE IF NOT EXISTS orderLineItems (
      id TEXT PRIMARY KEY,
      orderId TEXT NOT NULL,
      productId TEXT,
      shopifyVariantId TEXT,
      quickbooksItemId TEXT,
      sku TEXT,
      title TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      totalPrice REAL NOT NULL,
      vendor TEXT,
      description TEXT,
      FOREIGN KEY (orderId) REFERENCES orders(id),
      FOREIGN KEY (productId) REFERENCES products(id)
    )
  `);

  // Migration: Move existing data to new table structure
  try {
    // Check if old tables exist and migrate data
    const oldCustomersExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='customers'").get();
    const oldOrdersExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='orders'").get();
    
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
    // Add companyName column to customers table if it doesn't exist
    db.exec(`ALTER TABLE customers ADD COLUMN companyName TEXT`);
  } catch (error) {
    // Column already exists, ignore error
  }

  try {
    // Add billingAddress column to customers table if it doesn't exist
    db.exec(`ALTER TABLE customers ADD COLUMN billingAddress TEXT`);
  } catch (error) {
    // Column already exists, ignore error
  }

  try {
    // Add shippingAddress column to customers table if it doesn't exist
    db.exec(`ALTER TABLE customers ADD COLUMN shippingAddress TEXT`);
  } catch (error) {
    // Column already exists, ignore error
  }

  try {
    // Add source column to customers table if it doesn't exist
    db.exec(`ALTER TABLE customers ADD COLUMN source TEXT DEFAULT 'manual'`);
  } catch (error) {
    // Column already exists, ignore error
  }

  try {
    // Add sourceId column to customers table if it doesn't exist
    db.exec(`ALTER TABLE customers ADD COLUMN sourceId TEXT`);
  } catch (error) {
    // Column already exists, ignore error
  }

  try {
    // Add billingAddress column to orders table if it doesn't exist
    db.exec(`ALTER TABLE orders ADD COLUMN billingAddress TEXT`);
  } catch (error) {
    // Column already exists, ignore error
  }

  try {
    // Add dueDate column to orders table if it doesn't exist
    db.exec(`ALTER TABLE orders ADD COLUMN dueDate TEXT`);
  } catch (error) {
    // Column already exists, ignore error
  }

  try {
    // Add source column to orders table if it doesn't exist
    db.exec(`ALTER TABLE orders ADD COLUMN source TEXT DEFAULT 'manual'`);
  } catch (error) {
    // Column already exists, ignore error
  }

  try {
    // Add sourceId column to orders table if it doesn't exist
    db.exec(`ALTER TABLE orders ADD COLUMN sourceId TEXT`);
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
      
      -- Unified tables indexes
      CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
      CREATE INDEX IF NOT EXISTS idx_customers_source ON customers(source);
      CREATE INDEX IF NOT EXISTS idx_customers_source_id ON customers(sourceId);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_owner ON orders(ownerEmail);
      CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(orderNumber);
      CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);
      CREATE INDEX IF NOT EXISTS idx_orders_source_id ON orders(sourceId);
      
      -- Products and line items indexes
      CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
      CREATE INDEX IF NOT EXISTS idx_products_shopify_id ON products(shopifyProductId);
      CREATE INDEX IF NOT EXISTS idx_orderLineItems_order ON orderLineItems(orderId);
      CREATE INDEX IF NOT EXISTS idx_orderLineItems_product ON orderLineItems(productId);
      CREATE INDEX IF NOT EXISTS idx_orderLineItems_sku ON orderLineItems(sku);
    `);
  } catch (error) {
    // Some indexes might fail if tables don't exist yet, ignore
  }


}

// Initialize database on import
initializeDatabase();

export default db;
