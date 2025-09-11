import { NextResponse } from 'next/server';
import db from '@/lib/database';

export async function GET() {
  try {
    // Test database connection with a simple query
    const result = await db.prepare('SELECT 1 as test').get();
    return NextResponse.json({ 
      success: true, 
      dbTest: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database test error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
