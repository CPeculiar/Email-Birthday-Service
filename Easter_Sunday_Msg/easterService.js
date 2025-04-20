require('dotenv').config();
const cron = require('node-cron');
const express = require('express');
const path = require('path');
const axios = require('axios'); 
const easterEmailService = require('./easterEmailService');

// Create Express app for admin dashboard
const app = express();
const PORT = process.env.PORT || 3001; // Using different port to avoid conflict with birthday service

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// API Service for Easter (modified from your original API service)
class ApiService {
  constructor() {
    // const axios = require('axios');
    this.baseUrl = process.env.API_BASE_URL;
    this.accessToken = null;
  }

  async login() {
    try {
      console.log(`Attempting to login to ${this.baseUrl}/login/ with username: ${process.env.API_USERNAME}`);
      const response = await axios.post(`${this.baseUrl}/login/`, {
        username: process.env.API_USERNAME,
        password: process.env.API_PASSWORD
      });
      
      console.log('Login response received');
      
      if (response.data && response.data.access) {
        this.accessToken = response.data.access;
        console.log('✅ Login successful, received token');
        return true;
      } else {
        console.error('❌ Login failed: No access token in response data:', response.data);
        return false;
      }
    } catch (error) {
      console.error('❌ Login failed with error:', error.message);
      if (error.response) {
        console.error('Server response:', error.response.status, error.response.data);
      }
      return false;
    }
  }

  async getAllUsers() {
    try {
      if (!this.accessToken) {
        const loginSuccess = await this.login();
        if (!loginSuccess) {
          console.error('Failed to login, cannot fetch users');
          return [];
        }
      }
  
      let allUsers = [];
      let nextPageUrl = `${this.baseUrl}/users/?limit=100`;
      let pageCount = 0;
  
      console.log('Starting to fetch user data from API...');
  
      while (nextPageUrl) {
        pageCount++;
        console.log(`Fetching page ${pageCount}: ${nextPageUrl}`);
        
        const response = await axios.get(nextPageUrl, {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        });
  
        if (response.data && response.data.results) {
          allUsers = [...allUsers, ...response.data.results];
          nextPageUrl = response.data.next;
          console.log(`Added ${response.data.results.length} users from page ${pageCount}`);
        } else {
          nextPageUrl = null;
        }
      }
  
      console.log(`✅ Successfully fetched ${allUsers.length} users from API across ${pageCount} pages`);
      return allUsers;
    } catch (error) {
      console.error('Failed to fetch users:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      return [];
    }
  }
}

const apiService = new ApiService();

// Easter email sending function
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
    return allUsers.length;
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

// Dashboard routes
app.get('/', async (req, res) => {
  const logDates = easterEmailService.getLogDates();
  const selectedDate = req.query.date || (logDates.length > 0 ? logDates[logDates.length - 1] : null);
  const logs = selectedDate ? easterEmailService.getEmailLogs(selectedDate) : [];
  
  const successCount = logs.filter(log => log.status === 'success').length;
  const failedCount = logs.filter(log => log.status === 'failed').length;
  
  res.render('dashboard', {
    logs,
    logDates,
    selectedDate,
    stats: {
      total: logs.length,
      success: successCount,
      failed: failedCount
    },
    title: 'Easter Email Dashboard'
  });
});

app.get('/test-email', async (req, res) => {
  const email = req.query.email;
  
  if (!email) {
    return res.status(400).send('Email is required');
  }
  
  await runTest(email);
  res.redirect('/?message=Test+Easter+email+sent');
});

app.get('/run-job', async (req, res) => {
  const count = await sendEasterEmails();
  res.redirect(`/?message=Job+completed.+Sent+${count}+Easter+emails`);
});

// Start the birthday service
async function startEasterEmailService() {
  // Test API connection
  const connected = await apiService.login();
  if (!connected) {
    console.error('Could not connect to API. Check your credentials.');
    // Continue anyway, it might work later
  }

  // Calculate time until next midnight (12 AM)
  const now = new Date();
  const runAt = new Date();
  runAt.setHours(0, 0, 0, 0); // Set to midnight (12 AM)
  
  // If it's already past midnight, schedule for tomorrow
  if (now > runAt) {
    runAt.setDate(runAt.getDate() + 1);
  }
  
  const timeUntilRun = runAt - now;
  const minutesUntil = Math.floor(timeUntilRun / (1000 * 60));
  const hoursUntil = Math.floor(minutesUntil / 60);
  const remainingMinutes = minutesUntil % 60;
  
  console.log(`Easter email service started. Will run at ${runAt.toLocaleTimeString()} (in ${hoursUntil} hours and ${remainingMinutes} minutes)`);

  // Run the job once at the calculated time
  setTimeout(async () => {
    console.log('Running Easter email job at', new Date().toISOString());
    await sendEasterEmails();
  }, timeUntilRun);

  // Check for test mode from command line
  if (process.argv.includes('--test')) {
    const testEmail = process.argv[process.argv.indexOf('--test') + 1];
    if (testEmail) {
      await runTest(testEmail);
      console.log('Test completed');
    } else {
      console.error('Email address required for test. Use: node easterService.js --test email@example.com');
    }
  }
}

// Start Express server
app.listen(PORT, () => {
  console.log(`Easter email dashboard available at http://localhost:${PORT}`);
  
  // Start the Easter email service
  startEasterEmailService();
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Easter email service shutting down');
  process.exit(0);
});