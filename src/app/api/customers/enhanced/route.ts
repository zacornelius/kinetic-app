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
    const businessUnit = searchParams.get('businessUnit') || '';
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

    if (businessUnit) {
      whereConditions.push('business_unit = ?');
      params.push(businessUnit);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get customers with calculated lifetime value from all order sources
    const query = `
      SELECT 
        c.id, c.email, c.firstname as "firstName", c.lastname as "lastName", c.phone, c.companyname as "companyName",
        c.billingaddress as "billingAddress", c.shippingaddress as "shippingAddress", 
        c.createdat as "createdAt", c.updatedat as "updatedAt", c.lastcontactdate as "lastContactDate",
        c.totalinquiries as "totalInquiries", c.totalorders as "totalOrders", c.totalspent as "totalSpent",
        c.status, c.tags, c.notes, c.assignedto as "assignedTo", c.source, c.business_unit as "businessUnit",
        COALESCE(order_stats.total_spent, 0) as "calculatedTotalSpent",
        COALESCE(order_stats.total_orders, 0) as "calculatedTotalOrders",
        order_stats.first_order_date,
        order_stats.last_order_date
      FROM customers c
      LEFT JOIN (
        SELECT 
          customeremail,
          SUM(totalamount) as total_spent,
          COUNT(DISTINCT ordernumber) as total_orders,
          MIN(createdat) as first_order_date,
          MAX(createdat) as last_order_date
        FROM (
          SELECT customeremail, totalamount, ordernumber, createdat::timestamp as createdat FROM shopify_orders
          UNION ALL
          SELECT customeremail, totalamount, ordernumber, createdat::timestamp as createdat FROM distributor_orders
          UNION ALL
          SELECT customeremail, totalamount, ordernumber, createdat as createdat FROM digital_orders
        ) all_orders
        GROUP BY customeremail
      ) order_stats ON c.email = order_stats.customeremail
      ${whereClause}
      ORDER BY COALESCE(order_stats.total_spent, 0) DESC, c.updatedat DESC
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
            totalOrders: parseInt(customer.calculatedTotalOrders) || 0,
            totalSpent: parseFloat(customer.calculatedTotalSpent) || 0,
            lifetimeValue: parseFloat(customer.calculatedTotalSpent) || 0,
            status: customer.status,
            tags: customer.tags ? (customer.tags.startsWith('[') ? JSON.parse(customer.tags) : [customer.tags]) : [],
            notes: customer.notes ? (customer.notes.startsWith('[') ? JSON.parse(customer.notes) : [customer.notes]) : [],
            assignedTo: customer.assignedTo || null,
            source: customer.source || 'manual',
            businessUnit: customer.businessUnit || 'pallet',
            // Set default values for missing CSV fields
            reason: null,
            customerType: null,
            numberOfDogs: null,
            assignedOwner: customer.assignedTo || null,
            inquiryStatus: null,
            countryCode: null,
            firstInteractionDate: customer.first_order_date || null,
            lastInteractionDate: customer.last_order_date || customer.lastContactDate || null,
            firstOrderDate: customer.first_order_date || null,
            lastOrderDate: customer.last_order_date || null,
            interactionCount: parseInt(customer.totalInquiries) || 0,
            isActiveInquiry: false,
            inquiryPriority: 'normal',
            followUpDate: null,
            leadSource: customer.source || null,
            customFields: {}
    }));

    // Get total count for pagination (use same params as main query, but without limit/offset)
    const total = (await db.prepare(`
      SELECT COUNT(*) as total 
      FROM customers c
      LEFT JOIN (
        SELECT DISTINCT customeremail
        FROM (
          SELECT customeremail FROM shopify_orders
          UNION ALL
          SELECT customeremail FROM distributor_orders
          UNION ALL
          SELECT customeremail FROM digital_orders
        ) all_orders
      ) order_stats ON c.email = order_stats.customeremail
      ${whereClause}
    `).get(...params)).total;

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
