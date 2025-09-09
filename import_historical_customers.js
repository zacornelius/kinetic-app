const fs = require('fs');
const { execSync } = require('child_process');
const crypto = require('crypto');

// Read and parse the CSV file
function parseCSV(filename) {
  const content = fs.readFileSync(filename, 'utf8');
  const lines = content.split('\n');
  
  // Skip header lines and find data start
  let dataStartIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Customer full name,Email,Full name,Bill address,Ship address,Phone')) {
      dataStartIndex = i + 1;
      break;
    }
  }
  
  const customers = [];
  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse CSV line (handle commas within quoted fields)
    const fields = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    fields.push(currentField.trim());
    
    if (fields.length >= 6) {
      const [fullName, email, fullName2, billAddress, shipAddress, phone] = fields;
      
      // Clean up email (remove extra spaces, handle multiple emails)
      const cleanEmail = email.split(',')[0].trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) continue;
      
      // Extract first and last name
      const nameParts = (fullName2 || fullName).trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      customers.push({
        fullName: fullName.trim(),
        email: cleanEmail,
        firstName,
        lastName,
        phone: phone.replace(/[^\d\-\+\(\)\s]/g, '').trim(),
        billingAddress: billAddress.trim(),
        shippingAddress: shipAddress.trim(),
        companyName: fullName.trim() // Use full name as company for now
      });
    }
  }
  
  return customers;
}

// Generate unique ID
function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

// Import customers to database
function importCustomers() {
  try {
    console.log('Parsing CSV file...');
    const customers = parseCSV('Kinetic Nutrition Group LLC_Zac Customer Contact List.csv');
    console.log(`Found ${customers.length} customers to import`);
    
    // Clear existing website customers first
    execSync(`sqlite3 kinetic.db "DELETE FROM customer_profiles WHERE source = 'website'"`);
    console.log('Cleared existing website customers');
    
    // Import each customer
    let imported = 0;
    let skipped = 0;
    
    for (const customer of customers) {
      try {
        const id = generateId();
        const now = new Date().toISOString();
        
        // Check if customer already exists by email
        const existingCheck = execSync(
          `sqlite3 kinetic.db "SELECT id FROM customer_profiles WHERE email = '${customer.email}'"`,
          { encoding: 'utf8' }
        ).trim();
        
        if (existingCheck) {
          console.log(`Skipping existing customer: ${customer.email}`);
          skipped++;
          continue;
        }
        
        // Insert customer
        const insertQuery = `
          INSERT INTO customer_profiles (
            id, email, firstName, lastName, phone, companyName, 
            billingAddress, shippingAddress, source, sourceId, 
            createdAt, updatedAt, status
          ) VALUES (
            '${id}', '${customer.email}', '${customer.firstName.replace(/'/g, "''")}', 
            '${customer.lastName.replace(/'/g, "''")}', '${customer.phone.replace(/'/g, "''")}', 
            '${customer.companyName.replace(/'/g, "''")}', '${customer.billingAddress.replace(/'/g, "''")}', 
            '${customer.shippingAddress.replace(/'/g, "''")}', 'website', '${id}', 
            '${now}', '${now}', 'prospect'
          )
        `;
        
        execSync(`sqlite3 kinetic.db "${insertQuery}"`);
        imported++;
        
        if (imported % 50 === 0) {
          console.log(`Imported ${imported} customers...`);
        }
        
      } catch (error) {
        console.error(`Error importing customer ${customer.email}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`\nImport complete!`);
    console.log(`- Imported: ${imported} customers`);
    console.log(`- Skipped: ${skipped} customers`);
    
    // Show some sample data
    const sample = execSync(
      `sqlite3 kinetic.db "SELECT email, firstName, lastName, companyName FROM customer_profiles WHERE source = 'website' LIMIT 5"`,
      { encoding: 'utf8' }
    );
    console.log('\nSample imported customers:');
    console.log(sample);
    
  } catch (error) {
    console.error('Import failed:', error);
  }
}

// Run the import
importCustomers();
