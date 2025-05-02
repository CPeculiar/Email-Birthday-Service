require('dotenv').config();
const cron = require('node-cron');
const express = require('express');
const path = require('path');
const fs = require('fs');
const apiService = require('./apiService');
const { sendBirthdayEmails, runTest } = require('./birthdayJob');
const emailService = require('./emailService');
const { DateTime } = require('luxon');

// Create Express app for admin dashboard
const app = express();
const PORT = process.env.PORT || 10000; 

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add middleware for basic request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Dashboard routes
app.get('/', async (req, res) => {
  const logDates = emailService.getLogDates();
  const selectedDate = req.query.date || (logDates.length > 0 ? logDates[logDates.length - 1] : null);
  const logs = selectedDate ? emailService.getEmailLogs(selectedDate) : [];
  
  const successCount = logs.filter(log => log.status === 'success').length;
  const failedCount = logs.filter(log => log.status === 'failed').length;
  
  // Get email configuration for display (mask sensitive info)
  const emailConfig = {
    host: process.env.EMAIL_HOST || 'Not configured',
    port: process.env.EMAIL_PORT || 'Not configured',
    user: process.env.EMAIL_USER ? `${process.env.EMAIL_USER.substring(0, 3)}***` : 'Not configured',
    secure: process.env.EMAIL_SECURE || 'false'
  };
  
  res.render('dashboard', {
    logs,
    logDates,
    selectedDate,
    stats: {
      total: logs.length,
      success: successCount,
      failed: failedCount
    },
    config: emailConfig,
    message: req.query.message || null
  });
});

app.get('/test-email', async (req, res) => {
  const email = req.query.email;
  
  if (!email) {
    return res.status(400).send('Email is required');
  }
  
  try {
    const result = await runTest(email);
    if (result) {
      res.redirect('/?message=Test+email+sent+to+' + encodeURIComponent(email));
    } else {
      res.redirect('/?message=Failed+to+send+test+email+to+' + encodeURIComponent(email));
    }
  } catch (error) {
    res.redirect('/?message=Error:+' + encodeURIComponent(error.message));
  }
});

app.get('/run-job', async (req, res) => {
  try {
    const count = await sendBirthdayEmails();
    res.redirect(`/?message=Job+completed.+Sent+${count}+emails`);
  } catch (error) {
    res.redirect('/?message=Error:+' + encodeURIComponent(error.message));
  }
});

// Add configuration update route
app.post('/update-config', async (req, res) => {
  try {
    const { emailHost, emailPort, emailUser, emailPass } = req.body;
    
    // Create a backup of current .env
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const backup = fs.readFileSync(envPath, 'utf8');
      fs.writeFileSync(path.join(__dirname, '.env.backup'), backup);
    }
    
    // Update only the provided values
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    
    if (emailHost) {
      envContent = updateEnvVar(envContent, 'EMAIL_HOST', emailHost);
    }
    if (emailPort) {
      envContent = updateEnvVar(envContent, 'EMAIL_PORT', emailPort);
    }
    if (emailUser) {
      envContent = updateEnvVar(envContent, 'EMAIL_USER', emailUser);
    }
    if (emailPass) {
      envContent = updateEnvVar(envContent, 'EMAIL_PASS', emailPass);
    }
    
    fs.writeFileSync(envPath, envContent);
    
    // Restart the email service
    const result = await emailService.verifyConfiguration();
    
    res.redirect('/?message=Email+configuration+updated');
  } catch (error) {
    console.error('Error updating configuration:', error);
    res.redirect('/?message=Error+updating+configuration:+' + encodeURIComponent(error.message));
  }
});

// Helper function to update environment variables
function updateEnvVar(content, key, value) {
  // Check if the variable already exists
  const regex = new RegExp(`^${key}=.*`, 'm');
  if (regex.test(content)) {
    // Update existing variable
    return content.replace(regex, `${key}=${value}`);
  } else {
    // Add new variable
    return content + `\n${key}=${value}`;
  }
}

// Start the birthday service
async function startBirthdayService() {
  console.log('Starting birthday email service...');
  
  // Test API connection
  try {
    const connected = await apiService.login();
    if (!connected) {
      console.error('Could not connect to API. Check your credentials.');
      // Continue anyway, it might work later
    }
  } catch (error) {
    console.error('Error connecting to API:', error.message);
  }

  // Get current time in WAT (West Africa Time)
  const now = DateTime.now().setZone('Africa/Lagos');
  
  // Calculate time until 1:00 AM 
  const runAt = DateTime.now().setZone('Africa/Lagos').set({ hour: 1, minute: 0, second: 0, millisecond: 0 });
  
  // If it's already past 1:00 AM, schedule for tomorrow
  let timeUntilRun;
  if (now > runAt) {
    timeUntilRun = runAt.plus({ days: 1 }).diff(now).milliseconds;
  } else {
    timeUntilRun = runAt.diff(now).milliseconds;
  }
  
  const minutesUntil = Math.floor(timeUntilRun / (1000 * 60));
  const readableRunAt = runAt.toLocaleString(DateTime.TIME_SIMPLE) + ' WAT';
  
  console.log(`Birthday email service scheduled. Will run at ${readableRunAt} (in ${minutesUntil} minutes)`);

  // Run the job once at the calculated time
  setTimeout(async () => {
    console.log('Running birthday email job at', DateTime.now().setZone('Africa/Lagos').toISO());
    try {
      await sendBirthdayEmails();
    } catch (error) {
      console.error('Error running birthday email job:', error);
    }
  }, timeUntilRun);

  // Schedule the job to run every day at 1:00 AM (WAT)
  cron.schedule('0 1 * * *', async () => {
    console.log('Running scheduled birthday email job at', DateTime.now().setZone('Africa/Lagos').toISO());
    try {
      await sendBirthdayEmails();
    } catch (error) {
      console.error('Error running scheduled birthday email job:', error);
    }
  }, {
    timezone: 'Africa/Lagos'
  });

  // Check for test mode from command line
  if (process.argv.includes('--test')) {
    const testEmail = process.argv[process.argv.indexOf('--test') + 1] || 'pecudamicable@gmail.com';
    try {
      await runTest(testEmail);
      console.log('Test completed');
    } catch (error) {
      console.error('Test failed:', error);
    }
  }
}

// Add error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Log to a file
  const logDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  fs.appendFileSync(
    path.join(logDir, 'uncaught-exceptions.log'),
    `[${new Date().toISOString()}] ${error.stack || error}\n`
  );
});

// Start Express server
app.listen(PORT, () => {
  console.log(`Admin dashboard available at http://localhost:${PORT} or https://email-birthday-service.onrender.com/`);
  
  // Start the birthday service after the server is up
  startBirthdayService();
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Birthday email service shutting down');
  process.exit(0);
});