import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';

// GET /api/customers/notes?customerId=xxx - Get notes for a customer
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    const notes = await db.prepare(`
      SELECT 
        cn.id, cn.customerId, cn.authorEmail, cn.note, cn.type,
        cn.createdAt, cn.isPrivate,
        u.firstName as authorFirstName, u.lastName as authorLastName
      FROM customer_notes cn
      LEFT JOIN users u ON cn.authorEmail = u.email
      WHERE cn.customerId = $1
      ORDER BY cn.createdAt DESC
    `).all(customerId);

    // Process notes and add default timestamps for notes without dates
    const processedNotes = [];
    for (const note of notes) {
      let createdAt = note.createdAt;
      
      // If no timestamp, assume it happened one day after the customer was created
      if (!createdAt) {
        const customerCreatedAt = await db.prepare(`SELECT createdat FROM customers WHERE id = $1`).get(customerId);
        if (customerCreatedAt?.createdat) {
          const customerDate = new Date(customerCreatedAt.createdat);
          customerDate.setDate(customerDate.getDate() + 1);
          createdAt = customerDate.toISOString();
        } else {
          createdAt = new Date().toISOString();
        }
      }

      processedNotes.push({
        id: note.id,
        customerId: note.customerId,
        authorEmail: note.authorEmail,
        note: note.note,
        type: note.type,
        createdAt,
        isPrivate: Boolean(note.isPrivate),
        authorName: `${note.authorFirstName || ''} ${note.authorLastName || ''}`.trim() || note.authorEmail
      });
    }

    return NextResponse.json({ notes: processedNotes });

  } catch (error) {
    console.error('Error fetching customer notes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer notes' },
      { status: 500 }
    );
  }
}

// POST /api/customers/notes - Add a note to a customer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, authorEmail, note, type = 'general', isPrivate = false, inquiryEmail } = body;

    if (!customerId && !inquiryEmail) {
      return NextResponse.json(
        { error: 'Customer ID or inquiry email is required' },
        { status: 400 }
      );
    }

    if (!authorEmail || !note) {
      return NextResponse.json(
        { error: 'Author email and note are required' },
        { status: 400 }
      );
    }

    let finalCustomerId = customerId;

    // If no customer ID but we have inquiry email, try to find or create customer
    if (!finalCustomerId && inquiryEmail) {
      // First try to find existing customer
      const existingCustomer = await db.prepare(`
        SELECT id FROM customers_new WHERE email = $1
      `).get(inquiryEmail);

      if (existingCustomer) {
        finalCustomerId = existingCustomer.id;
      } else {
        // Create a new customer for this inquiry
        const newCustomerId = Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();
        
        await db.prepare(`
          INSERT INTO customers_new (
            id, email, firstName, lastName, source, status, 
            createdAt, updatedAt, totalOrders, totalSpent
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 0)
        `).run(
          newCustomerId, inquiryEmail, 'Unknown', 'Customer', 
          'manual', 'contact', now, now
        );

        // Add to customer sources
        await db.prepare(`
          INSERT INTO customer_sources (id, customerId, source, sourceId)
          VALUES ($1, $2, $3, $4)
        `).run(
          Math.random().toString(36).substr(2, 9), newCustomerId, 'manual', newCustomerId
        );

        finalCustomerId = newCustomerId;
      }
    }

    const id = require('crypto').randomBytes(8).toString('hex');
    const now = new Date().toISOString();

    // Insert the note
    await db.prepare(`
      INSERT INTO customer_notes (
        id, customerId, authorEmail, note, type, createdAt, isPrivate
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `).run(id, finalCustomerId, authorEmail, note, type, now, isPrivate ? 1 : 0);

    // Update customer's last contact date
    await db.prepare(`
      UPDATE customers_new 
      SET lastContactDate = $1, updatedAt = $2
      WHERE id = $3
    `).run(now, now, finalCustomerId);

    return NextResponse.json({ success: true, noteId: id });

  } catch (error) {
    console.error('Error adding customer note:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: 'Failed to add customer note', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/customers/notes?noteId=xxx - Delete a note
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get('noteId');

    if (!noteId) {
      return NextResponse.json(
        { error: 'Note ID is required' },
        { status: 400 }
      );
    }

    const deleteQuery = `DELETE FROM customer_notes WHERE id = $1`;
    await db.prepare(deleteQuery).run(noteId);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting customer note:', error);
    return NextResponse.json(
      { error: 'Failed to delete customer note' },
      { status: 500 }
    );
  }
}
