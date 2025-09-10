import { NextResponse } from "next/server";
import db from "@/lib/database";

type User = {
  id: string;
  email: string;
  firstname: string;
  lastname: string;
  createdat: string;
};

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}


export async function GET() {
  try {
    const users = await db.prepare('SELECT id, email, firstname, lastname, createdat FROM users ORDER BY createdat DESC').all() as User[];
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, firstName, lastName } = body;
    
    if (!email || !firstName || !lastName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    // Check if user already exists
    const existingUser = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 });
    }
    
    const id = generateId();
    const createdAt = new Date().toISOString();
    
    const insertUser = db.prepare(`
      INSERT INTO users (id, email, firstname, lastname, createdat)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    await insertUser.run(id, email, firstName, lastName, createdAt);
    
    const newUser: User = { id, email, firstname: firstName, lastname: lastName, createdat: createdAt };
    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json({ error: "Missing user ID" }, { status: 400 });
    }
    
    const deleteUser = db.prepare('DELETE FROM users WHERE id = ?');
    const result = await deleteUser.run(id);
    
    if (result.changes === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
