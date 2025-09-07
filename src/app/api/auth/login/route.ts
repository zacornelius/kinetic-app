import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { execSync } from 'child_process';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Check if user exists in database
    const userQuery = `SELECT * FROM users WHERE email = '${email}'`;
    const userResult = execSync(`sqlite3 kinetic.db "${userQuery}"`, { encoding: 'utf8' });
    
    if (!userResult.trim()) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const user = JSON.parse(userResult);
    
    // For now, we'll use a simple password check since we don't have hashed passwords yet
    // In production, you should hash passwords during signup
    if (user.password !== password) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        role: user.role || 'user'
      },
      JWT_SECRET,
      { expiresIn: '30d' } // Token expires in 30 days
    );

    // Return user data (without password) and token
    const { password: _, ...userWithoutPassword } = user;
    
    return NextResponse.json({
      token,
      user: userWithoutPassword,
      message: 'Login successful'
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
