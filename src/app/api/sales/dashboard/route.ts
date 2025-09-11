import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');
    const view = searchParams.get('view') || 'personal'; // 'personal' or 'leaderboard'

    if (!userEmail) {
      return NextResponse.json({ error: 'User email is required' }, { status: 400 });
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Calculate date ranges
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    // Twelve months ago should be October 2024 (12 months before September 2025)
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));
    const thisMonthStart = new Date(currentYear, currentMonth - 1, 1);

    if (view === 'leaderboard') {
      // Leaderboard view - show all sales team members (including Lindsey for distributor/digital)
      // Use line items data for consistent results - fix timestamp casting for UNION and avoid timezone issues
      const orders = await db.prepare(`
        SELECT 
          id,
          ordernumber as "orderNumber",
          customeremail as "customerEmail",
          customername as "customerName",
          lineitems as "lineItems",
          business_unit as "businessUnit",
          totalamount as "totalAmount",
          createdat as "createdAt"
        FROM (
          SELECT id, ordernumber, customeremail, customername, lineitems, business_unit, totalamount, createdat::timestamp as createdat FROM shopify_orders
          UNION ALL
          SELECT id, ordernumber, customeremail, customername, lineitems, business_unit, totalamount, createdat::timestamp as createdat FROM distributor_orders
          UNION ALL
          SELECT id, ordernumber, customeremail, customername, lineitems, business_unit, totalamount, createdat::timestamp as createdat FROM digital_orders
        ) o
        WHERE lineitems IS NOT NULL AND lineitems != '' AND lineitems != 'null' AND lineitems != 'undefined'
        ORDER BY createdat DESC
      `).all();

      // Get customer assignments
      const customers = await db.prepare(`
        SELECT email, assignedto FROM customers 
        WHERE assignedto IN ('iand@kineticdogfood.com', 'ericb@kineticdogfood.com', 'Dave@kineticdogfood.com', 'lindsey@kineticdogfood.com')
      `).all();

      const customerAssignments = {};
      customers.forEach(c => {
        customerAssignments[c.email] = c.assignedto;
      });

      // Process orders and calculate metrics for each owner
      const ownerMetrics = {};
      orders.forEach(order => {
        const owner = customerAssignments[order.customerEmail];
        if (!owner) return;

        if (!ownerMetrics[owner]) {
          ownerMetrics[owner] = {
            total_orders: new Set(),
            total_sales: 0,
            this_month_orders: new Set(),
            this_month_sales: 0,
            three_month_orders: new Set(),
            three_month_sales: 0,
            six_month_orders: new Set(),
            six_month_sales: 0,
            twelve_month_orders: new Set(),
            twelve_month_sales: 0
          };
        }

        const orderDate = new Date(order.createdAt);
        const totalAmount = parseFloat(order.totalAmount) || 0;

        // Total metrics
        ownerMetrics[owner].total_orders.add(order.orderNumber);
        ownerMetrics[owner].total_sales += totalAmount;

        // This month
        if (orderDate >= thisMonthStart) {
          ownerMetrics[owner].this_month_orders.add(order.orderNumber);
          ownerMetrics[owner].this_month_sales += totalAmount;
        }

        // Three months
        if (orderDate >= threeMonthsAgo) {
          ownerMetrics[owner].three_month_orders.add(order.orderNumber);
          ownerMetrics[owner].three_month_sales += totalAmount;
        }

        // Six months
        if (orderDate >= sixMonthsAgo) {
          ownerMetrics[owner].six_month_orders.add(order.orderNumber);
          ownerMetrics[owner].six_month_sales += totalAmount;
        }

        // Twelve months
        if (orderDate >= twelveMonthsAgo) {
          ownerMetrics[owner].twelve_month_orders.add(order.orderNumber);
          ownerMetrics[owner].twelve_month_sales += totalAmount;
        }
      });

      // Convert to array format
      const leaderboard = Object.entries(ownerMetrics).map(([owner, metrics]) => ({
        owner,
        total_orders: metrics.total_orders.size,
        total_sales: metrics.total_sales,
        this_month_orders: metrics.this_month_orders.size,
        this_month_sales: metrics.this_month_sales,
        three_month_orders: metrics.three_month_orders.size,
        three_month_sales: metrics.three_month_sales,
        six_month_orders: metrics.six_month_orders.size,
        six_month_sales: metrics.six_month_sales,
        twelve_month_orders: metrics.twelve_month_orders.size,
        twelve_month_sales: metrics.twelve_month_sales
      })).sort((a, b) => b.this_month_sales - a.this_month_sales);

      // Get monthly pallet data for leaderboard (including distributor/digital orders)
      // Use the same orders data we already fetched
      const monthlyPalletsData = {};
      
      orders.forEach(order => {
        const owner = customerAssignments[order.customerEmail];
        if (!owner) return;
        
        const orderDate = new Date(order.createdAt);
        if (orderDate < twelveMonthsAgo) return;
        
        const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyPalletsData[owner]) {
          monthlyPalletsData[owner] = {};
        }
        
        if (!monthlyPalletsData[owner][monthKey]) {
          monthlyPalletsData[owner][monthKey] = new Set();
        }
        
        // Count orders (not individual line items) - all business units count as "pallets sold"
        monthlyPalletsData[owner][monthKey].add(order.orderNumber);
      });
      
      // Convert to array format
      const monthlyPallets = [];
      Object.entries(monthlyPalletsData).forEach(([owner, months]) => {
        Object.entries(months).forEach(([month, orderNumbers]) => {
          monthlyPallets.push({
            owner,
            month: `${month}-01`, // Format as YYYY-MM-DD
            pallets_sold: orderNumbers.size
          });
        });
      });
      
      monthlyPallets.sort((a, b) => {
        if (a.owner !== b.owner) return a.owner.localeCompare(b.owner);
        return a.month.localeCompare(b.month);
      });

      // For leaderboard, we'll calculate bags sold on the frontend

      return NextResponse.json({ 
        leaderboard, 
        monthlyPallets, 
        bagsSold: [] // Will be calculated on frontend
      });
    } else {
      // Personal view - show data for the logged-in user (including distributor/digital)
      // Use the same approach as leaderboard but filter for specific user - avoid timezone issues
      const orders = await db.prepare(`
        SELECT 
          id,
          ordernumber as "orderNumber",
          customeremail as "customerEmail",
          customername as "customerName",
          lineitems as "lineItems",
          business_unit as "businessUnit",
          totalamount as "totalAmount",
          createdat as "createdAt"
        FROM (
          SELECT id, ordernumber, customeremail, customername, lineitems, business_unit, totalamount, createdat::timestamp as createdat FROM shopify_orders
          UNION ALL
          SELECT id, ordernumber, customeremail, customername, lineitems, business_unit, totalamount, createdat::timestamp as createdat FROM distributor_orders
          UNION ALL
          SELECT id, ordernumber, customeremail, customername, lineitems, business_unit, totalamount, createdat::timestamp as createdat FROM digital_orders
        ) o
        WHERE lineitems IS NOT NULL AND lineitems != '' AND lineitems != 'null' AND lineitems != 'undefined'
        ORDER BY createdat DESC
      `).all();

      // Get customer assignments for the specific user
      const customers = await db.prepare(`
        SELECT email, assignedto FROM customers WHERE assignedto = $1
      `).all(userEmail);

      const customerAssignments = {};
      customers.forEach(c => {
        customerAssignments[c.email] = c.assignedto;
      });

      // Process orders and calculate metrics for the user
      const userOrders = orders.filter(order => customerAssignments[order.customerEmail] === userEmail);
      
      const personalData = {
        total_orders: new Set(),
        total_sales: 0,
        this_month_orders: new Set(),
        this_month_sales: 0,
        three_month_orders: new Set(),
        three_month_sales: 0,
        six_month_orders: new Set(),
        six_month_sales: 0,
        twelve_month_orders: new Set(),
        twelve_month_sales: 0
      };

      userOrders.forEach(order => {
        const orderDate = new Date(order.createdAt);
        const totalAmount = parseFloat(order.totalAmount) || 0;

        // Total metrics
        personalData.total_orders.add(order.orderNumber);
        personalData.total_sales += totalAmount;

        // This month
        if (orderDate >= thisMonthStart) {
          personalData.this_month_orders.add(order.orderNumber);
          personalData.this_month_sales += totalAmount;
        }

        // Three months
        if (orderDate >= threeMonthsAgo) {
          personalData.three_month_orders.add(order.orderNumber);
          personalData.three_month_sales += totalAmount;
        }

        // Six months
        if (orderDate >= sixMonthsAgo) {
          personalData.six_month_orders.add(order.orderNumber);
          personalData.six_month_sales += totalAmount;
        }

        // Twelve months
        if (orderDate >= twelveMonthsAgo) {
          personalData.twelve_month_orders.add(order.orderNumber);
          personalData.twelve_month_sales += totalAmount;
        }
      });

      // Convert to the expected format
      const personalDataFormatted = {
        total_orders: personalData.total_orders.size,
        total_sales: personalData.total_sales,
        this_month_orders: personalData.this_month_orders.size,
        this_month_sales: personalData.this_month_sales,
        three_month_orders: personalData.three_month_orders.size,
        three_month_sales: personalData.three_month_sales,
        six_month_orders: personalData.six_month_orders.size,
        six_month_sales: personalData.six_month_sales,
        twelve_month_orders: personalData.twelve_month_orders.size,
        twelve_month_sales: personalData.twelve_month_sales
      };

      // Get monthly pallet data for personal view (including distributor/digital)
      // Use the same userOrders data we already filtered
      const monthlyPalletsData = {};
      
      userOrders.forEach(order => {
        const orderDate = new Date(order.createdAt);
        if (orderDate < twelveMonthsAgo) return;
        
        const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyPalletsData[monthKey]) {
          monthlyPalletsData[monthKey] = new Set();
        }
        
        // Count orders (not individual line items) - all business units count as "pallets sold"
        monthlyPalletsData[monthKey].add(order.orderNumber);
      });
      
      // Convert to array format
      const monthlyPallets = Object.entries(monthlyPalletsData).map(([month, orderNumbers]) => ({
        month: `${month}-01`, // Format as YYYY-MM-DD
        pallets_sold: orderNumbers.size
      })).sort((a, b) => a.month.localeCompare(b.month));
      
      // Debug logging
      console.log('Monthly pallets query result:', monthlyPallets);
      console.log('Query parameters:', { userEmail, twelveMonthsAgo: twelveMonthsAgo.toISOString() });
      
      // Debug: Log successful completion of personal view
      console.log('Personal view data loaded successfully for:', userEmail);

      return NextResponse.json({ 
        personal: personalDataFormatted, 
        monthlyPallets, 
        bagsSold: 0 // Will be calculated on frontend
      });
    }
  } catch (error) {
    console.error('Sales dashboard API error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      userEmail: searchParams.get('userEmail'),
      view: searchParams.get('view')
    });
    return NextResponse.json({ error: 'Failed to fetch sales data', details: error.message }, { status: 500 });
  }
}
