#!/usr/bin/env node

const fs = require('fs');
const csv = require('csv-parser');
const { Pool } = require('pg');

// PostgreSQL connection pool
const pool = new Pool({
  user: 'kinetic_user',
  host: 'localhost',
  database: 'kinetic_app',
  password: 'kinetic_password_2024',
  port: 5432,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 5,
});

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function parseDate(dateStr) {
  // Parse "5/29/25" format
  const [month, day, year] = dateStr.split('/');
  const fullYear = 2000 + parseInt(year);
  return new Date(fullYear, month - 1, day).toISOString();
}

async function migrateCSVData() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting CSV data migration...');
    
    const orders = [];
    const customers = new Map();
    
    // Read and parse CSV
    await new Promise((resolve, reject) => {
      fs.createReadStream('distributor and digital.csv')
        .pipe(csv())
        .on('data', (row) => {
          const orderNumber = row['Order #'];
          const customerName = row['Customer'];
          const classification = row['Classification '].trim();
          const type = row['Type'];
          const shipToLocation = row['Ship to Location'];
          const totalBags = parseInt(row['Total Bags']) || 0;
          const invoiceAmount = parseFloat(row['Invoice Amount']) || 0;
          const foodCost = parseFloat(row['Food Cost']) || 0;
          const shipping = parseFloat(row['Shipping']) || 0;
          const date = row['Date'];
          
          // Determine business unit
          let businessUnit = 'distributor';
          if (type === 'Digital') {
            businessUnit = 'digital';
          }
          
          // Create customer key
          const customerKey = `${customerName}_${classification}`;
          
          // Store customer info
          if (!customers.has(customerKey)) {
            customers.set(customerKey, {
              id: generateId(),
              name: customerName,
              classification: classification,
              businessUnit: businessUnit,
              email: `${customerName.toLowerCase().replace(/\s+/g, '')}@${classification.toLowerCase().replace(/\s+/g, '')}.com`,
              totalOrders: 0,
              totalValue: 0
            });
          }
          
          // Update customer totals
          const customer = customers.get(customerKey);
          customer.totalOrders += 1;
          customer.totalValue += invoiceAmount;
          
          // Create line items JSON
          const lineItems = [];
          const skuCounts = {
            '24K': parseInt(row['24K']) || 0,
            '26K': parseInt(row['26K']) || 0,
            '28K': parseInt(row['28K']) || 0,
            '30K': parseInt(row['30K']) || 0,
            '32K': parseInt(row['32K']) || 0
          };
          
          Object.entries(skuCounts).forEach(([sku, quantity]) => {
            if (quantity > 0) {
              lineItems.push({
                sku: sku,
                title: `${sku} Kinetic Dog Food`,
                quantity: quantity,
                price: invoiceAmount / totalBags, // Approximate price per bag
                totalPrice: (invoiceAmount / totalBags) * quantity
              });
            }
          });
          
          // Create order
          const order = {
            id: generateId(),
            orderNumber: orderNumber,
            customerEmail: customer.email,
            customerName: customerName,
            totalAmount: invoiceAmount,
            currency: 'USD',
            status: 'delivered',
            shippingAddress: shipToLocation,
            notes: `Classification: ${classification}, Type: ${type}`,
            ownerEmail: 'lindsey@kineticdogfood.com',
            source: businessUnit,
            sourceId: orderNumber,
            lineItems: JSON.stringify(lineItems),
            businessUnit: businessUnit,
            createdAt: parseDate(date)
          };
          
          orders.push(order);
        })
        .on('end', resolve)
        .on('error', reject);
    });
    
    console.log(`📊 Parsed ${orders.length} orders and ${customers.size} unique customers`);
    
    // Insert customers
    console.log('👥 Creating customers...');
    for (const [key, customer] of customers) {
      try {
        // Check if customer exists
        const existingCustomer = await client.query(
          'SELECT id FROM customers WHERE email = $1',
          [customer.email]
        );
        
        if (existingCustomer.rows.length === 0) {
          // Create customer
          await client.query(`
            INSERT INTO customers (
              id, email, firstname, lastname, companyname, phone, 
              assignedto, status, business_unit, createdat, updatedat
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `, [
            customer.id,
            customer.email,
            customer.name.split(' ')[0] || '',
            customer.name.split(' ').slice(1).join(' ') || '',
            customer.classification,
            null,
            'lindsey@kineticdogfood.com',
            'active',
            customer.businessUnit,
            new Date().toISOString(),
            new Date().toISOString()
          ]);
          
          // Create customer source
          await client.query(`
            INSERT INTO customer_sources (
              id, customerid, source, sourceid, firstseen, lastseen
            ) VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            generateId(),
            customer.id,
            customer.businessUnit,
            customer.id,
            new Date().toISOString(),
            new Date().toISOString()
          ]);
          
          console.log(`  ✅ Created customer: ${customer.name} (${customer.email})`);
        } else {
          console.log(`  ⏭️  Customer already exists: ${customer.name}`);
        }
      } catch (error) {
        console.error(`  ❌ Error creating customer ${customer.name}:`, error.message);
      }
    }
    
    // Insert orders
    console.log('📦 Creating orders...');
    let successCount = 0;
    let errorCount = 0;
    
    for (const order of orders) {
      try {
        // Determine target table
        const tableName = order.businessUnit === 'digital' ? 'digital_orders' : 'distributor_orders';
        
        // Check if order exists
        const existingOrder = await client.query(
          `SELECT id FROM ${tableName} WHERE ordernumber = $1`,
          [order.orderNumber]
        );
        
        if (existingOrder.rows.length === 0) {
          await client.query(`
            INSERT INTO ${tableName} (
              id, createdat, ordernumber, customeremail, customername, 
              totalamount, currency, status, shippingaddress, notes, 
              owneremail, source, sourceid, lineitems, business_unit
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          `, [
            order.id,
            order.createdAt,
            order.orderNumber,
            order.customerEmail,
            order.customerName,
            order.totalAmount,
            order.currency,
            order.status,
            order.shippingAddress,
            order.notes,
            order.ownerEmail,
            order.source,
            order.sourceId,
            order.lineItems,
            order.businessUnit
          ]);
          
          successCount++;
          if (successCount % 10 === 0) {
            console.log(`  ✅ Created ${successCount} orders...`);
          }
        } else {
          console.log(`  ⏭️  Order already exists: ${order.orderNumber}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`  ❌ Error creating order ${order.orderNumber}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Migration completed!`);
    console.log(`  📊 Orders created: ${successCount}`);
    console.log(`  👥 Customers created: ${customers.size}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrateCSVData()
    .then(() => {
      console.log('✅ Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateCSVData };

