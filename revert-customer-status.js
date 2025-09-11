const fs = require('fs');

async function revertCustomerStatus() {
  try {
    console.log('Reverting customer status changes...');
    
    // Get all inquiries to restore original status logic
    const response = await fetch('http://localhost:3000/api/inquiries');
    const inquiries = await response.json();
    
    console.log(`Found ${inquiries.length} inquiries`);
    
    let updateCommands = [];
    
    // Restore original customer status logic
    // For now, set all to 'contact' as default, then we'll update based on actual business logic
    for (const inquiry of inquiries) {
      const updateCommand = `
UPDATE inquiries 
SET 
  status = 'contact'
WHERE id = '${inquiry.id}';`;
      
      updateCommands.push(updateCommand);
    }
    
    // Write SQL commands to file
    fs.writeFileSync('revert-customer-status.sql', updateCommands.join('\n'));
    
    console.log(`\nRevert complete!`);
    console.log(`Generated ${updateCommands.length} SQL update commands`);
    console.log('SQL commands written to revert-customer-status.sql');
    
  } catch (error) {
    console.error('Error reverting customer status:', error);
  }
}

// Run the revert
revertCustomerStatus();
