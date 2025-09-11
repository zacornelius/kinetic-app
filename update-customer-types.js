const fs = require('fs');

// Read CSV data
function parseCSV(content) {
  const lines = content.split('\n');
  const headers = lines[0].split(',');
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim()) {
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < lines[i].length; j++) {
        const char = lines[i][j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      if (values.length >= headers.length) {
        const row = {};
        headers.forEach((header, index) => {
          row[header.trim()] = values[index] ? values[index].replace(/^"|"$/g, '') : '';
        });
        data.push(row);
      }
    }
  }
  
  return data;
}

async function updateCustomerTypes() {
  try {
    console.log('Reading CSV data...');
    const csvContent = fs.readFileSync('Kinetic Customers.csv', 'utf8');
    const csvData = parseCSV(csvContent);
    
    console.log(`Found ${csvData.length} records in CSV`);
    
    // Get all customers
    console.log('Fetching existing customers...');
    const customersResponse = await fetch('http://localhost:3000/api/customers');
    const customers = await customersResponse.json();
    
    console.log(`Found ${customers.length} customers`);
    
    // Create mapping from CSV data (email as key)
    const csvMap = new Map();
    csvData.forEach(row => {
      const email = row.Email?.toLowerCase().trim();
      if (email) {
        csvMap.set(email, row);
      }
    });
    
    console.log(`Created mapping with ${csvMap.size} keys`);
    
    let matchedCount = 0;
    let updateCommands = [];
    
    // Process each customer
    for (const customer of customers) {
      const customerEmail = customer.email?.toLowerCase().trim();
      
      if (customerEmail && csvMap.has(customerEmail)) {
        const csvRow = csvMap.get(customerEmail);
        
        // Update customer with category data
        const updateCommand = `
UPDATE customers 
SET 
  customertype = '${csvRow.customercategory || ''}'
WHERE email = '${customer.email}';`;
        
        updateCommands.push(updateCommand);
        matchedCount++;
        
        console.log(`Will update customer ${customer.email}: type=${csvRow.customercategory}`);
      }
    }
    
    // Write SQL commands to file
    fs.writeFileSync('update-customer-types.sql', updateCommands.join('\n'));
    
    console.log(`\nUpdate complete!`);
    console.log(`Matched: ${matchedCount} customers`);
    console.log(`Generated ${updateCommands.length} SQL update commands`);
    console.log('SQL commands written to update-customer-types.sql');
    
  } catch (error) {
    console.error('Error updating customer types:', error);
  }
}

// Run the update
updateCustomerTypes();
