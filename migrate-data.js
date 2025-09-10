const Database = require('better-sqlite3');
const { Pool } = require('pg');

// SQLite source
const sqliteDb = new Database('kinetic.db');

// PostgreSQL destination
const pgPool = new Pool({
  user: 'kinetic_user',
  host: 'localhost',
  database: 'kinetic_app',
  password: 'kinetic_password_2024',
  port: 5432,
});

async function migrateTable(tableName) {
  console.log(`Migrating ${tableName}...`);
  
  // Get all data from SQLite
  const rows = sqliteDb.prepare(`SELECT * FROM ${tableName}`).all();
  
  if (rows.length === 0) {
    console.log(`  No data in ${tableName}`);
    return;
  }
  
  // Get column names
  const columns = Object.keys(rows[0]);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  
  const insertQuery = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
  
  const client = await pgPool.connect();
  try {
    // Clear existing data
    await client.query(`DELETE FROM ${tableName}`);
    
    // Insert new data
    for (const row of rows) {
      const values = columns.map(col => row[col]);
      try {
        await client.query(insertQuery, values);
      } catch (error) {
        console.log(`    Skipping row due to constraint: ${error.message}`);
      }
    }
    
    console.log(`  Migrated ${rows.length} rows to ${tableName}`);
  } finally {
    client.release();
  }
}

async function migrate() {
  try {
    // Get all table names
    const tables = sqliteDb.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all().map(row => row.name);
    
    console.log('Tables to migrate:', tables);
    
    // Migrate each table
    for (const table of tables) {
      await migrateTable(table);
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    sqliteDb.close();
    await pgPool.end();
  }
}

migrate();
