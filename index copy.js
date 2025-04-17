require('dotenv').config();
const cron = require('node-cron');
const { testConnection } = require('./db');
const { sendBirthdayEmails, runTest } = require('./birthdayJob');

// Allow self-signed certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Connect to the database and start the application
async function startApp() {
  // Test the database connection
  const connected = await testConnection();
  if (!connected) {
    console.error('Could not connect to database. Check your connection string.');
    process.exit(1);
  }

  // Get current time
  const now = new Date();
  
 // Calculate time until 12:15 AM
 const runAt = new Date();
 runAt.setHours(0, 19, 0, 0); // 12:15 AM
  
   // If it's already past 12:15 AM, schedule for tomorrow
  if (now > runAt) {
    runAt.setDate(runAt.getDate() + 1);
  }
  
  const timeUntilRun = runAt - now;
  const minutesUntil = Math.floor(timeUntilRun / (1000 * 60));
  
  console.log(`Birthday email service started. Will run at ${runAt.toLocaleTimeString()} (in ${minutesUntil} minutes)`);

   // Run the job once at 12:15 AM
  setTimeout(async () => {
    console.log('Running birthday email job at', new Date().toISOString());
    await sendBirthdayEmails();
  }, timeUntilRun);

     // Schedule the job to run every day at 12:15 AM
  cron.schedule('19 0 * * *', async () => {
    console.log('Running scheduled birthday email job at', new Date().toISOString());
    await sendBirthdayEmails();
  });

  // Check for test mode
  if (process.argv.includes('--test')) {
    const testEmail = process.argv[process.argv.indexOf('--test') + 1] || 'pecudamicable@gmail.com';
    await runTest(testEmail);
    console.log('Test completed');
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('Birthday email service shutting down');
  process.exit(0);
});

// Start the application
startApp();