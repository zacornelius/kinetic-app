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
      // Check if search is an ID first (only if it looks like an ID - alphanumeric, no spaces)
      if (search.length > 5 && !search.includes('@') && !search.includes(' ') && /^[a-zA-Z0-9]+$/.test(search)) {
        whereConditions.push('id = ?');
        params.push(search);
      } else {
        // Handle multi-word searches
        const searchWords = search.trim().split(/\s+/);
        
        if (searchWords.length === 1) {
          // Single word search
          whereConditions.push(`(
            LOWER(email) LIKE ? OR 
            LOWER(firstname) LIKE ? OR 
            LOWER(lastname) LIKE ? OR 
            LOWER(companyname) LIKE ? OR
            LOWER(phone) LIKE ?
          )`);
          const searchTerm = `%${searchWords[0].toLowerCase()}%`;
          params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        } else {
          // Multi-word search - each word must match at least one field
          const wordConditions = searchWords.map(word => {
            const wordTerm = `%${word.toLowerCase()}%`;
            return `(
              LOWER(email) LIKE ? OR 
              LOWER(firstname) LIKE ? OR 
              LOWER(lastname) LIKE ? OR 
              LOWER(companyname) LIKE ? OR
              LOWER(phone) LIKE ?
            )`;
          });
          
          whereConditions.push(`(${wordConditions.join(' AND ')})`);
          
          // Add parameters for each word
          searchWords.forEach(word => {
            const wordTerm = `%${word.toLowerCase()}%`;
            params.push(wordTerm, wordTerm, wordTerm, wordTerm, wordTerm);
          });
        }
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
      whereConditions.push('assignedto = ?');
      params.push(assignedTo);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get customers from unified table
    const query = `
      SELECT 
        id, email, firstname as "firstName", lastname as "lastName", phone, companyname as "companyName",
        billingaddress as "billingAddress", shippingaddress as "shippingAddress", 
        createdat as "createdAt", updatedat as "updatedAt", lastcontactdate as "lastContactDate",
        totalinquiries as "totalInquiries", totalorders as "totalOrders", totalspent as "totalSpent",
        status, tags, notes, assignedto as "assignedTo", source
      FROM customers 
      ${whereClause}
      ORDER BY updatedat DESC, createdat DESC
      LIMIT ? OFFSET ?
    `;
    
    const queryParams = [...params, limit, offset];
    
    // Debug logging
    if (search) {
      console.log('Search query:', query);
      console.log('Search params:', queryParams);
    }
    const customers = (await db.prepare(query).all(...queryParams)).map(customer => ({
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
    const total = (await db.prepare(`SELECT COUNT(*) as total FROM customers ${whereClause}`).get(...params)).total;

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
    const existingCheck = await db.prepare('SELECT id FROM customer_profiles WHERE email = ?').get(email);

    if (existingCheck) {
      // Update existing customer
      const updateQuery = `
        UPDATE customer_profiles SET
          firstName = ?,
          lastName = ?,
          phone = ?,
          companyName = ?,
          billingAddress = ?,
          shippingAddress = ?,
          status = ?,
          tags = ?,
          assignedTo = ?,
          priority = ?,
          updatedAt = ?
        WHERE email = ?
      `;

      await db.prepare(updateQuery).run(
        firstName || '',
        lastName || '',
        phone || '',
        companyName || '',
        billingAddress || '',
        shippingAddress || '',
        status || 'active',
        JSON.stringify(tags || []),
        assignedTo || '',
        'normal',
        now,
        email
      );
    } else {
      // Create new customer
      const insertQuery = `
        INSERT INTO customer_profiles (
          id, email, firstName, lastName, phone, companyName,
          billingAddress, shippingAddress, source, sourceId,
          createdAt, updatedAt, status, tags, assignedTo, priority
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `;

      await db.prepare(insertQuery).run(
        id,
        email,
        firstName || '',
        lastName || '',
        phone || '',
        companyName || '',
        billingAddress || '',
        shippingAddress || '',
        source || 'manual',
        sourceId || '',
        now,
        now,
        status || 'active',
        JSON.stringify(tags || []),
        assignedTo || '',
        'normal'
      );
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
