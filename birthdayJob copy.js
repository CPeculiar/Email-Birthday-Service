const { findTodaysBirthdays } = require('./db');
const emailService = require('./emailService');

async function sendBirthdayEmails() {
  try {
    // Find users with birthdays today
    const birthdayCelebrants = await findTodaysBirthdays();
    
    console.log(`Sending birthday emails to ${birthdayCelebrants.length} members`);
    
    // Log the celebrants for debugging
    if (birthdayCelebrants.length > 0) {
      console.log('Birthday celebrants:', birthdayCelebrants.map(user => 
        `${user.first_name || ''} ${user.last_name || ''} (${user.email})`
      ).join(', '));
    }
    
    // Send emails to each celebrant
    for (const user of birthdayCelebrants) {
      if (user.email) {
        try {
          await emailService.sendBirthdayEmail({
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name
          });
          console.log(`Successfully sent birthday email to ${user.email}`);
        } catch (error) {
          console.error(`Failed to send email to ${user.email}:`, error);
        }
      } else {
        console.log(`Skipping user with ID ${user.id} - no email address`);
      }
    }
    
    console.log('Birthday email job completed');
  } catch (error) {
    console.error('Error in birthday email job:', error);
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
    };
    
    // Send a test email
    const result = await emailService.sendBirthdayEmail(testUser);
    
    if (result) {
      console.log(`Test email sent successfully to ${testEmail}`);
    } else {
      console.log(`Failed to send test email to ${testEmail}`);
    }
  } catch (error) {
    console.error('Error running test:', error);
  }
}

module.exports = {
  sendBirthdayEmails,
  runTest
};