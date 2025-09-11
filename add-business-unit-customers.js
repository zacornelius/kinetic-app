const { Pool } = require('pg');

const pool = new Pool({
  user: 'kinetic_user',
  host: 'localhost',
  database: 'kinetic_app',
  password: 'kinetic_password_2024',
  port: 5432,
});

async function addBusinessUnitToCustomers() {
  const client = await pool.connect();
  try {
    console.log('Adding business_unit column to customers table...');
    
    // Add the business_unit column with default value 'pallet'
    await client.query(`
      ALTER TABLE customers 
      ADD COLUMN business_unit TEXT DEFAULT 'pallet'
    `);
    
    console.log('✅ Successfully added business_unit column to customers table');
    
    // Verify the column was added
    const result = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'customers' 
      AND column_name = 'business_unit'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Column verification successful:', result.rows[0]);
    } else {
      console.log('❌ Column verification failed');
    }
    
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('✅ Column already exists - skipping');
    } else {
      console.error('❌ Error adding business_unit column:', error.message);
      throw error;
    }
  } finally {
    client.release();
  }
}

addBusinessUnitToCustomers()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });


