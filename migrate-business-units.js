const { Pool } = require('pg');

const pool = new Pool({
  user: 'kinetic_user',
  host: 'localhost',
  database: 'kinetic_app',
  password: 'kinetic_password_2024',
  port: 5432,
});

async function migrateBusinessUnits() {
  const client = await pool.connect();
  try {
    console.log('Starting business unit migration...');
    
    // First, add business_unit column to customers table
    try {
      await client.query(`
        ALTER TABLE customers 
        ADD COLUMN business_unit TEXT DEFAULT 'pallet'
      `);
      console.log('✅ Added business_unit column to customers table');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ business_unit column already exists in customers table');
      } else {
        throw error;
      }
    }
    
    // Verify customers table has the column
    const customersCheck = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'customers' AND column_name = 'business_unit'
    `);
    
    if (customersCheck.rows.length > 0) {
      console.log('✅ customers.business_unit column verified');
    } else {
      console.log('❌ customers.business_unit column not found');
    }
    
    // Check if distributor_orders table exists
    const distributorCheck = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name = 'distributor_orders'
    `);
    
    if (distributorCheck.rows.length > 0) {
      console.log('✅ distributor_orders table exists');
    } else {
      console.log('❌ distributor_orders table not found');
    }
    
    console.log('Migration completed successfully');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

migrateBusinessUnits()
  .then(() => {
    console.log('All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });


