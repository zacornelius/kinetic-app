import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { execSync } from 'child_process';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Helper function to verify admin token
function verifyAdminToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded.role === 'admin' ? decoded : null;
  } catch (error) {
    return null;
  }
}

// GET - List all users
export async function GET(request: NextRequest) {
  try {
    const admin = verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const query = `SELECT id, email, firstName, lastName, role, createdAt FROM users ORDER BY createdAt DESC`;
    const result = execSync(`sqlite3 kinetic.db "${query}"`, { encoding: 'utf8' });
    
    if (!result.trim()) {
      return NextResponse.json([]);
    }

    const users = result.trim().split('\n').map(line => {
      const [id, email, firstName, lastName, role, createdAt] = line.split('|');
      return { id, email, firstName, lastName, role, createdAt };
    });

    return NextResponse.json(users);

  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST - Create new user
export async function POST(request: NextRequest) {
  try {
    const admin = verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { email, password, firstName, lastName, role = 'user' } = await request.json();

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
    const userId = `user-${Date.now()}`;
    const insertQuery = `
      INSERT INTO users (id, email, password, firstName, lastName, role, createdAt)
      VALUES ('${userId}', '${email}', '${hashedPassword}', '${firstName}', '${lastName}', '${role}', datetime('now'))
    `;
    
    execSync(`sqlite3 kinetic.db "${insertQuery}"`);

    // Return user data (without password)
    const user = {
      id: userId,
      email,
      firstName,
      lastName,
      role,
      createdAt: new Date().toISOString()
    };
    
    return NextResponse.json({
      user,
      message: 'User created successfully'
    });

  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}

// PUT - Update user
export async function PUT(request: NextRequest) {
  try {
    const admin = verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id, email, firstName, lastName, role, password } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    let updateFields = [];
    let updateValues = [];

    if (email) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }
    if (firstName) {
      updateFields.push('firstName = ?');
      updateValues.push(firstName);
    }
    if (lastName) {
      updateFields.push('lastName = ?');
      updateValues.push(lastName);
    }
    if (role) {
      updateFields.push('role = ?');
      updateValues.push(role);
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 12);
      updateFields.push('password = ?');
      updateValues.push(hashedPassword);
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const updateQuery = `UPDATE users SET ${updateFields.join(', ')} WHERE id = '${id}'`;
    execSync(`sqlite3 kinetic.db "${updateQuery}"`);

    return NextResponse.json({
      message: 'User updated successfully'
    });

  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// DELETE - Delete user
export async function DELETE(request: NextRequest) {
  try {
    const admin = verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Prevent deleting admin users
    const userQuery = `SELECT role FROM users WHERE id = '${id}'`;
    const userResult = execSync(`sqlite3 kinetic.db "${userQuery}"`, { encoding: 'utf8' });
    
    if (userResult.trim() && userResult.trim().includes('admin')) {
      return NextResponse.json(
        { error: 'Cannot delete admin users' },
        { status: 400 }
      );
    }

    const deleteQuery = `DELETE FROM users WHERE id = '${id}'`;
    execSync(`sqlite3 kinetic.db "${deleteQuery}"`);

    return NextResponse.json({
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
