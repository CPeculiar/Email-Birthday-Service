const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT),
      secure: process.env.EMAIL_SECURE === 'true', // Convert string to boolean
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        // Do not fail on invalid certs
        rejectUnauthorized: false
      }
    });  
    
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
      'Elochukwu Udegbunam': 'Reverend'
    };
  }

  async sendBirthdayEmail(user) {
    const { email, first_name, last_name, gender } = user;
    
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
    
    const mailOptions = {
      from: `"The Lord's Brethren Church" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <h1 style="color: #4a4a4a; text-align: center;">Happy Birthday, ${greeting} ${displayName}! 🎉</h1>
          <div style="text-align: center;">
             <img src="cid:birthdaycard" alt="Birthday Card" 
              style="width: 100%; max-width: 700px; border-radius: 8px; height: auto; display: block; margin: 0 auto;" />
          </div>
          <p style="font-size: 16px; line-height: 1.5; color: #666; margin-top: 20px;">
            What a time to celebrate the gift of God over us, a pastor after God's own heart. 
          </p>
          <p style="font-size: 16px; line-height: 1.5; color: #666;">
           Not a day goes by that we do not thank God for allowing us to meet you. Your presence is truly a blessing, 
           and we cannot trade it for anything. Your faith and commitment to the Lord's work inspire us all and may God 
           continue to strengthen you in the same.
          </p>
          <p style="font-size: 16px; line-height: 1.5; color: #666;">
           Pastor, your words and actions have changed the lives of so many and had them established in God's plan for their lives.
           We could not have experienced this journey of spiritual growth without you, sir.
          </p>
          <p style="font-size: 16px; line-height: 1.5; color: #666;">
           On this day and always, we pray that you are kept for our joy and furtherance of faith.
          </p>
          <div style="text-align: center; margin-top: 30px; padding: 15px; background-color: #f9f9f9; border-radius: 8px;">
            <p style="font-size: 14px; color: #888; margin: 0;">
              Happy birthday, dear ${title ? title : 'friend'}.
              <p style="font-size: 14px; color: #888; margin: 0;"> We love you, dear ${displayName}!</p>
            </p>
          </div>
          <p style="font-size: 16px; font-weight: bold; text-align: center; margin-top: 20px; color: #4a4a4a;">
            Thank you!
          </p>
        </div>
      `,
      attachments: [
        {
          filename: 'Happy Birthday.jpg',
          path: path.join(__dirname, 'assets/MOG_Bday.jpg'), 
          cid: 'birthdaycard'
        }
      ]
    };

    try {
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
        status: 'success'
      });
      
      return true;
    } catch (error) {
      console.error(`Failed to send birthday email to ${email}:`, error);
      
      // Log the failed email
      this.logEmailSent({
        timestamp: new Date(),
        recipient: email,
        name: fullName,
        title: title,
        gender,
        error: error.message,
        status: 'failed'
      });
      
      return false;
    }
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