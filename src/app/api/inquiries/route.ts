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
  customerCategory?: string; // Customer category from CSV data (Active Dog Owner, Trainer, etc.)
};

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as Category | null;
    
             let query = `
               SELECT DISTINCT i.id, i.createdat as "createdAt", i.category, i.customeremail as "customerEmail", i.status, i.message, i.message as "originalMessage",
                      COALESCE(c.firstname || ' ' || c.lastname, 
                        CASE 
                          WHEN i.message LIKE 'Name: %' THEN TRIM(SUBSTRING(i.message FROM 6 FOR POSITION(E'\n' IN i.message) - 6))
                          ELSE i.customeremail 
                        END) as "customerName",
                      c.assignedto as "assignedOwner",
                      i.customercategory as "customerCategory"
               FROM inquiries i 
               LEFT JOIN customers c ON LOWER(i.customeremail) = LOWER(c.email)
               WHERE i.status != 'not_relevant' AND i.status != 'closed'
               ORDER BY i.createdat DESC
             `;
    let params: any[] = [];
    
    if (category) {
      query = `
        SELECT DISTINCT i.id, i.createdat as "createdAt", i.category, i.customeremail as "customerEmail", i.status, i.message, i.message as "originalMessage",
               COALESCE(c.firstname || ' ' || c.lastname, 
                 CASE 
                   WHEN i.message LIKE 'Name: %' THEN TRIM(SUBSTRING(i.message FROM 6 FOR POSITION(E'\n' IN i.message) - 6))
                   ELSE i.customeremail 
                 END) as "customerName",
               c.assignedto as "assignedOwner",
               i.customercategory as "customerCategory"
        FROM inquiries i 
        LEFT JOIN customers c ON LOWER(i.customeremail) = LOWER(c.email)
        WHERE i.category = ? AND i.status != 'not_relevant' AND i.status != 'closed'
        ORDER BY i.createdat DESC
      `;
      params = [category];
    }
    
    const data = await db.prepare(query).all(...params) as Inquiry[];
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching inquiries:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // Add CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const body = await request.json();
    const { category, customerEmail, message, firstName, lastName, name, customerCategory } = body;
    
    if (!category || !customerEmail) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400, headers: corsHeaders });
    }
    
      // Check if customer exists
      const existingCustomer = await db.prepare(`
        SELECT id, assignedto, firstname, lastname, status FROM customers
        WHERE email = ?
      `).get(customerEmail) as { id: string, assignedto: string | null, firstname: string, lastname: string, status: string } | undefined;
    
    let assignedOwner: string | null = null;
    let status: string;
    
    if (existingCustomer && existingCustomer.assignedto) {
      // Customer exists with assigned owner - auto-assign to active and associate with customer
      assignedOwner = existingCustomer.assignedto;
      status = "active";
      
      // Update their last contact date and increment inquiry count
      await db.prepare(`
        UPDATE customers
        SET lastcontactdate = ?, totalinquiries = totalinquiries + 1, updatedat = ?
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
      INSERT INTO inquiries (id, createdat, category, customeremail, status, message, customercategory)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    // Create a meaningful default message if none provided, and append customer name if available
    const baseMessage = message || `New ${category} inquiry from ${customerEmail}`;
    const customerName = firstName && lastName ? `${firstName} ${lastName}` : name;
    const enhancedMessage = customerName ? `Name: ${customerName}\n\n${baseMessage}` : baseMessage;
    await insertInquiry.run(id, createdAt, category, customerEmail, status, enhancedMessage, customerCategory || null);
    
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
    
    return NextResponse.json(newInquiry, { status: 201, headers: corsHeaders });
  } catch (error) {
    console.error('Error creating inquiry:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, action, salesPersonEmail, status } = body;
    
    if (!id || (!action && !status)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    // Get the inquiry first without JOIN
    const inquiry = await db.prepare('SELECT * FROM inquiries WHERE id = ?').get(id) as any;
    if (!inquiry) {
      return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
    }
    
    // Get assigned owner separately
    const customer = await db.prepare('SELECT assignedto FROM customers WHERE email = ?').get(inquiry.customeremail) as any;
    inquiry.assignedOwner = customer?.assignedto || null;
    
    if (action === "take") {
      if (!salesPersonEmail) {
        return NextResponse.json({ error: "Sales person email required for taking inquiry" }, { status: 400 });
      }
      
      // Check if inquiry can be taken
      if (inquiry.status !== "new" && !(inquiry.status === "active" && (!inquiry.assignedOwner || inquiry.assignedOwner === null))) {
        return NextResponse.json({ error: "Can only take inquiries with 'new' status or unassigned 'active' status" }, { status: 400 });
      }
      
      // Check if customer exists
      const existingCustomer = await db.prepare(`
        SELECT id, assignedto, firstname, lastname, status FROM customers
        WHERE email = ?
      `).get(inquiry.customeremail) as { id: string, assignedto: string | null, firstname: string, lastname: string, status: string } | undefined;
      
      let customerId: string;
      
      if (existingCustomer) {
        // Customer exists - update their record
        customerId = existingCustomer.id;
        
        // Update their last contact date and increment inquiry count
        await db.prepare(`
          UPDATE customers
          SET lastcontactdate = ?, totalinquiries = totalinquiries + 1, updatedat = ?, assignedto = ?, customercategory = COALESCE(?, customercategory)
          WHERE id = ?
        `).run(new Date().toISOString(), new Date().toISOString(), salesPersonEmail, inquiry.customercategory || null, customerId);
        
        // Update customer status
        // updateCustomerStatus(customerId);
      } else {
        // Create new customer record
        customerId = Math.random().toString(36).slice(2, 15);
        const now = new Date().toISOString();
        
        // Extract name from email if possible
        const emailName = inquiry.customeremail.split('@')[0].replace(/[._]/g, ' ');
        const firstName = emailName.split(' ')[0] || 'Unknown';
        const lastName = emailName.split(' ').slice(1).join(' ') || 'Customer';
        
        await db.prepare(`
          INSERT INTO customers (
            id, email, firstname, lastname, phone, companyname,
            billingaddress, shippingaddress, source, sourceid,
            createdat, updatedat, lastcontactdate, totalinquiries, totalorders, totalspent,
            status, tags, notes, assignedto, customertype, customercategory
          ) VALUES (?, ?, ?, ?, '', '', '', '', 'website', ?, ?, ?, ?, 1, 0, 0, 'contact', '[]', '[]', ?, 'Contact', ?)
        `).run(customerId, inquiry.customeremail, firstName, lastName, customerId, now, now, now, salesPersonEmail, inquiry.customercategory || null);
      }
      
      // Update inquiry status to active and assign owner
      await db.prepare('UPDATE inquiries SET status = ? WHERE id = ?').run("active", id);
      
    } else if (action === "not_relevant") {
      // Check if inquiry can be marked as not relevant
      if (inquiry.status !== "new" && !(inquiry.status === "active" && (!inquiry.assignedOwner || inquiry.assignedOwner === null))) {
        return NextResponse.json({ error: "Can only mark 'new' or unassigned 'active' inquiries as not relevant" }, { status: 400 });
      }
      
      // Mark inquiry as not relevant (no customer record created)
      await db.prepare('UPDATE inquiries SET status = ? WHERE id = ?').run("not_relevant", id);
      
    } else if (status === "closed") {
      // Handle direct status update for closing inquiries
      await db.prepare('UPDATE inquiries SET status = ? WHERE id = ?').run("closed", id);
      
    } else {
      return NextResponse.json({ error: "Invalid action. Use 'take', 'not_relevant', or provide 'status'" }, { status: 400 });
    }
    
    // Return updated inquiry with assigned owner from customer record
    const updatedInquiry = await db.prepare(`
      SELECT i.*, c.assignedto as "assignedOwner"
      FROM inquiries i
      LEFT JOIN customers c ON LOWER(i.customeremail) = LOWER(c.email)
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
    const result = await db.prepare('UPDATE inquiries SET status = ? WHERE id = ?').run(status, id);
    
    if (result.changes === 0) {
      return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
    }
    
    // Return updated inquiry with assigned owner from customer record
    const updatedInquiry = await db.prepare(`
      SELECT i.*, c.assignedto as "assignedOwner"
      FROM inquiries i
      LEFT JOIN customers c ON LOWER(i.customeremail) = LOWER(c.email)
      WHERE i.id = ?
    `).get(id) as Inquiry;
    
    return NextResponse.json(updatedInquiry);
  } catch (error) {
    console.error('Error updating inquiry status:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Add OPTIONS handler for CORS preflight requests
export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}



