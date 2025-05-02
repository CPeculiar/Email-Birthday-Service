const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

class EmailService {
  constructor() {
    // Get email configuration from environment variables or use fallbacks
    const emailHost = process.env.EMAIL_HOST;
    const emailPort = parseInt(process.env.EMAIL_PORT || '587');
    const emailSecure = process.env.EMAIL_SECURE === 'true';
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    
    console.log(`Email Service: Configuring with host=${emailHost}, port=${emailPort}, secure=${emailSecure}`);
    
    this.transporter = this.createTransporter(emailHost, emailPort, emailSecure, emailUser, emailPass);
    
    // Verify transporter configuration at startup
    this.verifyConfiguration();
    
    // Initialize email log storage
    this.emailLogs = [];
    this.logsDirectory = path.join(__dirname, 'logs');
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(this.logsDirectory)) {
      fs.mkdirSync(this.logsDirectory, { recursive: true });
    }

    // List of people with special titles
    this.specialTitles = {
      'Olisaeloka Okeke': 'Pastor',
      'Mmesoma Okafor': 'Pastor',
      'Ikechukwu Egwu': 'Pastor',
      'Chinelo Okeke': 'Pastor',
      'Ugochukwu Obiozor': 'Pastor',
      'Ujukaego Udegbunam': 'Pastor',
      'Kenechukwu Chukwukelue': 'Pastor',
      'Chizoba Okeke': 'Pastor',
      'Divine Nwolisa': 'Pastor',
      'Chidinma Egwu': 'Evangelist',
      'Chidinma Udegbunam': 'Evangelist',
      'Precious Mbanekwu': 'Pastor',
      'Faith Bidiki': 'Pastor',
      'Elochukwu Udegbunam': 'Reverend',
      'Peculiar Chukwudi': 'Esteemed Member'
    };
  }

  // Create a new transporter with the given configuration
  createTransporter(host, port, secure, user, pass) {
    return nodemailer.createTransport({
      host: host,
      port: port,
      secure: secure, // true for 465, false for other ports
      auth: {
        user: user,
        pass: pass
      },
      tls: {
        // Do not fail on invalid certs
        rejectUnauthorized: false
      },
      // Increased timeouts for better reliability
      connectionTimeout: 30000, // 30 seconds (increased from 10)
      socketTimeout: 60000,     // 60 seconds (increased from 30)
      // Allow graceful failure with retries
      pool: true,
      maxConnections: 5,
      maxMessages: 10,
      rateLimit: 5, // max 5 messages per second
      // Add debug option for troubleshooting (set to false in production)
      debug: process.env.NODE_ENV !== 'production'
    });
  }

  async verifyConfiguration() {
    try {
      console.log('Verifying email transport configuration...');
      const verification = await this.transporter.verify();
      if (verification) {
        console.log('Email server connection successful ✅');
      }
    } catch (error) {
      console.error('Email server connection failed:', error.message);
      console.error('Please check your email server configuration in .env file');
      
      // Fallback to an alternative service if primary fails
      this.attemptFallbackConfiguration();
    }
  }
  
  async attemptFallbackConfiguration() {
    console.log('Attempting to configure fallback email service...');
    
    // First try Gmail SMTP as a fallback if configured
    if (process.env.FALLBACK_EMAIL_HOST && 
        process.env.FALLBACK_EMAIL_USER && 
        process.env.FALLBACK_EMAIL_PASS) {
      
      try {
        this.transporter = this.createTransporter(
          process.env.FALLBACK_EMAIL_HOST,
          parseInt(process.env.FALLBACK_EMAIL_PORT || '587'),
          process.env.FALLBACK_EMAIL_SECURE === 'true',
          process.env.FALLBACK_EMAIL_USER,
          process.env.FALLBACK_EMAIL_PASS
        );
        
        const verification = await this.transporter.verify();
        if (verification) {
          console.log('Fallback email server connection successful ✅');
          return;
        }
      } catch (error) {
        console.error('Fallback email server connection failed:', error.message);
      }
    } else {
      console.log('No fallback email configuration provided in .env file');
    }
    
    // If no custom fallback is configured or it fails, try using gmail or outlook
    try {
      console.log('Attempting to use a public email service as fallback...');
      
      // Check if Gmail credentials exist
      if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
        console.log('Trying Gmail SMTP...');
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS
          },
          connectionTimeout: 30000,
          socketTimeout: 60000
        });
      } 
      // Otherwise try to use SendGrid if configured
      else if (process.env.SENDGRID_API_KEY) {
        console.log('Trying SendGrid...');
        this.transporter = nodemailer.createTransport({
          service: 'SendGrid',
          auth: {
            user: 'apikey',
            pass: process.env.SENDGRID_API_KEY
          }
        });
      }
      // As a last resort, try Outlook/Hotmail
      else if (process.env.OUTLOOK_USER && process.env.OUTLOOK_PASS) {
        console.log('Trying Outlook/Hotmail SMTP...');
        this.transporter = nodemailer.createTransport({
          service: 'hotmail',
          auth: {
            user: process.env.OUTLOOK_USER,
            pass: process.env.OUTLOOK_PASS
          }
        });
      } else {
        console.log('No alternative email configurations available');
        return;
      }
      
      // Try to verify the new transporter
      const verification = await this.transporter.verify();
      if (verification) {
        console.log('Alternative email service connection successful ✅');
      }
    } catch (error) {
      console.error('All email service connection attempts failed:', error.message);
    }
  }

  async sendBirthdayEmail(user) {
    const { email, first_name, last_name, gender } = user;
    
    // Don't proceed if no email is provided
    if (!email) {
      console.log('Cannot send email: No email address provided');
      return false;
    }
    
    // Set name with appropriate title
    let title = '';
    const fullName = `${first_name || ''} ${last_name || ''}`.trim();
    
    // Check if the person has a special title
    if (this.specialTitles[fullName]) {
      title = this.specialTitles[fullName];
    } else {
      // Default title based on gender
      title = gender === 'Male' ? 'Bro.' : (gender === 'Female' ? 'Sis.' : '');
    }
    
    // Determine appropriate subject and greeting based on title
    let subject = 'Happy Birthday! 🎂';
    let greeting = 'dear';
    
    if (title === 'Pastor' || title === 'Reverend' || title === 'Evangelist') {
      subject = `Happy Birthday, ${title}! 🎂`;
      greeting = 'Reverend';
    }
    
    const displayName = title ? `${title} ${first_name}` : (first_name || email.split('@')[0]);
    
    // Check if the birthday card image exists
    const imagePath = path.join(__dirname, 'assets/MOG_Bday.jpg');
    let hasImage = fs.existsSync(imagePath);
    
    if (!hasImage) {
      console.warn('Birthday card image not found at:', imagePath);
    }
    
    // Prepare email content
    const mailOptions = {
      from: `"The Lord's Brethren Church" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <h1 style="color: #4a4a4a; text-align: center;">Happy Birthday, ${greeting} ${displayName}! 🎉</h1>
          ${hasImage ? `
          <div style="text-align: center;">
             <img src="cid:birthdaycard" alt="Birthday Card" 
              style="width: 100%; max-width: 700px; border-radius: 8px; height: auto; display: block; margin: 0 auto;" />
          </div>
          ` : ''}
          <p style="font-size: 16px; line-height: 1.5; color: #666; margin-top: 20px;">
            What a time to celebrate the gift of God over us, a Pastor after God's own heart. 
          </p>
          <p style="font-size: 16px; line-height: 1.5; color: #666;">
           Not a day goes by that we do not thank God for allowing us to meet you. Your presence is truly a blessing, 
           and we cannot trade it for anything. Your faith and commitment to the Lord's work inspire us all and may God 
           continue to strengthen you in the same.
          </p>
          <p style="font-size: 16px; line-height: 1.5; color: #666;">
           Pastor, your words and actions have changed the lives of so many and had them established in God's plan for their lives.
           We could not have experienced this journey of spiritual growth without you, Sir.
          </p>
          <p style="font-size: 16px; line-height: 1.5; color: #666;">
           On this day and always, we pray that you are kept for our joy and furtherance of faith.
          </p>
          <div style="text-align: center; margin-top: 30px; padding: 15px; background-color: #f9f9f9; border-radius: 8px;">
            <p style="font-size: 14px; color: #888; margin: 0;">
              Happy birthday, dear Reverend Most Holy!
              <p style="font-size: 14px; color: #888; margin: 0;"> We love you, dear ${displayName}!</p>
            </p>
          </div>
        </div>
      `,
      attachments: hasImage ? [
        {
          filename: 'Happy Birthday Reverend.jpg',
          path: imagePath,
          cid: 'birthdaycard'
        }
      ] : []
    };

    // Add plaintext alternative for better deliverability
    mailOptions.text = `Happy Birthday, ${greeting} ${displayName}!
    
    What a time to celebrate the gift of God over us, a Pastor after God's own heart.
    
    Not a day goes by that we do not thank God for allowing us to meet you. Your presence is truly a blessing, and we cannot trade it for anything. Your faith and commitment to the Lord's work inspire us all and may God continue to strengthen you in the same.
    
    Pastor, your words and actions have changed the lives of so many and had them established in God's plan for their lives. We could not have experienced this journey of spiritual growth without you, Sir.
    
    On this day and always, we pray that you are kept for our joy and furtherance of faith.
    
    Happy birthday, dear Reverend Most Holy. We love you, dear ${displayName}!
    
    - The Lord's Brethren Church International`;

    // Try to send the email with multiple retries
    const maxRetries = 4; // Increased from 3
    let retryCount = 0;
    let lastError = null;
    
    while (retryCount < maxRetries) {
      try {
        console.log(`Attempt ${retryCount + 1} to send email to ${email}...`);
        const info = await this.transporter.sendMail(mailOptions);
        console.log(`Birthday email sent to ${email}: ${info.messageId}`);
        
        // Log the successful email
        this.logEmailSent({
          timestamp: new Date(),
          recipient: email,
          name: fullName,
          title: title,
          gender,
          messageId: info.messageId,
          status: 'success',
          attempts: retryCount + 1
        });
        
        return true;
      } catch (error) {
        lastError = error;
        console.error(`Attempt ${retryCount + 1} failed:`, error.message);
        retryCount++;
        
        // If transporter seems to have connection issues, try recreating it
        if (error.code === 'ETIMEDOUT' || error.code === 'ECONNECTION' || error.code === 'EAUTH') {
          console.log('Connection issue detected, trying to reinitialize transporter...');
          await this.verifyConfiguration(); // This will fall back to alternatives if needed
        }
        
        // Wait before retrying (exponential backoff with jitter)
        if (retryCount < maxRetries) {
          const baseWaitTime = Math.pow(2, retryCount) * 1000; // 2, 4, 8, 16 seconds
          const jitter = Math.floor(Math.random() * 1000); // Add up to 1 second of jitter
          const waitTime = baseWaitTime + jitter;
          console.log(`Waiting ${waitTime/1000} seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    // After all retries failed
    console.error(`Failed to send birthday email to ${email} after ${maxRetries} attempts:`, lastError);
    
    // Log the failed email
    this.logEmailSent({
      timestamp: new Date(),
      recipient: email,
      name: fullName,
      title: title,
      gender,
      error: lastError.message,
      status: 'failed',
      attempts: retryCount
    });
    
    return false;
  }
  
  logEmailSent(logData) {
    // Add to memory logs
    this.emailLogs.push(logData);
    
    // Save to daily log file
    const today = new Date().toISOString().split('T')[0];
    const logFilePath = path.join(this.logsDirectory, `email-logs-${today}.json`);
    
    let existingLogs = [];
    if (fs.existsSync(logFilePath)) {
      try {
        existingLogs = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
      } catch (error) {
        console.error('Error reading log file:', error);
      }
    }
    
    existingLogs.push(logData);
    
    fs.writeFileSync(logFilePath, JSON.stringify(existingLogs, null, 2));
  }
  
  getEmailLogs(date = null) {
    // If date is not provided, use today's date
    const logDate = date || new Date().toISOString().split('T')[0];
    const logFilePath = path.join(this.logsDirectory, `email-logs-${logDate}.json`);
    
    if (fs.existsSync(logFilePath)) {
      try {
        return JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
      } catch (error) {
        console.error('Error reading log file:', error);
        return [];
      }
    }
    
    return [];
  }
  
  getLogDates() {
    try {
      const files = fs.readdirSync(this.logsDirectory);
      return files
        .filter(file => file.startsWith('email-logs-'))
        .map(file => file.replace('email-logs-', '').replace('.json', ''))
        .sort();
    } catch (error) {
      console.error('Error reading log directory:', error);
      return [];
    }
  }
}

module.exports = new EmailService();