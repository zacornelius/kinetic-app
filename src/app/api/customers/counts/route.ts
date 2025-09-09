import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';

// GET /api/customers/counts - Get customer counts for each filter
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assignedTo = searchParams.get('assignedTo') || '';

    if (!assignedTo) {
      return NextResponse.json(
        { error: 'assignedTo parameter is required' },
        { status: 400 }
      );
    }

    // Get counts for each filter type
    const counts = {
      my_customers: 0,
      my_contacts: 0,
      all: 0
    };

    // My Customers: assigned to user AND has orders
    const myCustomersQuery = `SELECT COUNT(*) as count FROM customers WHERE assignedTo = ? AND totalOrders > 0`;
    counts.my_customers = db.prepare(myCustomersQuery).get(assignedTo).count;

    // My Contacts: assigned to user AND has inquiries but NO orders
    const myContactsQuery = `SELECT COUNT(*) as count FROM customers WHERE assignedTo = ? AND totalInquiries > 0 AND totalOrders = 0`;
    counts.my_contacts = db.prepare(myContactsQuery).get(assignedTo).count;

    // All Customers: total count
    const allCustomersQuery = `SELECT COUNT(*) as count FROM customers`;
    counts.all = db.prepare(allCustomersQuery).get().count;

    return NextResponse.json({ counts });

  } catch (error) {
    console.error('Error fetching customer counts:', error);
    return NextResponse.json(
      { error: error.message, details: error.stack },
      { status: 500 }
    );
  }
}
