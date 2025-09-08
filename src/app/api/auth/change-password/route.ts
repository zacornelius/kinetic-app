import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/database';
import jwt from 'jsonwebtoken';

export async function POST(request: NextRequest) {
  try {
    const { newPassword } = await request.json();

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { message: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Get the token from the Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { message: 'Authorization token required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;

    if (!decoded || !decoded.userId) {
      return NextResponse.json(
        { message: 'Invalid token' },
        { status: 401 }
      );
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password in the database
    try {
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, decoded.userId);
      
      return NextResponse.json(
        { message: 'Password updated successfully' },
        { status: 200 }
      );
    } catch (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { message: 'Failed to update password' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
