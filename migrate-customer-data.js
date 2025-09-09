const Database = require('better-sqlite3');
const fs = require('fs');

// Create backup first
console.log('🔄 Creating database backup...');
const backupPath = `kinetic_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
fs.copyFileSync('kinetic.db', backupPath);
console.log(`✅ Backup created: ${backupPath}`);

// Connect to database
const db = new Database('kinetic.db');

console.log('🚀 Starting customer data migration...');

try {
  // Step 1: Create new unified customer table
  console.log('📋 Creating unified customer table...');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers_new (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      firstName TEXT,
      lastName TEXT,
      phone TEXT,
      companyName TEXT,
      billingAddress TEXT,
      shippingAddress TEXT,
      status TEXT DEFAULT 'active',
      assignedTo TEXT,
      tags TEXT DEFAULT '[]',
      notes TEXT DEFAULT '[]',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      lastContactDate TEXT,
      totalInquiries INTEGER DEFAULT 0,
      totalOrders INTEGER DEFAULT 0,
      totalSpent REAL DEFAULT 0
    )
  `);

  // Step 2: Create customer sources tracking table
  console.log('📋 Creating customer sources table...');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_sources (
      id TEXT PRIMARY KEY,
      customerId TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('shopify', 'quickbooks', 'manual', 'website')),
      sourceId TEXT NOT NULL,
      sourceData TEXT, -- JSON with source-specific fields
      firstSeen TEXT NOT NULL,
      lastSeen TEXT NOT NULL,
      FOREIGN KEY (customerId) REFERENCES customers_new(id) ON DELETE CASCADE
    )
  `);

  // Step 3: Migrate data from existing tables
  console.log('📦 Migrating customer data...');
  
  // Get all customers from both tables
  const customersFromOld = db.prepare(`
    SELECT id, email, firstName, lastName, phone, companyName, 
           billingAddress, shippingAddress, status, assignedTo, tags, notes,
           createdAt, updatedAt, lastContactDate, totalInquiries, totalOrders, totalSpent,
           'customers' as source_table
    FROM customers
    UNION ALL
    SELECT id, email, firstName, lastName, phone, companyName,
           billingAddress, shippingAddress, 'active' as status, '' as assignedTo, '[]' as tags, '[]' as notes,
           createdAt, updatedAt, '' as lastContactDate, 0 as totalInquiries, 0 as totalOrders, 0 as totalSpent,
           'all_customers' as source_table
    FROM all_customers
  `).all();

  console.log(`📊 Found ${customersFromOld.length} customer records to migrate`);

  // Group by email to handle duplicates
  const customersByEmail = {};
  const customerSources = [];

  customersFromOld.forEach(customer => {
    const email = customer.email.toLowerCase().trim();
    
    if (!customersByEmail[email]) {
      // Create new customer record
      const newId = customer.id || `customer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      customersByEmail[email] = {
        id: newId,
        email: customer.email,
        firstName: customer.firstName || '',
        lastName: customer.lastName || '',
        phone: customer.phone || '',
        companyName: customer.companyName || '',
        billingAddress: customer.billingAddress || '',
        shippingAddress: customer.shippingAddress || '',
        status: customer.status || 'active',
        assignedTo: customer.assignedTo || '',
        tags: customer.tags || '[]',
        notes: customer.notes || '[]',
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        lastContactDate: customer.lastContactDate || null,
        totalInquiries: customer.totalInquiries || 0,
        totalOrders: customer.totalOrders || 0,
        totalSpent: customer.totalSpent || 0
      };
    } else {
      // Merge data from additional source
      const existing = customersByEmail[email];
      
      // Update with non-empty values from new source
      if (customer.firstName && !existing.firstName) existing.firstName = customer.firstName;
      if (customer.lastName && !existing.lastName) existing.lastName = customer.lastName;
      if (customer.phone && !existing.phone) existing.phone = customer.phone;
      if (customer.companyName && !existing.companyName) existing.companyName = customer.companyName;
      if (customer.billingAddress && !existing.billingAddress) existing.billingAddress = customer.billingAddress;
      if (customer.shippingAddress && !existing.shippingAddress) existing.shippingAddress = customer.shippingAddress;
      
      // Update timestamps
      if (new Date(customer.createdAt) < new Date(existing.createdAt)) {
        existing.createdAt = customer.createdAt;
      }
      if (new Date(customer.updatedAt) > new Date(existing.updatedAt)) {
        existing.updatedAt = customer.updatedAt;
      }
      
      // Sum up totals
      existing.totalInquiries += customer.totalInquiries || 0;
      existing.totalOrders += customer.totalOrders || 0;
      existing.totalSpent += customer.totalSpent || 0;
    }

    // Track source
    const source = customer.source_table === 'customers' ? 'website' : 'shopify';
    customerSources.push({
      id: `source_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      customerId: customersByEmail[email].id,
      source: source,
      sourceId: customer.id,
      sourceData: JSON.stringify({
        originalTable: customer.source_table,
        originalId: customer.id
      }),
      firstSeen: customer.createdAt,
      lastSeen: customer.updatedAt
    });
  });

  console.log(`📊 After deduplication: ${Object.keys(customersByEmail).length} unique customers`);

  // Step 4: Insert unified customer data
  console.log('💾 Inserting unified customer data...');
  
  const insertCustomer = db.prepare(`
    INSERT INTO customers_new (
      id, email, firstName, lastName, phone, companyName,
      billingAddress, shippingAddress, status, assignedTo, tags, notes,
      createdAt, updatedAt, lastContactDate, totalInquiries, totalOrders, totalSpent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSource = db.prepare(`
    INSERT INTO customer_sources (
      id, customerId, source, sourceId, sourceData, firstSeen, lastSeen
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    // Insert customers
    Object.values(customersByEmail).forEach(customer => {
      insertCustomer.run(
        customer.id, customer.email, customer.firstName, customer.lastName,
        customer.phone, customer.companyName, customer.billingAddress, customer.shippingAddress,
        customer.status, customer.assignedTo, customer.tags, customer.notes,
        customer.createdAt, customer.updatedAt, customer.lastContactDate,
        customer.totalInquiries, customer.totalOrders, customer.totalSpent
      );
    });

    // Insert sources
    customerSources.forEach(source => {
      insertSource.run(
        source.id, source.customerId, source.source, source.sourceId,
        source.sourceData, source.firstSeen, source.lastSeen
      );
    });
  });

  transaction();

  // Step 5: Update inquiries to use new customer IDs
  console.log('🔄 Updating inquiries to use new customer IDs...');
  
  const updateInquiry = db.prepare(`
    UPDATE inquiries 
    SET customerEmail = (
      SELECT c.email 
      FROM customers_new c 
      JOIN customer_sources cs ON c.id = cs.customerId 
      WHERE cs.sourceId = inquiries.customerEmail 
      LIMIT 1
    )
    WHERE EXISTS (
      SELECT 1 FROM customer_sources cs 
      WHERE cs.sourceId = inquiries.customerEmail
    )
  `);

  updateInquiry.run();

  // Step 6: Update orders to use new customer IDs
  console.log('🔄 Updating orders to use new customer IDs...');
  
  const updateOrder = db.prepare(`
    UPDATE all_orders 
    SET customerEmail = (
      SELECT c.email 
      FROM customers_new c 
      JOIN customer_sources cs ON c.id = cs.customerId 
      WHERE cs.sourceId = all_orders.customerEmail 
      LIMIT 1
    )
    WHERE EXISTS (
      SELECT 1 FROM customer_sources cs 
      WHERE cs.sourceId = all_orders.customerEmail
    )
  `);

  updateOrder.run();

  // Step 7: Create indexes for performance
  console.log('📈 Creating indexes...');
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_customers_new_email ON customers_new(email);
    CREATE INDEX IF NOT EXISTS idx_customers_new_status ON customers_new(status);
    CREATE INDEX IF NOT EXISTS idx_customers_new_assignedTo ON customers_new(assignedTo);
    CREATE INDEX IF NOT EXISTS idx_customer_sources_customerId ON customer_sources(customerId);
    CREATE INDEX IF NOT EXISTS idx_customer_sources_source ON customer_sources(source);
  `);

  // Step 8: Verify migration
  console.log('✅ Verifying migration...');
  
  const customerCount = db.prepare('SELECT COUNT(*) as count FROM customers_new').get().count;
  const sourceCount = db.prepare('SELECT COUNT(*) as count FROM customer_sources').get().count;
  const inquiryCount = db.prepare('SELECT COUNT(*) as count FROM inquiries').get().count;
  
  console.log(`📊 Migration Results:`);
  console.log(`   - Unified customers: ${customerCount}`);
  console.log(`   - Customer sources: ${sourceCount}`);
  console.log(`   - Inquiries: ${inquiryCount}`);

  console.log('🎉 Migration completed successfully!');
  console.log(`💾 Backup saved as: ${backupPath}`);
  console.log('⚠️  Next steps:');
  console.log('   1. Test the application thoroughly');
  console.log('   2. Update APIs to use customers_new table');
  console.log('   3. Once confirmed working, drop old tables');

} catch (error) {
  console.error('❌ Migration failed:', error);
  console.log(`🔄 Restoring from backup: ${backupPath}`);
  fs.copyFileSync(backupPath, 'kinetic.db');
  process.exit(1);
} finally {
  db.close();
}


