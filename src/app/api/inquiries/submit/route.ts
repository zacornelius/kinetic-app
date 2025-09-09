import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Extract form data
    const {
      name,
      inquiry_type,
      phone,
      email,
      usage,
      number_of_dogs,
      body: message
    } = body;

    // Validate required fields
    if (!name || !email || !inquiry_type || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, inquiry_type, and message are required' },
        { status: 400 }
      );
    }

    // Map inquiry_type to our categories
    let category = 'questions'; // default
    if (inquiry_type === 'Bulk Purchase') {
      category = 'bulk';
    } else if (inquiry_type === 'Product Issue') {
      category = 'issues';
    } else if (inquiry_type === 'General Question') {
      category = 'questions';
    }

    // Generate unique inquiry ID
    const inquiryId = Math.random().toString(36).substring(2, 15);

    // Check if customer already exists to get their assigned owner
    const existingCustomer = db.prepare(`
      SELECT id, assignedOwner FROM customers_new WHERE email = ?
    `).get(email);

    const ownerEmail = existingCustomer?.assignedOwner || null;

    // Insert inquiry into database
          const insertInquiry = db.prepare(`
            INSERT INTO inquiries (
              id,
              customerEmail,
              category,
              message,
              createdAt,
              status,
              ownerEmail
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `);

    const inquiryResult = insertInquiry.run(
      inquiryId,
      email,
      category,
      message,
      new Date().toISOString(),
      'active',
      ownerEmail
    );

    if (inquiryResult.changes === 0) {
      throw new Error('Failed to insert inquiry');
    }

    if (!existingCustomer) {
      // Create new customer record
      const customerId = `web_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      
      const insertCustomer = db.prepare(`
        INSERT INTO customers_new (
          id,
          email,
          firstName,
          lastName,
          phone,
          customerType,
          numberOfDogs,
          status,
          source,
          createdAt,
          updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const customerResult = insertCustomer.run(
        customerId,
        email,
        firstName,
        lastName,
        phone || null,
        usage || null,
        number_of_dogs ? parseInt(number_of_dogs) : null,
        'contact',
        'website',
        new Date().toISOString(),
        new Date().toISOString()
      );

      if (customerResult.changes === 0) {
        console.error('Failed to create customer record');
      }
    } else {
      // Update existing customer with new inquiry data
      const updateCustomer = db.prepare(`
        UPDATE customers_new 
        SET 
          phone = COALESCE(?, phone),
          customerType = COALESCE(?, customerType),
          numberOfDogs = COALESCE(?, numberOfDogs),
          updatedAt = ?,
          status = CASE 
            WHEN status = 'customer' THEN 'customer'
            ELSE 'contact'
          END
        WHERE email = ?
      `);

      updateCustomer.run(
        phone || null,
        usage || null,
        number_of_dogs ? parseInt(number_of_dogs) : null,
        new Date().toISOString(),
        email
      );
    }

    return NextResponse.json({
      success: true,
      inquiryId,
      message: 'Inquiry submitted successfully'
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });

  } catch (error) {
    console.error('Error submitting inquiry:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    );
  }
}

// Handle preflight OPTIONS requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
