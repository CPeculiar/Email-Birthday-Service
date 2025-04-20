const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT),
      secure: false, // Use TLS
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    
    // Initialize email log storage
    this.emailLogs = [];
    this.logsDirectory = path.join(__dirname, 'logs');
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(this.logsDirectory)) {
      fs.mkdirSync(this.logsDirectory, { recursive: true });
    }
  }

  async sendBirthdayEmail(user) {
    const { email, first_name, last_name, gender } = user;
    
    // Set name with appropriate title based on gender
    const title = gender === 'Male' ? 'Bro.' : (gender === 'Female' ? 'Sis.' : '');
    const displayName = title ? `${title} ${first_name}` : (first_name || email.split('@')[0]);
    
    const mailOptions = {
      from: `"The Lord's Brethren Church" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Happy Birthday! 🎂',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <h1 style="color: #4a4a4a; text-align: center;">Happy Birthday, ${displayName}! 🎉</h1>
          <div style="text-align: center;">
             <img src="cid:birthdaycard" alt="Birthday Card" 
              style="width: 100%; max-width: 700px; border-radius: 8px; height: auto; display: block; margin: 0 auto;" />
          </div>
          <p style="font-size: 16px; line-height: 1.5; color: #666; margin-top: 20px;">
            On behalf of the entire church, we want to wish you a very special happy birthday.
          </p>
          <p style="font-size: 16px; line-height: 1.5; color: #666;">
            In this new year of your life, you will make progress in the knowledge of God's word, you will bear more ministry fruits, many shall be saved and discipled through 
            your ministry efforts and the work shall be done.
          </p>
          <div style="text-align: center; margin-top: 30px; padding: 15px; background-color: #f9f9f9; border-radius: 8px;">
            <p style="font-size: 14px; color: #888; margin: 0;">
              Happy birthday to you!  
              <p style="font-size: 14px; color: #888; margin: 0;"> We love you.</p>
            </p>
          </div>
          <p style="font-size: 16px; font-weight: bold; text-align: center; margin-top: 20px; color: #4a4a4a;">
            Have a blessed day!
          </p>
        </div>
      `,
      attachments: [
        {
          filename: 'Happy Birthday.jpg',
          path: path.join(__dirname, 'assets/HappyBirthdayCard.jpg'), 
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
        name: `${first_name || ''} ${last_name || ''}`.trim(),
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
        name: `${first_name || ''} ${last_name || ''}`.trim(),
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