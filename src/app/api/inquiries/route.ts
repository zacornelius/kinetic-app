import { NextResponse } from "next/server";
import db from "@/lib/database";

type Category = "bulk" | "issues" | "questions";

type Inquiry = {
  id: string;
  createdAt: string;
  category: Category;
  subject: string;
  customerEmail: string;
  ownerEmail?: string;
  status: "open" | "assigned" | "closed";
};

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

// Seed initial inquiries if database is empty
function seedInitialInquiries() {
  const inquiryCount = db.prepare('SELECT COUNT(*) as count FROM inquiries').get() as { count: number };
  
  if (inquiryCount.count === 0) {
    const insertInquiry = db.prepare(`
      INSERT INTO inquiries (id, createdAt, category, subject, customerEmail, ownerEmail, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertInquiry.run(
      "1", 
      new Date().toISOString(), 
      "bulk", 
      "Bulk purchase request for 500 units", 
      "acme@example.com", 
      null, 
      "open"
    );
    insertInquiry.run(
      "2", 
      new Date().toISOString(), 
      "issues", 
      "Product arrived damaged", 
      "jane@example.com", 
      null, 
      "open"
    );
  }
}

export async function GET(request: Request) {
  try {
    seedInitialInquiries();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as Category | null;
    
    let query = 'SELECT * FROM inquiries ORDER BY createdAt DESC';
    let params: any[] = [];
    
    if (category) {
      query = 'SELECT * FROM inquiries WHERE category = ? ORDER BY createdAt DESC';
      params = [category];
    }
    
    const data = db.prepare(query).all(...params) as Inquiry[];
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching inquiries:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { category, subject, customerEmail, ownerEmail } = body;
    
    if (!category || !subject || !customerEmail) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    const id = generateId();
    const createdAt = new Date().toISOString();
    const status = ownerEmail ? "assigned" : "open";
    
    const insertInquiry = db.prepare(`
      INSERT INTO inquiries (id, createdAt, category, subject, customerEmail, ownerEmail, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertInquiry.run(id, createdAt, category, subject, customerEmail, ownerEmail || null, status);
    
    const newInquiry: Inquiry = {
      id,
      createdAt,
      category,
      subject,
      customerEmail,
      ownerEmail: ownerEmail || undefined,
      status,
    };
    
    return NextResponse.json(newInquiry, { status: 201 });
  } catch (error) {
    console.error('Error creating inquiry:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ownerEmail, status } = body as Partial<Inquiry> & { id: string };
    
    if (!id) {
      return NextResponse.json({ error: "Missing inquiry ID" }, { status: 400 });
    }
    
    // Check if inquiry exists
    const existingInquiry = db.prepare('SELECT * FROM inquiries WHERE id = ?').get(id) as Inquiry;
    if (!existingInquiry) {
      return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
    }
    
    // Build update query dynamically
    const updates: string[] = [];
    const params: any[] = [];
    
    if (ownerEmail !== undefined) {
      updates.push('ownerEmail = ?');
      params.push(ownerEmail || null);
      
      // Update status based on owner assignment
      updates.push('status = ?');
      params.push(ownerEmail ? "assigned" : "open");
    }
    
    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    
    if (updates.length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }
    
    params.push(id);
    
    const updateQuery = `UPDATE inquiries SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(updateQuery).run(...params);
    
    // Return updated inquiry
    const updatedInquiry = db.prepare('SELECT * FROM inquiries WHERE id = ?').get(id) as Inquiry;
    return NextResponse.json(updatedInquiry);
  } catch (error) {
    console.error('Error updating inquiry:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


