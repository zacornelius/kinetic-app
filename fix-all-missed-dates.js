const fs = require('fs');
const Database = require('better-sqlite3');

// Read the CSV file
const csvContent = fs.readFileSync('Kinetic Customers.csv', 'utf8');

// Split by lines but handle multi-line entries properly
const lines = csvContent.split('\n');
const customers = [];

let i = 1; // Skip header
while (i < lines.length) {
  const line = lines[i].trim();
  
  if (!line) {
    i++;
    continue;
  }
  
  // Check if this is a new entry (starts with country code)
  if (line.match(/^[A-Z]{2},/)) {
    const parts = line.split(',');
    const customer = {
      country: parts[0],
      name: parts[1],
      reason: parts[2],
      phone: parts[3],
      email: parts[4],
      type: parts[5],
      numDogs: parts[6],
      message: parts[7] || '',
      owner: '',
      status: '',
      date: '',
      id: '',
      notes: ''
    };
    
    // Check if message starts with quote (multi-line)
    let inMultiLineMessage = false;
    if (parts[7] && parts[7].startsWith('"') && !parts[7].endsWith('"')) {
      inMultiLineMessage = true;
    }
    
    // Continue reading until we find the end of this entry
    i++;
    while (i < lines.length) {
      const nextLine = lines[i].trim();
      
      if (!nextLine) {
        i++;
        continue;
      }
      
      // Check if this is the start of a new entry
      if (nextLine.match(/^[A-Z]{2},/)) {
        break;
      }
      
      if (inMultiLineMessage) {
        // Continue building the message
        customer.message += '\n' + nextLine;
        
        // Check if message ends with quote
        if (nextLine.endsWith('"')) {
          inMultiLineMessage = false;
        }
      } else {
        // This should be the continuation with owner, status, date, etc.
        const continuationParts = nextLine.split(',');
        
        // Try to extract the fields in order
        let fieldIndex = 0;
        if (customer.owner === '') customer.owner = continuationParts[fieldIndex++] || '';
        if (customer.status === '') customer.status = continuationParts[fieldIndex++] || '';
        if (customer.date === '') customer.date = continuationParts[fieldIndex++] || '';
        if (customer.id === '') customer.id = continuationParts[fieldIndex++] || '';
        if (customer.notes === '') customer.notes = continuationParts[fieldIndex++] || '';
        
        // If we have all the fields, we're done with this entry
        if (customer.owner && customer.status && customer.date && customer.id) {
          break;
        }
      }
      
      i++;
    }
    
    customers.push(customer);
  } else {
    i++;
  }
}

console.log(`Parsed ${customers.length} customer entries from CSV`);

// Connect to database
const db = new Database('kinetic.db');

// Get all inquiries that still have today's date
const today = new Date().toISOString().split('T')[0];
const inquiriesWithTodayDate = db.prepare(`
  SELECT id, customerEmail, createdAt 
  FROM inquiries 
  WHERE createdAt LIKE '${today}%'
`).all();

console.log(`Found ${inquiriesWithTodayDate.length} inquiries with today's date`);

let updatedCount = 0;
let notFoundCount = 0;

// Process each inquiry
for (const inquiry of inquiriesWithTodayDate) {
  console.log(`\nProcessing inquiry ${inquiry.id} for ${inquiry.customerEmail}`);
  
  // Find matching customer in CSV data
  const customer = customers.find(c => 
    c.email && c.email.toLowerCase() === inquiry.customerEmail.toLowerCase()
  );
  
  if (customer && customer.date) {
    console.log(`  Found customer with date: ${customer.date}`);
    
    // Parse the date
    let parsedDate;
    try {
      // Handle different date formats
      if (customer.date.includes('/')) {
        const [month, day, year] = customer.date.split('/');
        const fullYear = year.length === 2 ? `20${year}` : year;
        parsedDate = new Date(fullYear, month - 1, day);
      } else {
        parsedDate = new Date(customer.date);
      }
      
      if (isNaN(parsedDate.getTime())) {
        console.log(`  Invalid date format: ${customer.date}`);
        notFoundCount++;
        continue;
      }
      
      const isoDate = parsedDate.toISOString();
      console.log(`  Parsed date: ${isoDate}`);
      
      // Update the inquiry
      const updateInquiry = db.prepare(`
        UPDATE inquiries 
        SET createdAt = ? 
        WHERE id = ?
      `);
      
      const result = updateInquiry.run(isoDate, inquiry.id);
      console.log(`  Updated inquiry: ${result.changes} rows affected`);
      
      // Also update the customer record
      const updateCustomer = db.prepare(`
        UPDATE customers_new 
        SET inquiryDate = ? 
        WHERE email = ?
      `);
      
      const customerResult = updateCustomer.run(isoDate, inquiry.customerEmail);
      console.log(`  Updated customer: ${customerResult.changes} rows affected`);
      
      updatedCount++;
      
    } catch (error) {
      console.log(`  Error parsing date: ${error.message}`);
      notFoundCount++;
    }
  } else {
    console.log(`  No customer found or no date in CSV for ${inquiry.customerEmail}`);
    notFoundCount++;
  }
}

console.log(`\nSummary:`);
console.log(`- Updated: ${updatedCount} inquiries`);
console.log(`- Not found: ${notFoundCount} inquiries`);

// Verify the results
const remainingToday = db.prepare(`
  SELECT COUNT(*) as count 
  FROM inquiries 
  WHERE createdAt LIKE '${today}%'
`).get();

console.log(`\nRemaining inquiries with today's date: ${remainingToday.count}`);

db.close();

