// birthday-sms-service.js
require('dotenv').config();
const cron = require('node-cron');
const axios = require('axios');
const twilio = require('twilio');
const moment = require('moment');

// Disable SSL certificate verification (only for development)
// Remove this in production and install proper certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Function to get authentication token
async function getAuthToken() {
  try {
    const response = await axios.post(
      `${process.env.API_BASE_URL}/api/login/`, 
      {
        username: process.env.API_USERNAME,
        password: process.env.API_PASSWORD
      }
    );
    
    // Access the JWT token from the response
    return response.data.access;
  } catch (error) {
    console.error('Error getting authentication token:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    throw new Error('Failed to authenticate with the API');
  }
}

// Function to fetch all users and filter those with birthdays today
async function getUsersWithBirthdayToday() {
  try {
    // Get authentication token
    const token = await getAuthToken();
    
    // Fetch users from the API
    const response = await axios.get(
      `${process.env.API_BASE_URL}/api/users/?limit=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    // Get today's date in MM-DD format (month and day)
    const today = moment().format('MM-DD');
    
    // Filter users whose birth_date matches today's month and day
    const birthdayUsers = [];
    let allUsers = response.data.results;
    
    // Handle pagination if needed
    let nextPageUrl = response.data.next;
    while (nextPageUrl) {
      const nextPageResponse = await axios.get(nextPageUrl, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      allUsers = [...allUsers, ...nextPageResponse.data.results];
      nextPageUrl = nextPageResponse.data.next;
    }
    
    console.log(`Total users fetched: ${allUsers.length}`);
    
    // Filter users with birthdays today and skip null birth_dates
    allUsers.forEach(user => {
      if (user.birth_date) {
        const birthDate = moment(user.birth_date).format('MM-DD');
        if (birthDate === today) {
          birthdayUsers.push({
            id: user.username,
            name: `${user.first_name} ${user.last_name}`,
            phone: user.phone_number,
            email: user.email
          });
        }
      }
    });
    
    return birthdayUsers;
  } catch (error) {
    console.error('Error fetching birthday users:', error);
    return [];
  }
}

// Function to send SMS to a user
async function sendBirthdaySMSs(user) {
  // Clean phone number (remove spaces and ensure it has the right format)
  const phoneNumber = user.phone.replace(/\s+/g, '');
  
  try {
    const message = await twilioClient.messages.create({
      body: `Happy Birthday ${user.name}! 🎂 Wishing you a fantastic day filled with joy and celebration. Best wishes from TLBC.`,
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
      //  from: process.env.TWILIO_PHONE_NUMBER,
      // If you have a Twilio Messaging Service SID with an alpha sender ID configured
      // messsagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
      to: phoneNumber
    });
    
    console.log(`SMS sent to ${user.name} (${phoneNumber}), SID: ${message.sid}`);
    return true;
  } catch (error) {
    console.error(`Error sending SMS to ${user.name} (${phoneNumber}):`, error);
    return false;
  }
}

// Function to send a test SMS to your number
// async function sendTestSMS(user) {
    async function sendBirthdaySMS(user) {
  try {
    const testPhone = '+2347065649583'; // Your test phone number
    
    const message = await twilioClient.messages.create({
        body: `Happy Birthday ${user.name}! 🎂 Wishing you a fantastic day filled with joy and celebration. Best wishes from TLBC.`,
        //   body: `This is a test birthday SMS from TLBC. Time: ${new Date().toISOString()}`,
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
      //   from: process.env.TWILIO_PHONE_NUMBER,
      to: testPhone
    });
    
    console.log(`Test SMS sent to ${testPhone}, SID: ${message.sid}`);
    return true;
  } catch (error) {
    console.error(`Error sending test SMS:`, error);
    return false;
  }
}

// Schedule the job to run every day at 9:00 AM
cron.schedule('0 9 * * *', async () => {
  console.log('Running birthday SMS task...');
  
  try {
    // Fetch users with birthdays today
    const birthdayUsers = await getUsersWithBirthdayToday();
    console.log(`Found ${birthdayUsers.length} users with birthdays today`);
    
    // Send SMS to each user
    let successCount = 0;
    for (const user of birthdayUsers) {
      const success = await sendBirthdaySMS(user);
      if (success) successCount++;
      
      // Add a small delay between messages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`Birthday SMS task completed. Sent ${successCount}/${birthdayUsers.length} messages successfully.`);
  } catch (error) {
    console.error('Error in birthday SMS task:', error);
  }
});

// Also run the job every 12 hours to ensure we catch any new users
// This runs at 9 AM and 9 PM
cron.schedule('0 9,21 * * *', async () => {
  console.log('Running user refresh task...');
  
  try {
    await getAuthToken(); // Test authentication
    console.log('Authentication successful');
  } catch (error) {
    console.error('Authentication test failed:', error);
  }
});

// Start the service
console.log('Birthday SMS service started and scheduled for 9:00 AM daily');

// If you want to test the service immediately
if (process.env.NODE_ENV === 'development') {
  console.log('Development mode: Testing birthday SMS service...');
  (async () => {
    try {
      // Test authentication
      try {
        const token = await getAuthToken();
        console.log('Authentication successful, token obtained');
      } catch (authError) {
        console.error('Authentication test failed:', authError);
      }
      
      // Test sending SMS to your number
      console.log('Sending test SMS to your number...');
    //   await sendTestSMS();
      await sendBirthdaySMS();
      
      // Try to get birthday users
      const birthdayUsers = await getUsersWithBirthdayToday();
      console.log(`Found ${birthdayUsers.length} users with birthdays today for testing`);
      
      if (birthdayUsers.length > 0) {
        // Send test SMS to the first user
        await sendBirthdaySMS(birthdayUsers[1]);
      } else {
        console.log('No birthday users found for testing.');
      }
    } catch (error) {
      console.error('Error in test run:', error);
    }
  })();
}