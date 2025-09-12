import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const phone = searchParams.get('phone');
    const name = searchParams.get('name');
    
    if (!email && !phone && !name) {
      return NextResponse.json({ 
        error: 'At least one search parameter (email, phone, or name) is required' 
      }, { status: 400 });
    }

    let query = `
      SELECT 
        c.id,
        c.email,
        c.firstname as "firstName",
        c.lastname as "lastName",
        c.phone,
        c.companyname as "companyName",
        c.billingaddress as "billingAddress",
        c.shippingaddress as "shippingAddress",
        c.source,
        c.assignedto,
        c.customertype as "customerType",
        c.customercategory as "customerCategory",
        c.status,
        c.totalorders as "totalOrders",
        c.totalspent as "totalSpent",
        c.createdat as "createdAt",
        c.updatedat as "updatedAt"
      FROM customers c
      WHERE 1=0
    `;
    
    const params: any[] = [];
    
    if (email) {
      query += ' OR LOWER(c.email) LIKE LOWER(?)';
      params.push(`%${email}%`);
    }
    
    if (phone) {
      query += ' OR (c.phone LIKE ? OR c.phone LIKE ?)';
      params.push(`%${phone}%`, `%${phone.replace(/\D/g, '')}%`);
    }
    
    if (name) {
      query += ' OR (LOWER(COALESCE(c.firstname, \'\')) LIKE LOWER(?) OR LOWER(COALESCE(c.lastname, \'\')) LIKE LOWER(?) OR LOWER(COALESCE(c.firstname, \'\') || \' \' || COALESCE(c.lastname, \'\')) LIKE LOWER(?))';
      params.push(`%${name}%`, `%${name}%`, `%${name}%`);
    }
    
    query += ' ORDER BY c.customertype DESC, c.updatedat DESC LIMIT 10';
    
    const customers = await db.prepare(query).all(...params);
    
    // Get shipping addresses from orders for customers who have orders
    const customersWithOrders = customers.filter(c => c.totalOrders > 0);
    const shippingAddressMap = new Map();
    
    if (customersWithOrders.length > 0) {
      for (const customer of customersWithOrders) {
        // Try to get shipping address from shopify orders first
        let shippingQuery = `SELECT shippingaddress FROM shopify_orders WHERE customeremail = ? AND shippingaddress IS NOT NULL ORDER BY createdat DESC LIMIT 1`;
        let result = await db.prepare(shippingQuery).get(customer.email);
        
        if (!result?.shippingaddress) {
          // Try distributor orders
          shippingQuery = `SELECT shippingaddress FROM distributor_orders WHERE customeremail = ? AND shippingaddress IS NOT NULL ORDER BY createdat DESC LIMIT 1`;
          result = await db.prepare(shippingQuery).get(customer.email);
        }
        
        if (!result?.shippingaddress) {
          // Try digital orders
          shippingQuery = `SELECT shippingaddress FROM digital_orders WHERE customeremail = ? AND shippingaddress IS NOT NULL ORDER BY createdat DESC LIMIT 1`;
          result = await db.prepare(shippingQuery).get(customer.email);
        }
        
        if (result?.shippingaddress) {
          shippingAddressMap.set(customer.email, result.shippingaddress);
        }
      }
    }
    
    // Merge shipping addresses into customer data
    const enrichedCustomers = customers.map(customer => ({
      ...customer,
      shippingAddress: shippingAddressMap.get(customer.email) || customer.shippingAddress
    }));
    
    return NextResponse.json({ 
      customers: enrichedCustomers,
      count: enrichedCustomers.length 
    });
    
  } catch (error) {
    console.error('Error searching customers:', error);
    return NextResponse.json({ 
      error: 'Failed to search customers',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
