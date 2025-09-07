import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { execSync } from 'child_process';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

export async function POST(request: NextRequest) {
  try {
    const { email, password, firstName, lastName } = await request.json();

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUserQuery = `SELECT * FROM users WHERE email = '${email}'`;
    const existingUserResult = execSync(`sqlite3 kinetic.db "${existingUserQuery}"`, { encoding: 'utf8' });
    
    if (existingUserResult.trim()) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create new user
    const userId = Date.now().toString(); // Simple ID generation
    const insertQuery = `
      INSERT INTO users (id, email, password, firstName, lastName, role, createdAt)
      VALUES ('${userId}', '${email}', '${hashedPassword}', '${firstName}', '${lastName}', 'user', datetime('now'))
    `;
    
    execSync(`sqlite3 kinetic.db "${insertQuery}"`);

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId, 
        email,
        role: 'user'
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Return user data (without password) and token
    const user = {
      id: userId,
      email,
      firstName,
      lastName,
      role: 'user',
      createdAt: new Date().toISOString()
    };
    
    return NextResponse.json({
      token,
      user,
      message: 'Signup successful'
    });

  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
