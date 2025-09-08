import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import sqlite3 from 'sqlite3';

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
    const decoded = verifyToken(token);

    if (!decoded || !decoded.userId) {
      return NextResponse.json(
        { message: 'Invalid token' },
        { status: 401 }
      );
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password in the database
    const db = new sqlite3.Database('kinetic.db');
    
    return new Promise((resolve) => {
      db.run(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, decoded.userId],
        function(err) {
          db.close();
          
          if (err) {
            console.error('Database error:', err);
            resolve(NextResponse.json(
              { message: 'Failed to update password' },
              { status: 500 }
            ));
            return;
          }

          resolve(NextResponse.json(
            { message: 'Password updated successfully' },
            { status: 200 }
          ));
        }
      );
    });

  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
