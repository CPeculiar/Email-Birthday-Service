// birthday-sms-service.js
require('dotenv').config();
const cron = require('node-cron');
const axios = require('axios');
const twilio = require('twilio');
const moment = require('moment');

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Function to get authentication token
// This assumes you have an authentication endpoint that returns a token
async function getAuthToken() {
  try {
    const response = await axios.post(
      `${process.env.API_BASE_URL}/api/login/`, 
      {
        username: process.env.API_USERNAME,
        password: process.env.API_PASSWORD
      }
    );
    return response.data.access; // Adjust based on your API's response structure
  } catch (error) {
    console.error('Error getting authentication token:', error);
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
    
    // Filter users with birthdays today
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
async function sendBirthdaySMS(user) {
  // Clean phone number (remove spaces and ensure it has the right format)
  const phoneNumber = user.phone.replace(/\s+/g, '');
  
  try {
    const message = await twilioClient.messages.create({
      body: `Happy Birthday ${user.name}! 🎂 Wishing you a fantastic day filled with joy and celebration. Best wishes from The Lord's Brethren Church.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });
    
    console.log(`SMS sent to ${user.name} (${phoneNumber}), SID: ${message.sid}`);
    
    // Log the sent message (optional - you can add an endpoint for this in your backend)
    // try {
    //   const token = await getAuthToken();
    //   await axios.post(
    //     `${process.env.API_BASE_URL}/api/sms-logs/`,
    //     {
    //       user_id: user.id,
    //       message_sid: message.sid,
    //       message_type: 'birthday',
    //       status: 'sent'
    //     },
    //     {
    //       headers: {
    //         Authorization: `Bearer ${token}`
    //       }
    //     }
    //   );
    // } catch (logError) {
    //   console.error(`Error logging SMS for ${user.name}:`, logError);
    // }
    
    return true;
  } catch (error) {
    console.error(`Error sending SMS to ${user.name} (${phoneNumber}):`, error);
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

// Start the service
console.log('Birthday SMS service started and scheduled for 9:00 AM daily');

// If you want to test the service immediately
if (process.env.NODE_ENV === 'development') {
  console.log('Development mode: Testing birthday SMS service...');
  (async () => {
    try {
      const birthdayUsers = await getUsersWithBirthdayToday();
      console.log(`Found ${birthdayUsers.length} users with birthdays today for testing`);
      
      if (birthdayUsers.length > 0) {
        // Send test SMS to the second user
        await sendBirthdaySMS(birthdayUsers[1]);
      } else {
        console.log('No birthday users found for testing. You can modify the code to test with a sample user.');
      }
    } catch (error) {
      console.error('Error in test run:', error);
    }
  })();
}