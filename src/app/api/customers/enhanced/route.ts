import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { execSync } from 'child_process';

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

    const query = `
      SELECT 
        id, email, firstName, lastName, phone, companyName,
        billingAddress, shippingAddress, source, sourceId,
        createdAt, updatedAt, lastContactDate,
        totalInquiries, totalOrders, totalSpent,
        status, tags, notes, assignedTo, priority
      FROM customer_profiles 
      ${whereClause}
      ORDER BY updatedAt DESC, createdAt DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);

    const result = execSync(
      `sqlite3 kinetic.db "${query.replace(/\?/g, (match, offset) => {
        const paramIndex = query.substring(0, offset).split('?').length - 1;
        return `'${params[paramIndex]?.toString().replace(/'/g, "''") || ''}'`;
      })}"`,
      { encoding: 'utf8' }
    );

    const customers = result.trim().split('\n').map(line => {
      const [
        id, email, firstName, lastName, phone, companyName,
        billingAddress, shippingAddress, source, sourceId,
        createdAt, updatedAt, lastContactDate,
        totalInquiries, totalOrders, totalSpent,
        status, tags, notes, assignedTo, priority
      ] = line.split('|');

      return {
        id,
        email,
        firstName: firstName || '',
        lastName: lastName || '',
        phone: phone || '',
        companyName: companyName || '',
        billingAddress: billingAddress || '',
        shippingAddress: shippingAddress || '',
        source,
        sourceId,
        createdAt,
        updatedAt,
        lastContactDate: lastContactDate || null,
        totalInquiries: parseInt(totalInquiries) || 0,
        totalOrders: parseInt(totalOrders) || 0,
        totalSpent: parseFloat(totalSpent) || 0,
        status,
        tags: tags ? JSON.parse(tags) : [],
        notes: notes ? JSON.parse(notes) : [],
        assignedTo: assignedTo || null,
        priority
      };
    });

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) as total FROM customer_profiles ${whereClause}`;
    const countResult = execSync(
      `sqlite3 kinetic.db "${countQuery.replace(/\?/g, (match, offset) => {
        const paramIndex = countQuery.substring(0, offset).split('?').length - 1;
        return `'${params[paramIndex]?.toString().replace(/'/g, "''") || ''}'`;
      })}"`,
      { encoding: 'utf8' }
    );
    const total = parseInt(countResult.trim());

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
      status, tags, assignedTo, priority
    } = body;

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
          createdAt, updatedAt, status, tags, assignedTo, priority
        ) VALUES (
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
