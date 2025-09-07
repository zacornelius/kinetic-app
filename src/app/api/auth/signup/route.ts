import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { execSync } from 'child_process';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

export async function POST(request: NextRequest) {
  try {
    // Public signup is disabled - only admin can create users
    return NextResponse.json(
      { error: 'Public signup is disabled. Contact your administrator for access.' },
      { status: 403 }
    );

  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
