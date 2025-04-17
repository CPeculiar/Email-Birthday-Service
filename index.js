require('dotenv').config();
const cron = require('node-cron');
const express = require('express');
const path = require('path');
const apiService = require('./apiService');
const { sendBirthdayEmails, runTest } = require('./birthdayJob');
const emailService = require('./emailService');

// Create Express app for admin dashboard
const app = express();
const PORT = process.env.PORT || 3000;

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Dashboard routes
app.get('/', async (req, res) => {
  const logDates = emailService.getLogDates();
  const selectedDate = req.query.date || (logDates.length > 0 ? logDates[logDates.length - 1] : null);
  const logs = selectedDate ? emailService.getEmailLogs(selectedDate) : [];
  
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
    }
  });
});

app.get('/test-email', async (req, res) => {
  const email = req.query.email;
  
  if (!email) {
    return res.status(400).send('Email is required');
  }
  
  await runTest(email);
  res.redirect('/?message=Test+email+sent');
});

app.get('/run-job', async (req, res) => {
  const count = await sendBirthdayEmails();
  res.redirect(`/?message=Job+completed.+Sent+${count}+emails`);
});

// Start Express server
app.listen(PORT, () => {
  console.log(`Admin dashboard available at http://localhost:${PORT}`);
});

// Start the birthday service
async function startBirthdayService() {
  // Test API connection
  const connected = await apiService.login();
  if (!connected) {
    console.error('Could not connect to API. Check your credentials.');
    // Continue anyway, it might work later
  }

  // Get current time
  const now = new Date();
  
  // Calculate time until 9:00 AM
  const runAt = new Date();
  runAt.setHours(16, 0, 0, 0);
  // runAt.setHours(9, 0, 0, 0); // 9:00 AM
  
  // If it's already past 9:00 AM, schedule for tomorrow
  if (now > runAt) {
    runAt.setDate(runAt.getDate() + 1);
  }
  
  const timeUntilRun = runAt - now;
  const minutesUntil = Math.floor(timeUntilRun / (1000 * 60));
  
  console.log(`Birthday email service started. Will run at ${runAt.toLocaleTimeString()} (in ${minutesUntil} minutes)`);

  // Run the job once at the calculated time
  setTimeout(async () => {
    console.log('Running birthday email job at', new Date().toISOString());
    await sendBirthdayEmails();
  }, timeUntilRun);

  // Schedule the job to run every day at 9:00 AM
  // cron.schedule('0 9 * * *', async () => {
    cron.schedule('0 16 * * *', async () => {
    console.log('Running scheduled birthday email job at', new Date().toISOString());
    await sendBirthdayEmails();
  });

  // Check for test mode from command line
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
startBirthdayService();