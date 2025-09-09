import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';

// GET /api/customers/simple - Simple customer filtering without complex JOINs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';
    const search = searchParams.get('search') || '';
    const assignedTo = searchParams.get('assignedTo') || '';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    let whereConditions = [];
    let params = [];

    // Base query
    let baseQuery = `
      SELECT 
        id, email, firstName, lastName, phone, companyName,
        billingAddress, shippingAddress, createdAt, updatedAt, lastContactDate,
        totalInquiries, totalOrders, totalSpent,
        status, tags, notes, assignedTo, source
      FROM customers
    `;

    // Apply filters
    if (filter === 'my_customers') {
      whereConditions.push('assignedTo = ?');
      whereConditions.push('totalOrders > 0');
      params.push(assignedTo);
    } else if (filter === 'my_contacts') {
      whereConditions.push('assignedTo = ?');
      whereConditions.push('totalInquiries > 0');
      whereConditions.push('totalOrders = 0');
      params.push(assignedTo);
    } else if (filter === 'all') {
      // No additional conditions
    }

    // Add search conditions
    if (search) {
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

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Final query
    const query = `
      ${baseQuery}
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
      source: customer.source || 'manual',
      tags: customer.tags ? (customer.tags.startsWith('[') ? JSON.parse(customer.tags) : [customer.tags]) : [],
      notes: customer.notes ? (customer.notes.startsWith('[') ? JSON.parse(customer.notes) : [customer.notes]) : [],
      assignedTo: customer.assignedTo || null,
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

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM customers ${whereClause}`;
    const total = db.prepare(countQuery).get(...params).total;

    return NextResponse.json({
      customers,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      },
      api: 'simple' // Identifier to confirm which API is being called
    });

  } catch (error) {
    console.error('Error fetching simple customers:', error);
    return NextResponse.json(
      { error: error.message, details: error.stack },
      { status: 500 }
    );
  }
}
