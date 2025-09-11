import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/database";

export async function POST(request: NextRequest) {
  try {
    console.log('Starting master data setup...');
    
    // 1. Add business_unit column to shopify_orders table
    console.log('Adding business_unit column to shopify_orders...');
    await db.exec(`
      ALTER TABLE shopify_orders 
      ADD COLUMN IF NOT EXISTS business_unit VARCHAR(50) DEFAULT 'pallet'
    `);
    
    // 2. Update existing Shopify data to mark as 'pallet' business unit
    console.log('Updating existing Shopify orders to pallet business unit...');
    await db.exec(`
      UPDATE shopify_orders 
      SET business_unit = 'pallet' 
      WHERE business_unit IS NULL OR business_unit = ''
    `);
    
    // 3. Add business_unit column to customers table
    console.log('Adding business_unit column to customers table...');
    await db.exec(`
      ALTER TABLE customers 
      ADD COLUMN IF NOT EXISTS business_unit VARCHAR(50) DEFAULT 'pallet'
    `);
    
    // 4. Create distributor_orders table with same structure as shopify_orders
    console.log('Creating distributor_orders table...');
    await db.exec(`
      CREATE TABLE IF NOT EXISTS distributor_orders (
        id VARCHAR(255) PRIMARY KEY,
        createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ordernumber VARCHAR(255) UNIQUE NOT NULL,
        customeremail VARCHAR(255) NOT NULL,
        customername VARCHAR(255),
        totalamount DECIMAL(10,2),
        currency VARCHAR(10) DEFAULT 'USD',
        status VARCHAR(50) DEFAULT 'pending',
        shippingaddress TEXT,
        billingaddress TEXT,
        trackingnumber VARCHAR(255),
        notes TEXT,
        owneremail VARCHAR(255),
        source VARCHAR(50) DEFAULT 'distributor',
        sourceid VARCHAR(255),
        lineitems TEXT,
        business_unit VARCHAR(50) DEFAULT 'distributor',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 5. Create digital_orders table with same structure as shopify_orders
    console.log('Creating digital_orders table...');
    await db.exec(`
      CREATE TABLE IF NOT EXISTS digital_orders (
        id VARCHAR(255) PRIMARY KEY,
        createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ordernumber VARCHAR(255) UNIQUE NOT NULL,
        customeremail VARCHAR(255) NOT NULL,
        customername VARCHAR(255),
        totalamount DECIMAL(10,2),
        currency VARCHAR(10) DEFAULT 'USD',
        status VARCHAR(50) DEFAULT 'pending',
        shippingaddress TEXT,
        billingaddress TEXT,
        trackingnumber VARCHAR(255),
        notes TEXT,
        owneremail VARCHAR(255),
        source VARCHAR(50) DEFAULT 'digital',
        sourceid VARCHAR(255),
        lineitems TEXT,
        business_unit VARCHAR(50) DEFAULT 'digital',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Master data setup completed successfully!');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Master data setup completed successfully!',
      tables: ['shopify_orders', 'customers', 'distributor_orders', 'digital_orders']
    });
    
  } catch (error) {
    console.error('Master data setup failed:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message,
      error: error.toString()
    }, { status: 500 });
  }
}

