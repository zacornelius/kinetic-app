import db from './database';

/**
 * Get the assigned owner for a customer by email
 */
export function getCustomerOwner(customerEmail: string): string | null {
  const customer = db.prepare('SELECT assignedTo FROM customers WHERE email = ?').get(customerEmail) as { assignedTo: string } | undefined;
  return customer?.assignedTo || null;
}

/**
 * Get the assigned owner for a customer by ID
 */
export function getCustomerOwnerById(customerId: string): string | null {
  const customer = db.prepare('SELECT assignedTo FROM customers WHERE id = ?').get(customerId) as { assignedTo: string } | undefined;
  return customer?.assignedTo || null;
}

/**
 * Assign a customer to a sales person
 */
export function assignCustomer(customerId: string, salesPersonEmail: string): boolean {
  try {
    const result = db.prepare('UPDATE customers SET assignedTo = ?, updatedAt = ? WHERE id = ?')
      .run(salesPersonEmail, new Date().toISOString(), customerId);
    return result.changes > 0;
  } catch (error) {
    console.error('Error assigning customer:', error);
    return false;
  }
}

/**
 * Get all customers assigned to a sales person
 */
export function getCustomersByOwner(salesPersonEmail: string): any[] {
  return db.prepare(`
    SELECT 
      id,
      email,
      firstName,
      lastName,
      companyName,
      status,
      totalInquiries,
      totalOrders,
      totalSpent,
      lastContactDate,
      createdAt
    FROM customers 
    WHERE assignedTo = ? 
    ORDER BY lastContactDate DESC, createdAt DESC
  `).all(salesPersonEmail);
}

/**
 * Auto-assign a customer based on previous interactions
 * Returns the email of the sales person to assign to, or null if no previous interaction
 */
export function getAutoAssignment(customerEmail: string): string | null {
  // Check if customer already has an assigned owner
  const existingOwner = getCustomerOwner(customerEmail);
  if (existingOwner) {
    return existingOwner;
  }

  // Check for previous customers with the same email who have an assigned owner
  const previousCustomer = db.prepare(`
    SELECT assignedTo 
    FROM customers
    WHERE email = ? AND assignedTo IS NOT NULL AND assignedTo != ''
    ORDER BY updatedAt DESC
    LIMIT 1
  `).get(customerEmail) as { assignedTo: string } | undefined;

  if (previousCustomer?.assignedTo) {
    return previousCustomer.assignedTo;
  }

  return null;
}

/**
 * Update customer status based on their activity
 */
export function updateCustomerStatus(customerId: string): void {
  const customer = db.prepare('SELECT totalOrders, totalInquiries FROM customers WHERE id = ?').get(customerId) as { totalOrders: number, totalInquiries: number } | undefined;
  
  if (!customer) return;

  let newStatus: string;
  if (customer.totalOrders > 0) {
    newStatus = 'customer';
  } else if (customer.totalInquiries > 0) {
    newStatus = 'contact';
  } else {
    newStatus = 'prospect';
  }

  db.prepare('UPDATE customers SET status = ?, updatedAt = ? WHERE id = ?')
    .run(newStatus, new Date().toISOString(), customerId);
}
