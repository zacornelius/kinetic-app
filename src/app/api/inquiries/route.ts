import { NextResponse } from "next/server";
import db from "@/lib/database";
import { getCustomerOwner, assignCustomer, getAutoAssignment, updateCustomerStatus } from "@/lib/customer-assignment";

type Category = "bulk" | "issues" | "questions";

type Inquiry = {
  id: string;
  createdAt: string;
  category: Category;
  customerEmail: string;
  status: "active" | "closed";
  originalMessage?: string;
  customerName?: string;
  assignedOwner?: string; // This will be derived from customer record
};

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as Category | null;
    
             let query = `
               SELECT DISTINCT i.*, i.message as originalMessage,
                      COALESCE(c.firstName || ' ' || c.lastName, i.customerEmail) as customerName,
                      c.assignedTo as assignedOwner
               FROM inquiries i 
               LEFT JOIN customers c ON LOWER(i.customerEmail) = LOWER(c.email)
               WHERE i.status != 'not_relevant'
               ORDER BY i.createdAt DESC
             `;
    let params: any[] = [];
    
    if (category) {
      query = `
        SELECT DISTINCT i.*, i.message as originalMessage,
               COALESCE(c.firstName || ' ' || c.lastName, i.customerEmail) as customerName,
               c.assignedTo as assignedOwner
        FROM inquiries i 
        LEFT JOIN customers c ON LOWER(i.customerEmail) = LOWER(c.email)
        WHERE i.category = ? AND i.status != 'not_relevant'
        ORDER BY i.createdAt DESC
      `;
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
    const { category, customerEmail, message } = body;
    
    if (!category || !customerEmail) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    // Check if customer exists
    const existingCustomer = db.prepare(`
      SELECT id, assignedTo, firstName, lastName, status FROM customers
      WHERE email = ?
    `).get(customerEmail) as { id: string, assignedTo: string | null, firstName: string, lastName: string, status: string } | undefined;
    
    let assignedOwner: string | null = null;
    let status: string;
    
    if (existingCustomer && existingCustomer.assignedTo) {
      // Customer exists with assigned owner - auto-assign to active
      assignedOwner = existingCustomer.assignedTo;
      status = "active";
      
      // Update their last contact date and increment inquiry count
      db.prepare(`
        UPDATE customers
        SET lastContactDate = ?, totalInquiries = totalInquiries + 1, updatedAt = ?
        WHERE id = ?
      `).run(new Date().toISOString(), new Date().toISOString(), existingCustomer.id);
      
      // Update customer status
      updateCustomerStatus(existingCustomer.id);
    } else {
      // Customer doesn't exist or has no assigned owner - mark as new
      assignedOwner = null;
      status = "new";
    }
    
    const id = Math.random().toString(36).slice(2, 15);
    const createdAt = new Date().toISOString();
    
    const insertInquiry = db.prepare(`
      INSERT INTO inquiries (id, createdAt, category, customerEmail, status, message)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    // Create a meaningful default message if none provided
    const defaultMessage = message || `New ${category} inquiry from ${customerEmail}`;
    insertInquiry.run(id, createdAt, category, customerEmail, status, defaultMessage);
    
    const newInquiry: Inquiry = {
      id,
      createdAt,
      category,
      customerEmail,
      assignedOwner: assignedOwner || undefined,
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
    const { id, action, salesPersonEmail } = body;
    
    if (!id || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    // Get the inquiry
    const inquiry = db.prepare('SELECT * FROM inquiries WHERE id = ?').get(id) as Inquiry;
    if (!inquiry) {
      return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
    }
    
    if (action === "take") {
      if (!salesPersonEmail) {
        return NextResponse.json({ error: "Sales person email required for taking inquiry" }, { status: 400 });
      }
      
      if (inquiry.status !== "new" && !(inquiry.status === "active" && !inquiry.assignedOwner)) {
        return NextResponse.json({ error: "Can only take inquiries with 'new' status or unassigned 'active' status" }, { status: 400 });
      }
      
      // Check if customer exists
      const existingCustomer = db.prepare(`
        SELECT id, assignedTo, firstName, lastName, status FROM customers
        WHERE email = ?
      `).get(inquiry.customerEmail) as { id: string, assignedTo: string | null, firstName: string, lastName: string, status: string } | undefined;
      
      let customerId: string;
      
      if (existingCustomer) {
        // Customer exists - update their record
        customerId = existingCustomer.id;
        
        // Update their last contact date and increment inquiry count
        db.prepare(`
          UPDATE customers
          SET lastContactDate = ?, totalInquiries = totalInquiries + 1, updatedAt = ?, assignedTo = ?
          WHERE id = ?
        `).run(new Date().toISOString(), new Date().toISOString(), salesPersonEmail, customerId);
        
        // Update customer status
        // updateCustomerStatus(customerId);
      } else {
        // Create new customer record
        customerId = Math.random().toString(36).slice(2, 15);
        const now = new Date().toISOString();
        
        // Extract name from email if possible
        const emailName = inquiry.customerEmail.split('@')[0].replace(/[._]/g, ' ');
        const firstName = emailName.split(' ')[0] || 'Unknown';
        const lastName = emailName.split(' ').slice(1).join(' ') || 'Customer';
        
        db.prepare(`
          INSERT INTO customers (
            id, email, firstName, lastName, phone, companyName,
            billingAddress, shippingAddress, source, sourceId,
            createdAt, updatedAt, lastContactDate, totalInquiries, totalOrders, totalSpent,
            status, tags, notes, assignedTo
          ) VALUES (?, ?, ?, ?, '', '', '', '', 'website', ?, ?, ?, ?, 1, 0, 0, 'contact', '[]', '[]', ?)
        `).run(customerId, inquiry.customerEmail, firstName, lastName, customerId, now, now, now, salesPersonEmail);
      }
      
      // Update inquiry status to active and assign owner
      db.prepare('UPDATE inquiries SET status = ? WHERE id = ?').run("active", id);
      
    } else if (action === "not_relevant") {
      if (inquiry.status !== "new" && !(inquiry.status === "active" && !inquiry.assignedOwner)) {
        return NextResponse.json({ error: "Can only mark 'new' or unassigned 'active' inquiries as not relevant" }, { status: 400 });
      }
      
      // Mark inquiry as not relevant (no customer record created)
      db.prepare('UPDATE inquiries SET status = ? WHERE id = ?').run("not_relevant", id);
      
    } else {
      return NextResponse.json({ error: "Invalid action. Use 'take' or 'not_relevant'" }, { status: 400 });
    }
    
    // Return updated inquiry with assigned owner from customer record
    const updatedInquiry = db.prepare(`
      SELECT i.*, c.assignedTo as assignedOwner
      FROM inquiries i
      LEFT JOIN customers c ON LOWER(i.customerEmail) = LOWER(c.email)
      WHERE i.id = ?
    `).get(id) as Inquiry;
    
    return NextResponse.json(updatedInquiry);
  } catch (error) {
    console.error('Error processing inquiry action:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, status } = body;
    
    if (!id || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    if (!["active", "closed"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    
    // Update inquiry status
    const result = db.prepare('UPDATE inquiries SET status = ? WHERE id = ?').run(status, id);
    
    if (result.changes === 0) {
      return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
    }
    
    // Return updated inquiry with assigned owner from customer record
    const updatedInquiry = db.prepare(`
      SELECT i.*, c.assignedTo as assignedOwner
      FROM inquiries i
      LEFT JOIN customers c ON LOWER(i.customerEmail) = LOWER(c.email)
      WHERE i.id = ?
    `).get(id) as Inquiry;
    
    return NextResponse.json(updatedInquiry);
  } catch (error) {
    console.error('Error updating inquiry status:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}



