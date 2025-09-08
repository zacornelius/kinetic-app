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


export async function GET(request: Request) {
  try {
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
    
    // Send push notification for new inquiry
    try {
      const notificationMessages = {
        bulk: {
          title: "New Bulk Inquiry",
          body: "A customer is interested in buying Kinetic in bulk."
        },
        issues: {
          title: "New Issue Report",
          body: "A customer has an issue with a Kinetic product."
        },
        questions: {
          title: "New Question",
          body: "A customer has a question for Kinetic."
        }
      };
      
      const message = notificationMessages[category] || {
        title: "New Inquiry",
        body: "A new inquiry has been submitted."
      };
      
      // Send notification asynchronously
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/notifications/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: message.title,
          body: message.body,
          category: category
        })
      }).catch(error => {
        console.error('Error sending push notification:', error);
      });
    } catch (error) {
      console.error('Error preparing push notification:', error);
    }
    
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


