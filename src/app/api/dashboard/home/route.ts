import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');
    const view = searchParams.get('view') || 'personal';

    if (!userEmail) {
      return NextResponse.json({ error: 'userEmail is required' }, { status: 400 });
    }

    // Get all data in parallel
    const [
      inquiriesResult,
      ordersResult,
      usersResult,
      quotesResult,
      salesResult,
      topCustomersResult,
      lineItemsResult
    ] = await Promise.all([
      // Inquiries
      db.all(`
        SELECT 
          i.*,
          c.firstname as customer_firstname,
          c.lastname as customer_lastname,
          c.assignedto as assigned_owner,
          c.customertype as customer_type,
          c.customercategory as customer_category
        FROM inquiries i
        LEFT JOIN customers c ON i.customeremail = c.email
        ORDER BY i.createdat DESC
      `),
      
      // Orders
      db.all(`
        SELECT
          o.id,
          o.createdat as "createdAt",
          o.ordernumber as "orderNumber",
          o.customeremail as "customerEmail",
          o.customername as "customerName",
          o.totalamount as "totalAmount",
          o.currency,
          o.status,
          o.shippingaddress as "shippingAddress",
          o.trackingnumber as "trackingNumber",
          o.notes,
          o.owneremail as "ownerEmail",
          o.lineitems as "lineItems",
          c.assignedto as "assignedOwner",
          o.source,
          o.sourceid as "sourceId",
          COALESCE(o.business_unit, c.business_unit) as "businessUnit",
          CASE
            WHEN o.notes LIKE '%PO Number:%' THEN
              TRIM(SUBSTRING(o.notes FROM 'PO Number: ([^\n]+)'))
            ELSE NULL
          END as "poNumber",
          CASE
            WHEN o.notes LIKE '%Invoice Email:%' THEN
              TRIM(SUBSTRING(o.notes FROM 'Invoice Email: ([^\n]+)'))
            ELSE NULL
          END as "invoiceEmail"
        FROM all_orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        ORDER BY o.createdat DESC
      `),
      
      // Users
      db.all(`
        SELECT id, email, firstname as "firstName", lastname as "lastName", createdat as "createdAt"
        FROM users
        ORDER BY firstname, lastname
      `),
      
      // Quotes for user
      db.all(`
        SELECT 
          q.*,
          c.firstname as customer_firstname,
          c.lastname as customer_lastname
        FROM quotes q
        LEFT JOIN customers c ON q.customeremail = c.email
        WHERE q.assignedto = $1
        ORDER BY q.createdat DESC
      `, [userEmail]),
      
      // Sales dashboard data
      db.all(`
        SELECT 
          DATE_TRUNC('month', o.createdat) as month,
          COUNT(*) as order_count,
          SUM(o.totalamount) as total_revenue,
          COALESCE(o.business_unit, c.business_unit) as business_unit
        FROM all_orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.owneremail = $1
        GROUP BY DATE_TRUNC('month', o.createdat), COALESCE(o.business_unit, c.business_unit)
        ORDER BY month DESC
      `, [userEmail]),
      
      // Top customers
      db.all(`
        SELECT 
          c.email,
          c.firstname,
          c.lastname,
          c.companyname,
          COUNT(o.id) as order_count,
          SUM(o.totalamount) as total_spent,
          MAX(o.createdat) as last_order_date
        FROM customers c
        LEFT JOIN all_orders o ON c.id = o.customer_id
        WHERE o.owneremail = $1
        GROUP BY c.id, c.email, c.firstname, c.lastname, c.companyname
        HAVING COUNT(o.id) > 0
        ORDER BY total_spent DESC
        LIMIT 50
      `, [userEmail]),
      
      // Line items
      db.all(`
        SELECT 
          o.id as order_id,
          o.ordernumber as orderNumber,
          o.customeremail as customerEmail,
          o.createdat as createdAt,
          li.*
        FROM all_orders o
        CROSS JOIN LATERAL jsonb_to_recordset(o.lineitems::jsonb) AS li(
          title text,
          quantity numeric,
          price numeric,
          totalPrice numeric
        )
        ORDER BY o.createdat DESC
      `)
    ]);

    // Get customers using the same query as consolidated API
    const customersResult = await db.all(`
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
      ORDER BY c.lastcontactdate DESC
      LIMIT 1000
    `);
    
    const customers = customersResult.map((customer: any) => ({
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      companyName: customer.companyName,
      billingAddress: customer.billingAddress,
      shippingAddress: customer.shippingAddress || customer.shipping_address || '',
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      lastContactDate: customer.lastContactDate,
      totalInquiries: customer.totalInquiries,
      totalOrders: customer.totalOrders,
      totalSpent: customer.totalSpent,
      status: customer.status,
      tags: customer.tags,
      notes: customer.notes,
      assignedTo: customer.assignedTo,
      source: customer.source,
      businessUnit: customer.businessUnit,
      customerType: customer.customerType,
      customerCategory: customer.customerCategory,
      calculatedTotalSpent: customer.calculatedTotalSpent,
      calculatedTotalOrders: customer.calculatedTotalOrders,
      firstOrderDate: customer.first_order_date,
      lastOrderDate: customer.last_order_date
    }));

    // Process inquiries data
    const inquiries = inquiriesResult.map((inquiry: any) => ({
      id: inquiry.id,
      createdAt: inquiry.createdat,
      category: inquiry.category,
      originalMessage: inquiry.originalmessage,
      customerEmail: inquiry.customeremail,
      customerName: inquiry.customername,
      assignedOwner: inquiry.assigned_owner,
      customerType: inquiry.customer_type,
      customerCategory: inquiry.customer_category,
      status: inquiry.status,
      priority: inquiry.priority,
      followUpDate: inquiry.followupdate,
      notes: inquiry.notes
    }));

    // Process orders data
    const orders = ordersResult.map((order: any) => ({
      id: order.id,
      createdAt: order.createdAt,
      orderNumber: order.orderNumber,
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      totalAmount: order.totalAmount,
      currency: order.currency,
      status: order.status,
      shippingAddress: order.shippingAddress,
      trackingNumber: order.trackingNumber,
      notes: order.notes,
      ownerEmail: order.ownerEmail,
      lineItems: order.lineItems,
      assignedOwner: order.assignedOwner,
      source: order.source,
      sourceId: order.sourceId,
      businessUnit: order.businessUnit,
      poNumber: order.poNumber,
      invoiceEmail: order.invoiceEmail
    }));

    // Process users data
    const users = usersResult.map((user: any) => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt
    }));

    // Process quotes data
    const quotes = quotesResult.map((quote: any) => ({
      id: quote.id,
      quoteId: quote.quoteid,
      shopifyDraftOrderId: quote.shopifydraftorderid,
      customerId: quote.customerid,
      customerEmail: quote.customeremail,
      invoiceEmail: quote.invoiceemail,
      poNumber: quote.ponumber,
      status: quote.status,
      totalAmount: quote.totalamount,
      palletItems: quote.palletitems,
      customMessage: quote.custommessage,
      createdAt: quote.createdat,
      updatedAt: quote.updatedat,
      customerFirstName: quote.customer_firstname,
      customerLastName: quote.customer_lastname,
      customerPhone: quote.customerphone,
      customerCompany: quote.customercompany
    }));

    // Process sales data
    const salesData = {
      personal: salesResult.reduce((acc: any, row: any) => {
        const month = row.month;
        if (!acc[month]) {
          acc[month] = { orderCount: 0, totalRevenue: 0, businessUnits: {} };
        }
        acc[month].orderCount += parseInt(row.order_count);
        acc[month].totalRevenue += parseFloat(row.total_revenue);
        acc[month].businessUnits[row.business_unit] = {
          orderCount: parseInt(row.order_count),
          totalRevenue: parseFloat(row.total_revenue)
        };
        return acc;
      }, {}),
      monthlyPallets: [] // Will be calculated on frontend
    };

    // Process top customers data
    const topCustomers = topCustomersResult.map((customer: any) => ({
      email: customer.email,
      firstName: customer.firstname,
      lastName: customer.lastname,
      companyName: customer.companyname,
      orderCount: parseInt(customer.order_count),
      totalSpent: parseFloat(customer.total_spent),
      lastOrderDate: customer.last_order_date
    }));

    // Process line items data
    const lineItems = lineItemsResult.map((item: any) => ({
      orderId: item.order_id,
      orderNumber: item.orderNumber,
      customerEmail: item.customerEmail,
      createdAt: item.createdAt,
      title: item.title,
      quantity: item.quantity,
      price: item.price,
      totalPrice: item.totalPrice
    }));

    // Customers data is already processed by the consolidated API

    // Calculate summary statistics
    const summary = {
      totalInquiries: inquiries.length,
      totalOrders: orders.length,
      totalCustomers: customers.length,
      totalQuotes: quotes.length,
      totalUsers: users.length,
      totalLineItems: lineItems.length
    };

    return NextResponse.json({
      success: true,
      data: {
        inquiries,
        orders,
        users,
        quotes,
        salesData,
        topCustomers,
        lineItems,
        customers,
        summary
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Home dashboard API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch home dashboard data', 
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}
