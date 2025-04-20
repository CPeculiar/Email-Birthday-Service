const apiService = require('../apiService'); // Using your existing API service
const easterEmailService = require('./easterEmailService');

async function sendEasterEmails() {
  try {
    // Get all users
    const allUsers = await apiService.getAllUsers();
    
    console.log(`Sending Easter emails to ${allUsers.length} members`);
    
    let successCount = 0;
    let failCount = 0;
    
    // Send emails to each user
    for (const user of allUsers) {
      if (user.email) {
        try {
          await easterEmailService.sendEasterEmail(user);
          console.log(`Successfully sent Easter email to ${user.email}`);
          successCount++;
        } catch (error) {
          console.error(`Failed to send email to ${user.email}:`, error);
          failCount++;
        }
      } else {
        console.log(`Skipping user - no email address`);
      }
    }
    
    console.log(`Easter email job completed. Success: ${successCount}, Failed: ${failCount}`);
    return successCount;
  } catch (error) {
    console.error('Error in Easter email job:', error);
    return 0;
  }
}

// Function to run a test with a specific email
async function runTest(testEmail) {
  try {
    console.log(`Running Easter email test with email: ${testEmail}`);
    
    // Create a test user
    const testUser = {
      email: testEmail,
      first_name: 'Test',
      last_name: 'User',
      gender: 'Male', // Default test gender
    };
    
    // Send a test email
    const result = await easterEmailService.sendEasterEmail(testUser);
    
    if (result) {
      console.log(`Test Easter email sent successfully to ${testEmail}`);
    } else {
      console.log(`Failed to send test Easter email to ${testEmail}`);
    }
    
    return result;
  } catch (error) {
    console.error('Error running test:', error);
    return false;
  }
}

module.exports = {
  sendEasterEmails,
  runTest
};