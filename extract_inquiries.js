const { execSync } = require('child_process');

// Get all website customers with notes
const customers = execSync(`sqlite3 kinetic.db "SELECT id, email, firstName, lastName, notes, tags FROM customers WHERE source = 'website' AND notes != '[]'"`).toString().trim().split('\n');

let inquiryCount = 0;

for (const customer of customers) {
  if (!customer) continue;
  
  const [id, email, firstName, lastName, notes, tags] = customer.split('|');
  
  try {
    // Parse notes and tags
    const notesArray = notes.startsWith('[') ? JSON.parse(notes) : [notes];
    const tagsArray = tags.startsWith('[') ? JSON.parse(tags) : [tags];
    
    // Extract inquiry data from notes
    const inquiryNote = notesArray[0]; // First note is usually the inquiry
    if (inquiryNote && inquiryNote.length > 10) {
      // Determine category from tags
      let category = 'questions';
      if (tagsArray.some(tag => tag.includes('Bulk') || tag.includes('bulk'))) {
        category = 'bulk';
      } else if (tagsArray.some(tag => tag.includes('Issue') || tag.includes('issue'))) {
        category = 'issues';
      }
      
      // Create inquiry record
      const inquiryId = Math.random().toString(36).slice(2, 15);
      const createdAt = new Date().toISOString();
      
      // Insert inquiry
      execSync(`sqlite3 kinetic.db "INSERT INTO inquiries (id, createdAt, category, subject, customerEmail, ownerEmail, status) VALUES ('${inquiryId}', '${createdAt}', '${category}', '${inquiryNote.substring(0, 100).replace(/'/g, "''")}', '${email.replace(/'/g, "''")}', '', 'open')"`);
      
      // Insert customer interaction
      execSync(`sqlite3 kinetic.db "INSERT INTO customer_interactions (id, customerId, type, subject, content, authorEmail, createdAt, metadata) VALUES ('${inquiryId}', '${id}', 'inquiry', '${inquiryNote.substring(0, 100).replace(/'/g, "''")}', '${inquiryNote.replace(/'/g, "''")}', '', '${createdAt}', '{\"category\": \"${category}\", \"status\": \"open\"}')"`);
      
      inquiryCount++;
    }
  } catch (error) {
    console.error(`Error processing customer ${email}:`, error.message);
  }
}

console.log(`Created ${inquiryCount} inquiry records`);


