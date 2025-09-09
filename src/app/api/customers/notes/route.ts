import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { require } from 'module';

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

    const query = `
      SELECT 
        cn.id, cn.customerId, cn.authorEmail, cn.note, cn.type,
        cn.createdAt, cn.isPrivate,
        u.firstName as authorFirstName, u.lastName as authorLastName
      FROM customer_notes cn
      LEFT JOIN users u ON cn.authorEmail = u.email
      WHERE cn.customerId = '${customerId.replace(/'/g, "''")}'
      ORDER BY cn.createdAt DESC
    `;

    const result = execSync(`sqlite3 kinetic.db "${query}"`, { encoding: 'utf8' });

    const notes = result.trim().split('\n').map(line => {
      const [
        id, customerId, authorEmail, note, type,
        createdAt, isPrivate, authorFirstName, authorLastName
      ] = line.split('|');

      return {
        id,
        customerId,
        authorEmail,
        note,
        type,
        createdAt,
        isPrivate: isPrivate === '1',
        authorName: `${authorFirstName || ''} ${authorLastName || ''}`.trim() || authorEmail
      };
    });

    return NextResponse.json({ notes });

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
    const { customerId, authorEmail, note, type = 'general', isPrivate = false } = body;

    if (!customerId || !authorEmail || !note) {
      return NextResponse.json(
        { error: 'Customer ID, author email, and note are required' },
        { status: 400 }
      );
    }

    const id = require('crypto').randomBytes(8).toString('hex');
    const now = new Date().toISOString();

    const insertQuery = `
      INSERT INTO customer_notes (
        id, customerId, authorEmail, note, type, createdAt, isPrivate
      ) VALUES (
        '${id}', '${customerId.replace(/'/g, "''")}', '${authorEmail.replace(/'/g, "''")}',
        '${note.replace(/'/g, "''")}', '${type}', '${now}', ${isPrivate ? 1 : 0}
      )
    `;

    execSync(`sqlite3 kinetic.db "${insertQuery}"`);

    // Update customer's last contact date
    const updateQuery = `
      UPDATE customer_profiles 
      SET lastContactDate = '${now}', updatedAt = '${now}'
      WHERE id = '${customerId.replace(/'/g, "''")}'
    `;

    execSync(`sqlite3 kinetic.db "${updateQuery}"`);

    return NextResponse.json({ success: true, noteId: id });

  } catch (error) {
    console.error('Error adding customer note:', error);
    return NextResponse.json(
      { error: 'Failed to add customer note' },
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

    const deleteQuery = `DELETE FROM customer_notes WHERE id = '${noteId.replace(/'/g, "''")}'`;
    execSync(`sqlite3 kinetic.db "${deleteQuery}"`);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting customer note:', error);
    return NextResponse.json(
      { error: 'Failed to delete customer note' },
      { status: 500 }
    );
  }
}
