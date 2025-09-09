import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';

// GET /api/customers/enhanced - Get all customers with enhanced data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const source = searchParams.get('source') || '';
    const status = searchParams.get('status') || '';
    const assignedTo = searchParams.get('assignedTo') || '';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let whereConditions = [];
    let params = [];

    if (search) {
      // Check if search is an ID first
      if (search.length > 5 && !search.includes('@')) {
        whereConditions.push('id = ?');
        params.push(search);
      } else {
        whereConditions.push(`(
          email LIKE ? OR 
          firstName LIKE ? OR 
          lastName LIKE ? OR 
          companyName LIKE ? OR
          phone LIKE ?
        )`);
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      }
    }

    if (source) {
      whereConditions.push('source = ?');
      params.push(source);
    }

    if (status) {
      whereConditions.push('status = ?');
      params.push(status);
    }

    if (assignedTo) {
      whereConditions.push('assignedTo = ?');
      params.push(assignedTo);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get customers from unified table
    const query = `
      SELECT 
        id, email, firstName, lastName, phone, companyName,
        billingAddress, shippingAddress, createdAt, updatedAt, lastContactDate,
        totalInquiries, totalOrders, totalSpent,
        status, tags, notes, assignedTo, source
      FROM customers 
      ${whereClause}
      ORDER BY updatedAt DESC, createdAt DESC
      LIMIT ? OFFSET ?
    `;
    
    const queryParams = [...params, limit, offset];
    const customers = db.prepare(query).all(...queryParams).map(customer => ({
            id: customer.id,
            email: customer.email,
            firstName: customer.firstName || '',
            lastName: customer.lastName || '',
            phone: customer.phone || '',
            companyName: customer.companyName || '',
            billingAddress: customer.billingAddress || '',
            shippingAddress: customer.shippingAddress || '',
            createdAt: customer.createdAt,
            updatedAt: customer.updatedAt,
            lastContactDate: customer.lastContactDate || null,
            totalInquiries: parseInt(customer.totalInquiries) || 0,
            totalOrders: parseInt(customer.totalOrders) || 0,
            totalSpent: parseFloat(customer.totalSpent) || 0,
            status: customer.status,
            tags: customer.tags ? (customer.tags.startsWith('[') ? JSON.parse(customer.tags) : [customer.tags]) : [],
            notes: customer.notes ? (customer.notes.startsWith('[') ? JSON.parse(customer.notes) : [customer.notes]) : [],
            assignedTo: customer.assignedTo || null,
            source: customer.source || 'manual',
            // Set default values for missing CSV fields
            reason: null,
            customerType: null,
            numberOfDogs: null,
            assignedOwner: customer.assignedTo || null,
            inquiryStatus: null,
            countryCode: null,
            firstInteractionDate: null,
            lastInteractionDate: customer.lastContactDate || null,
            interactionCount: parseInt(customer.totalInquiries) || 0,
            isActiveInquiry: false,
            inquiryPriority: 'normal',
            followUpDate: null,
            leadSource: customer.source || null,
            customFields: {}
    }));

    // Get total count for pagination (use same params as main query, but without limit/offset)
    const total = db.prepare(`SELECT COUNT(*) as total FROM customers ${whereClause}`).get(...params).total;

    return NextResponse.json({
      customers,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    console.error('Error fetching enhanced customers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    );
  }
}

// POST /api/customers/enhanced - Create or update customer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email, firstName, lastName, phone, companyName,
      billingAddress, shippingAddress, source, sourceId,
      status, tags, assignedTo    } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const id = sourceId || require('crypto').randomBytes(8).toString('hex');

    // Check if customer exists
    const existingCheck = execSync(
      `sqlite3 kinetic.db "SELECT id FROM customer_profiles WHERE email = '${email.replace(/'/g, "''")}'"`,
      { encoding: 'utf8' }
    ).trim();

    if (existingCheck) {
      // Update existing customer
      const updateQuery = `
        UPDATE customer_profiles SET
          firstName = '${(firstName || '').replace(/'/g, "''")}',
          lastName = '${(lastName || '').replace(/'/g, "''")}',
          phone = '${(phone || '').replace(/'/g, "''")}',
          companyName = '${(companyName || '').replace(/'/g, "''")}',
          billingAddress = '${(billingAddress || '').replace(/'/g, "''")}',
          shippingAddress = '${(shippingAddress || '').replace(/'/g, "''")}',
          status = '${status || 'active'}',
          tags = '${JSON.stringify(tags || [])}',
          assignedTo = '${assignedTo || ''}',
          priority = '${priority || 'normal'}',
          updatedAt = '${now}'
        WHERE email = '${email.replace(/'/g, "''")}'
      `;

      execSync(`sqlite3 kinetic.db "${updateQuery}"`);
    } else {
      // Create new customer
      const insertQuery = `
        INSERT INTO customer_profiles (
          id, email, firstName, lastName, phone, companyName,
          billingAddress, shippingAddress, source, sourceId,
          createdAt, updatedAt, status, tags, assignedTo        ) VALUES (
          '${id}', '${email.replace(/'/g, "''")}', '${(firstName || '').replace(/'/g, "''")}',
          '${(lastName || '').replace(/'/g, "''")}', '${(phone || '').replace(/'/g, "''")}',
          '${(companyName || '').replace(/'/g, "''")}', '${(billingAddress || '').replace(/'/g, "''")}',
          '${(shippingAddress || '').replace(/'/g, "''")}', '${source || 'manual'}',
          '${id}', '${now}', '${now}', '${status || 'active'}',
          '${JSON.stringify(tags || [])}', '${assignedTo || ''}', '${priority || 'normal'}'
        )
      `;

      execSync(`sqlite3 kinetic.db "${insertQuery}"`);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error creating/updating customer:', error);
    return NextResponse.json(
      { error: 'Failed to create/update customer' },
      { status: 500 }
    );
  }
}

// PATCH /api/customers/enhanced - Update customer
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, assignedOwner } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    // Update the customer's assignedOwner
    const updateCustomer = db.prepare(`
      UPDATE customers_new 
      SET assignedOwner = ?, updatedAt = ?
      WHERE id = ?
    `);

    const result = updateCustomer.run(
      assignedOwner || null,
      new Date().toISOString(),
      id
    );

    if (result.changes === 0) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json(
      { error: 'Failed to update customer' },
      { status: 500 }
    );
  }
}
