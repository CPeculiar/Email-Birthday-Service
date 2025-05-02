const apiService = require('./apiService');
const emailService = require('./emailService');

async function sendBirthdayEmails() {
  try {
    console.log('Starting birthday email job...');
    
    // Try to log in before getting users
    const loggedIn = await apiService.login();
    if (!loggedIn) {
      console.error('Failed to log in to API. Will attempt to continue anyway.');
    }
    
    // Find users with birthdays today
    const birthdayCelebrants = await apiService.getUsersWithBirthdaysToday();
    
    console.log(`Sending birthday emails to ${birthdayCelebrants.length} members`);
    
    // Log the celebrants for debugging
    if (birthdayCelebrants.length > 0) {
      console.log('Birthday celebrants:', birthdayCelebrants.map(user => 
        `${user.first_name || ''} ${user.last_name || ''} (${user.email})`
      ).join(', '));
    }
    
    // Send emails to each celebrant
    let successCount = 0;
    for (const user of birthdayCelebrants) {
      if (user.email) {
        try {
          const sent = await emailService.sendBirthdayEmail(user);
          if (sent) {
            console.log(`Successfully sent birthday email to ${user.email}`);
            successCount++;
          } else {
            console.error(`Failed to send email to ${user.email}`);
          }
        } catch (error) {
          console.error(`Failed to send email to ${user.email}:`, error);
        }
      } else {
        console.log(`Skipping user - no email address`);
      }
    }
    
    console.log(`Birthday email job completed. Sent ${successCount}/${birthdayCelebrants.length} emails`);
    return birthdayCelebrants.length;
  } catch (error) {
    console.error('Error in birthday email job:', error);
    return 0;
  }
}

// Function to run a test with a specific email
async function runTest(testEmail) {
  try {
    console.log(`Running test with email: ${testEmail}`);
    
    // Create a test user
    const testUser = {
      email: testEmail,
      first_name: 'Test',
      last_name: 'User',
      gender: 'Male', // Default test gender
      birth_date: new Date().toISOString().split('T')[0] // Today
    };
    
    // Send a test email
    const result = await emailService.sendBirthdayEmail(testUser);
    
    if (result) {
      console.log(`Test email sent successfully to ${testEmail}`);
    } else {
      console.log(`Failed to send test email to ${testEmail}`);
    }
    
    return result;
  } catch (error) {
    console.error('Error running test:', error);
    return false;
  }
}

module.exports = {
  sendBirthdayEmails,
  runTest
};