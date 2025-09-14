import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';

// Consolidated Customer API - Single endpoint for all customer operations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    const customerId = searchParams.get('id');
    const search = searchParams.get('search') || '';
    const include = searchParams.get('include')?.split(',') || ['basic'];
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Parse filters from JSON string
    let filters = {};
    try {
      const filtersParam = searchParams.get('filters');
      if (filtersParam) {
        filters = JSON.parse(filtersParam);
      }
    } catch (e) {
      console.warn('Invalid filters JSON:', e);
    }

    switch (action) {
      case 'list':
        return await getCustomerList(include, limit, offset, filters, search);
      case 'search':
        return await searchCustomers(include, search, limit);
      case 'details':
        if (!customerId) {
          return NextResponse.json({ error: 'Customer ID required for details' }, { status: 400 });
        }
        return await getCustomerDetails(customerId, include);
      case 'timeline':
        if (!customerId) {
          return NextResponse.json({ error: 'Customer ID required for timeline' }, { status: 400 });
        }
        return await getCustomerTimeline(customerId);
      case 'counts':
        return await getCustomerCounts(filters);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in consolidated customer API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer data' },
      { status: 500 }
    );
  }
}

// Get customer list with optional includes
async function getCustomerList(include: string[], limit: number, offset: number, filters: any, search: string) {
  let whereConditions = [];
  let params = [];

  // Build where conditions based on filters
  if (search) {
    if (search.length > 5 && !search.includes('@') && !search.includes(' ') && /^[a-zA-Z0-9]+$/.test(search)) {
      whereConditions.push('c.id = ?');
      params.push(search);
    } else {
      const searchWords = search.trim().split(/\s+/);
      if (searchWords.length === 1) {
        whereConditions.push(`(
          LOWER(c.email) LIKE ? OR 
          LOWER(c.firstname) LIKE ? OR 
          LOWER(c.lastname) LIKE ? OR 
          LOWER(c.companyname) LIKE ? OR
          LOWER(c.phone) LIKE ?
        )`);
        const searchTerm = `%${searchWords[0].toLowerCase()}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      } else {
        const wordConditions = searchWords.map(word => {
          const wordTerm = `%${word.toLowerCase()}%`;
          return `(
            LOWER(c.email) LIKE ? OR 
            LOWER(c.firstname) LIKE ? OR 
            LOWER(c.lastname) LIKE ? OR 
            LOWER(c.companyname) LIKE ? OR
            LOWER(c.phone) LIKE ?
          )`;
        });
        whereConditions.push(`(${wordConditions.join(' AND ')})`);
        searchWords.forEach(word => {
          const wordTerm = `%${word.toLowerCase()}%`;
          params.push(wordTerm, wordTerm, wordTerm, wordTerm, wordTerm);
        });
      }
    }
  }

  if (filters.status) {
    if (filters.status === 'customer' || filters.status === 'contact') {
      whereConditions.push('c.customertype = ?');
      params.push(filters.status.charAt(0).toUpperCase() + filters.status.slice(1));
    } else {
      whereConditions.push('c.status = ?');
      params.push(filters.status);
    }
  }

  if (filters.assignedTo) {
    whereConditions.push('c.assignedto = ?');
    params.push(filters.assignedTo);
  }

  if (filters.businessUnit) {
    whereConditions.push('c.business_unit = ?');
    params.push(filters.businessUnit);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  // Build the main query
  const query = `
    SELECT 
      c.id, c.email, c.firstname as "firstName", c.lastname as "lastName", c.phone, 
      c.companyname as "companyName", c.billingaddress as "billingAddress", 
      c.shippingaddress as "shippingAddress", c.createdat as "createdAt", 
      c.updatedat as "updatedAt", c.lastcontactdate as "lastContactDate",
      c.totalinquiries as "totalInquiries", c.totalorders as "totalOrders", 
      c.totalspent as "totalSpent", c.status, c.tags, c.notes, 
      c.assignedto as "assignedTo", c.source, c.business_unit as "businessUnit",
      c.customertype as "customerType", c.customercategory as "customerCategory",
      COALESCE(order_stats.total_spent, 0) as "calculatedTotalSpent",
      COALESCE(order_stats.total_orders, 0) as "calculatedTotalOrders",
      order_stats.first_order_date,
      order_stats.last_order_date,
      latest_orders.shipping_address
    FROM customers c
    LEFT JOIN (
      SELECT 
        customer_id,
        SUM(totalamount) as total_spent,
        COUNT(DISTINCT ordernumber) as total_orders,
        MIN(createdat) as first_order_date,
        MAX(createdat) as last_order_date
      FROM all_orders
      WHERE customer_id IS NOT NULL
      GROUP BY customer_id
    ) order_stats ON c.id = order_stats.customer_id
    LEFT JOIN (
      SELECT DISTINCT ON (customer_id) 
        customer_id, 
        shippingaddress as shipping_address
      FROM all_orders 
      WHERE customer_id IS NOT NULL AND shippingaddress IS NOT NULL
      ORDER BY customer_id, createdat DESC
    ) latest_orders ON c.id = latest_orders.customer_id
    ${whereClause}
    ORDER BY COALESCE(order_stats.total_spent, 0) DESC, c.updatedat DESC
    LIMIT ? OFFSET ?
  `;

  const queryParams = [...params, limit, offset];
  const customers = await db.prepare(query).all(...queryParams);

  // Process customers
  const processedCustomers = customers.map(customer => ({
    id: customer.id,
    email: customer.email,
    firstName: customer.firstName || '',
    lastName: customer.lastName || '',
    phone: customer.phone || '',
    companyName: customer.companyName || '',
    billingAddress: customer.billingAddress || '',
    shippingAddress: customer.shippingAddress || customer.shipping_address || '',
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
    lastContactDate: customer.lastContactDate || null,
    totalInquiries: parseInt(customer.totalInquiries) || 0,
    totalOrders: parseInt(customer.calculatedTotalOrders) || 0,
    totalSpent: parseFloat(customer.calculatedTotalSpent) || 0,
    lifetimeValue: parseFloat(customer.calculatedTotalSpent) || 0,
    status: customer.status,
    tags: customer.tags ? (customer.tags.startsWith('[') ? JSON.parse(customer.tags) : [customer.tags]) : [],
    notes: customer.notes ? (customer.notes.startsWith('[') ? JSON.parse(customer.notes) : [customer.notes]) : [],
    assignedTo: customer.assignedTo || null,
    source: customer.source || 'manual',
    businessUnit: customer.businessUnit || 'pallet',
    customerType: customer.customerType || null,
    customerCategory: customer.customerCategory || null,
    firstOrderDate: customer.first_order_date || null,
    lastOrderDate: customer.last_order_date || null
  }));

  // Get total count for pagination
  const totalQuery = `
    SELECT COUNT(*) as total 
    FROM customers c
    LEFT JOIN (
      SELECT DISTINCT customer_id
      FROM all_orders
      WHERE customer_id IS NOT NULL
    ) order_stats ON c.id = order_stats.customer_id
    ${whereClause}
  `;
  
  const total = (await db.prepare(totalQuery).get(...params)).total;

  return NextResponse.json({
    customers: processedCustomers,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    }
  });
}

// Search customers (alias for list with search)
async function searchCustomers(include: string[], search: string, limit: number) {
  return await getCustomerList(include, limit, 0, {}, search);
}

// Get detailed customer information with timeline
async function getCustomerDetails(customerId: string, include: string[]) {
  // Get basic customer info
  const customerQuery = `
    SELECT 
      c.id, c.email, c.firstname as "firstName", c.lastname as "lastName", c.phone, 
      c.companyname as "companyName", c.billingaddress as "billingAddress", 
      c.shippingaddress as "shippingAddress", c.createdat as "createdAt", 
      c.updatedat as "updatedAt", c.lastcontactdate as "lastContactDate",
      c.totalinquiries as "totalInquiries", c.totalorders as "totalOrders", 
      c.totalspent as "totalSpent", c.status, c.tags, c.notes, 
      c.assignedto as "assignedTo", c.source, c.business_unit as "businessUnit",
      c.customertype as "customerType", c.customercategory as "customerCategory",
      COALESCE(order_stats.total_spent, 0) as "calculatedTotalSpent",
      COALESCE(order_stats.total_orders, 0) as "calculatedTotalOrders",
      order_stats.first_order_date,
      order_stats.last_order_date,
      latest_orders.shipping_address
    FROM customers c
    LEFT JOIN (
      SELECT 
        customer_id,
        SUM(totalamount) as total_spent,
        COUNT(DISTINCT ordernumber) as total_orders,
        MIN(createdat) as first_order_date,
        MAX(createdat) as last_order_date
      FROM all_orders
      WHERE customer_id = ?
      GROUP BY customer_id
    ) order_stats ON c.id = order_stats.customer_id
    LEFT JOIN (
      SELECT DISTINCT ON (customer_id) 
        customer_id, 
        shippingaddress as shipping_address
      FROM all_orders 
      WHERE customer_id = ? AND shippingaddress IS NOT NULL
      ORDER BY customer_id, createdat DESC
    ) latest_orders ON c.id = latest_orders.customer_id
    WHERE c.id = ?
  `;

  const customer = await db.prepare(customerQuery).get(customerId, customerId, customerId);

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  const processedCustomer = {
    id: customer.id,
    email: customer.email,
    firstName: customer.firstName || '',
    lastName: customer.lastName || '',
    phone: customer.phone || '',
    companyName: customer.companyName || '',
    billingAddress: customer.billingAddress || '',
    shippingAddress: customer.shippingAddress || customer.shipping_address || '',
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
    lastContactDate: customer.lastContactDate || null,
    totalInquiries: parseInt(customer.totalInquiries) || 0,
    totalOrders: parseInt(customer.calculatedTotalOrders) || 0,
    totalSpent: parseFloat(customer.calculatedTotalSpent) || 0,
    lifetimeValue: parseFloat(customer.calculatedTotalSpent) || 0,
    status: customer.status,
    tags: customer.tags ? (customer.tags.startsWith('[') ? JSON.parse(customer.tags) : [customer.tags]) : [],
    notes: customer.notes ? (customer.notes.startsWith('[') ? JSON.parse(customer.notes) : [customer.notes]) : [],
    assignedTo: customer.assignedTo || null,
    source: customer.source || 'manual',
    businessUnit: customer.businessUnit || 'pallet',
    customerType: customer.customerType || null,
    customerCategory: customer.customerCategory || null,
    firstOrderDate: customer.first_order_date || null,
    lastOrderDate: customer.last_order_date || null
  };

  // Get timeline if requested
  if (include.includes('timeline') || include.includes('full')) {
    const timeline = await getCustomerTimelineData(customerId);
    processedCustomer.timeline = timeline;
  }

  // Get orders if requested
  if (include.includes('orders') || include.includes('full')) {
    const orders = await getCustomerOrders(customerId);
    processedCustomer.orders = orders;
  }

  // Get inquiries if requested
  if (include.includes('inquiries') || include.includes('full')) {
    const inquiries = await getCustomerInquiries(customerId);
    processedCustomer.inquiries = inquiries;
  }

  // Get notes if requested
  if (include.includes('notes') || include.includes('full')) {
    const notes = await getCustomerNotes(customerId);
    processedCustomer.notes = notes;
  }

  // Get quotes if requested
  if (include.includes('quotes') || include.includes('full')) {
    const quotes = await getCustomerQuotes(customerId);
    processedCustomer.quotes = quotes;
  }

  return NextResponse.json({ customer: processedCustomer });
}

// Get customer timeline (sequential view of all related data)
async function getCustomerTimeline(customerId: string) {
  const timeline = await getCustomerTimelineData(customerId);
  return NextResponse.json({ timeline });
}

// Helper function to get timeline data
async function getCustomerTimelineData(customerId: string) {
  // Get orders
  const orders = await db.prepare(`
    SELECT 
      'order' as type,
      id,
      'Order #' || ordernumber as subject,
      'Order #' || ordernumber as content,
      createdat as "createdAt",
      ordernumber as "orderNumber",
      totalamount as "totalAmount",
      status,
      source,
      lineitems as "lineItems"
    FROM all_orders 
    WHERE customer_id = ?
    ORDER BY createdat DESC
  `).all(customerId);

  // Get inquiries
  const inquiries = await db.prepare(`
    SELECT 
      'inquiry' as type,
      id,
      'Inquiry' as subject,
      message as content,
      createdat as "createdAt",
      category,
      status as "inquiryStatus"
    FROM inquiries 
    WHERE customer_id = ?
    ORDER BY createdat DESC
  `).all(customerId);

  // Get notes
  const notes = await db.prepare(`
    SELECT 
      'note' as type,
      cn.id,
      'Note' as subject,
      cn.note as content,
      cn.createdat as "createdAt",
      cn.authoremail as "authorEmail",
      cn.type as "noteType",
      cn.isprivate as "isPrivate"
    FROM customer_notes cn
    WHERE cn.customerid = ?
    ORDER BY cn.createdat DESC
  `).all(customerId);

  // Get quotes
  const quotes = await db.prepare(`
    SELECT 
      'quote' as type,
      id,
      'Quote ' || quote_id as subject,
      'Quote ' || quote_id as content,
      created_at as "createdAt",
      quote_id as "quoteId",
      total_amount as "totalAmount",
      status,
      po_number as "poNumber",
      invoice_email as "invoiceEmail"
    FROM quotes 
    WHERE customer_id = ?
    ORDER BY created_at DESC
  `).all(customerId);

  // Combine and sort all timeline items
  const allItems = [
    ...orders.map(o => ({
      id: o.id,
      type: o.type,
      subject: o.subject,
      content: o.content,
      createdAt: o.createdAt,
      metadata: {
        orderNumber: o.orderNumber,
        totalAmount: parseFloat(o.totalAmount),
        status: o.status,
        source: o.source,
        lineItems: o.lineItems ? JSON.parse(o.lineItems) : []
      }
    })),
    ...inquiries.map(i => ({
      id: i.id,
      type: i.type,
      subject: i.subject,
      content: i.content,
      createdAt: i.createdAt,
      metadata: {
        category: i.category,
        inquiryStatus: i.inquiryStatus
      }
    })),
    ...notes.map(n => ({
      id: n.id,
      type: n.type,
      subject: n.subject,
      content: n.content,
      createdAt: n.createdAt,
      metadata: {
        noteType: n.noteType,
        isPrivate: n.isPrivate
      }
    })),
    ...quotes.map(q => ({
      id: q.id,
      type: q.type,
      subject: q.subject,
      content: q.content,
      createdAt: q.createdAt,
      metadata: {
        quoteId: q.quoteId,
        totalAmount: parseFloat(q.totalAmount),
        status: q.status,
        poNumber: q.poNumber,
        invoiceEmail: q.invoiceEmail
      }
    }))
  ];

  // Sort by creation date (newest first)
  allItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return allItems;
}

// Helper functions for specific data types
async function getCustomerOrders(customerId: string) {
  const orders = await db.prepare(`
    SELECT 
      id, ordernumber as "orderNumber", totalamount as "totalAmount", 
      status, createdat as "createdAt", source, lineitems as "lineItems"
    FROM all_orders 
    WHERE customer_id = ?
    ORDER BY createdat DESC
  `).all(customerId);

  return orders.map(order => ({
    ...order,
    totalAmount: parseFloat(order.totalAmount),
    lineItems: order.lineItems ? JSON.parse(order.lineItems) : []
  }));
}

async function getCustomerInquiries(customerId: string) {
  return await db.prepare(`
    SELECT 
      id, message as content, createdat as "createdAt", 
      category, status
    FROM inquiries 
    WHERE customer_id = ?
    ORDER BY createdat DESC
  `).all(customerId);
}

async function getCustomerNotes(customerId: string) {
  return await db.prepare(`
    SELECT 
      cn.id, cn.note as content, cn.createdat as "createdAt",
      cn.type, cn.isprivate as "isPrivate", cn.authoremail as "authorEmail"
    FROM customer_notes cn
    WHERE cn.customerid = ?
    ORDER BY cn.createdat DESC
  `).all(customerId);
}

async function getCustomerQuotes(customerId: string) {
  return await db.prepare(`
    SELECT 
      id, quote_id as "quoteId", total_amount as "totalAmount",
      status, created_at as "createdAt", po_number as "poNumber",
      invoice_email as "invoiceEmail"
    FROM quotes 
    WHERE customer_id = ?
    ORDER BY created_at DESC
  `).all(customerId);
}

// Get customer counts
async function getCustomerCounts(filters: any) {
  let whereConditions = [];
  let params = [];

  if (filters.assignedTo) {
    whereConditions.push('assignedto = ?');
    params.push(filters.assignedTo);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  const counts = {
    my_customers: 0,
    my_contacts: 0,
    all: 0
  };

  // My Customers: assigned to user AND has orders
  const myCustomersQuery = `SELECT COUNT(*) as count FROM customers ${whereClause} AND totalorders > 0`;
  counts.my_customers = (await db.prepare(myCustomersQuery).get(...params)).count;

  // My Contacts: assigned to user AND has inquiries but NO orders
  const myContactsQuery = `SELECT COUNT(*) as count FROM customers ${whereClause} AND totalinquiries > 0 AND totalorders = 0`;
  counts.my_contacts = (await db.prepare(myContactsQuery).get(...params)).count;

  // All Customers: total count
  const allCustomersQuery = `SELECT COUNT(*) as count FROM customers ${whereClause}`;
  counts.all = (await db.prepare(allCustomersQuery).get(...params)).count;

  return NextResponse.json({ counts });
}

