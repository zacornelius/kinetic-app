const fs = require('fs');
const { execSync } = require('child_process');

// Read the CSV file
const csvContent = fs.readFileSync('Kinetic Customers.csv', 'utf8');

// Parse CSV properly handling multi-line messages
function parseCSV(content) {
  const lines = content.split('\n');
  const records = [];
  let currentRecord = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if we're starting a new record (starts with country code)
    if (line.match(/^[A-Z][A-Z],/)) {
      // If we have a current record, process it
      if (currentRecord) {
        records.push(parseRecord(currentRecord));
      }
      currentRecord = line;
    } else if (currentRecord) {
      // This is a continuation of the current record
      currentRecord += '\n' + line;
    }
  }
  
  // Process the last record
  if (currentRecord) {
    records.push(parseRecord(currentRecord));
  }
  
  return records;
}

function parseRecord(record) {
  const fields = [];
  let currentField = '';
  let inQuotes = false;
  let quoteChar = '';
  
  for (let i = 0; i < record.length; i++) {
    const char = record[i];
    
    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = '';
    } else if (char === ',' && !inQuotes) {
      fields.push(currentField.trim());
      currentField = '';
    } else {
      currentField += char;
    }
  }
  
  // Add the last field
  fields.push(currentField.trim());
  
  return {
    countryCode: fields[0] || '',
    name: fields[1] || '',
    reason: fields[2] || '',
    phone: fields[3] || '',
    email: fields[4] || '',
    type: fields[5] || '',
    numberOfDogs: fields[6] || '',
    message: fields[7] || '',
    owner: fields[8] || '',
    status: fields[9] || '',
    date: fields[10] || '',
    id: fields[11] || '',
    notes: fields[12] || '',
    newNote: fields[13] || ''
  };
}

// Parse the CSV
const customers = parseCSV(csvContent);
console.log(`Found ${customers.length} customer records`);

// Filter out records without email
const validCustomers = customers.filter(c => c.email && c.email.includes('@'));
console.log(`Found ${validCustomers.length} customers with valid emails`);

// Import to database using a simpler approach
let imported = 0;
let skipped = 0;

for (const customer of validCustomers) {
  try {
    // Check if customer already exists
    const existing = execSync(`sqlite3 kinetic.db "SELECT id FROM customer_profiles WHERE email = '${customer.email.replace(/'/g, "''")}'"`, { encoding: 'utf8' }).trim();
    
    if (existing) {
      skipped++;
      continue;
    }
    
    // Generate customer ID
    const customerId = Math.random().toString(36).slice(2, 15);
    const now = new Date().toISOString();
    
    // Extract first and last name
    const nameParts = customer.name.split(' ');
    const firstName = nameParts[0] || 'Unknown';
    const lastName = nameParts.slice(1).join(' ') || 'Customer';
    
    // Create simple tags string (not JSON array)
    const tags = [];
    if (customer.type) tags.push(customer.type);
    if (customer.reason) tags.push(customer.reason);
    if (customer.numberOfDogs) tags.push(`${customer.numberOfDogs} dogs`);
    if (customer.countryCode) tags.push(customer.countryCode);
    const tagsString = tags.join(', ');
    
    // Create simple notes string (not JSON array)
    const notes = [];
    if (customer.message) notes.push(customer.message);
    if (customer.notes) notes.push(customer.notes);
    if (customer.newNote) notes.push(customer.newNote);
    const notesString = notes.join(' | ');
    
    // Determine status
    let customerStatus = 'prospect';
    if (customer.status && customer.status.toLowerCase().includes('customer')) {
      customerStatus = 'customer';
    } else if (customer.status && customer.status.toLowerCase().includes('active')) {
      customerStatus = 'active';
    }
    
    // Use a temporary file to avoid shell escaping issues
    const tempFile = `/tmp/customer_${customerId}.sql`;
    const sql = `
      INSERT INTO customer_profiles (
        id, email, firstName, lastName, phone, companyName,
        billingAddress, shippingAddress, source, sourceId,
        createdAt, updatedAt, lastContactDate, totalInquiries, totalOrders, totalSpent,
        status, tags, notes, assignedTo, priority
      ) VALUES (
        '${customerId}', 
        '${customer.email.replace(/'/g, "''")}', 
        '${firstName.replace(/'/g, "''")}', 
        '${lastName.replace(/'/g, "''")}', 
        '${customer.phone.replace(/'/g, "''")}', 
        '${customer.name.replace(/'/g, "''")}', 
        '', 
        '', 
        'website', 
        '${customerId}', 
        '${now}', 
        '${now}', 
        '${now}', 
        1, 
        0, 
        0, 
        '${customerStatus}', 
        '${tagsString.replace(/'/g, "''")}', 
        '${notesString.replace(/'/g, "''")}', 
        '${customer.owner.replace(/'/g, "''")}', 
        'normal'
      );
    `;
    
    fs.writeFileSync(tempFile, sql);
    execSync(`sqlite3 kinetic.db < ${tempFile}`);
    fs.unlinkSync(tempFile);
    
    imported++;
    
    if (imported % 100 === 0) {
      console.log(`Imported ${imported} customers...`);
    }
    
  } catch (error) {
    console.error(`Error importing customer ${customer.email}:`, error.message);
    skipped++;
  }
}

console.log(`\nImport complete!`);
console.log(`Imported: ${imported} customers`);
console.log(`Skipped: ${skipped} customers`);


