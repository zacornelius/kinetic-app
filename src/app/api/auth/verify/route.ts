import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import { execSync } from 'child_process';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Get user from database
    const userQuery = `SELECT id, email, password, firstName, lastName, role, createdAt FROM users WHERE id = '${decoded.userId}'`;
    const userResult = execSync(`sqlite3 kinetic.db "${userQuery}"`, { encoding: 'utf8' });
    
    if (!userResult.trim()) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Parse pipe-separated SQLite output
    const [id, email, password, firstName, lastName, role, createdAt] = userResult.trim().split('|');
    const user = { id, email, password, firstName, lastName, role, createdAt };
    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json({
      user: userWithoutPassword,
      valid: true
    });

  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.json(
      { error: 'Invalid token' },
      { status: 401 }
    );
  }
}
