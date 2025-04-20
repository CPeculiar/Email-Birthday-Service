const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

class EasterEmailService {
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

  async sendEasterEmail(user) {
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
    
    const displayName = title ? `${title} ${first_name}` : (first_name || email.split('@')[0]);
    
    const mailOptions = {
      from: `"The Lord's Brethren Church" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Happy Easter! 🎉',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <h1 style="color: #4a4a4a; text-align: center;">Happy Easter, ${displayName}! 🎉</h1>
          <div style="text-align: center;">
             <img src="cid:eastercard" alt="Easter Card" 
              style="width: 100%; max-width: 700px; border-radius: 8px; height: auto; display: block; margin: 0 auto;" />
          </div>
          <p style="font-size: 16px; line-height: 1.5; color: #666; margin-top: 20px; text-align: justify; ">
            The word Easter has become a popular word all over the world, even though it was originally a celebration of the Jews.
          </p>
          <p style="font-size: 16px; line-height: 1.5; color: #666; text-align: justify;">
          The reason it is now so widely recognized is because it represents victory for us. Jesus, the Son of God, on a particular Easter, rose triumphantly
           from the dead. That resurrection was victory over death, which came as a result of sin. Now, anyone who places faith in Christ comes into that victory. 
           He receives the Spirit, by which he can serve the purpose of God here, and by the same Spirit, he receives a guarantee of immortality.
          </p>
          <p style="font-size: 16px; line-height: 1.5; color: #666; text-align: justify;">
          Easter is no longer just a celebration of the paschal feast — the Feast of the Passover — but the fulfillment of the promise of God.
          Christ, our Passover, has been crucified, died, and rose again triumphantly on the third day.
          Today, we are living for what He died for.
          He died to give man His life.
          That life is what we announce in our ministry today — and will continue to announce — until the perfect day.            
          </p>
          <div style="text-align: center; margin-top: 30px; padding: 15px; background-color: #f9f9f9; border-radius: 8px; text-align: justify;">
            <p style="font-size: 14px; color: #888; margin: 0; text-align: center;">
            Happy Easter from all of us at The Lord’s Brethren Church International.
            </p>
          </div>
          <p style="font-size: 16px; font-weight: bold; text-align: center; margin-top: 10px; color: #4a4a4a;">
            Reverend Elochukwu Udegbunam
          </p>
        </div>
      `,
      attachments: [
        {
          filename: 'Happy Easter.jpg',
          path: path.join(__dirname, 'assets/EasterCard.jpg'), 
          cid: 'eastercard'
        }
      ]
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`Easter email sent to ${email}: ${info.messageId}`);
      
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
      console.error(`Failed to send Easter email to ${email}:`, error);
      
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
    const logFilePath = path.join(this.logsDirectory, `easter-email-logs-${today}.json`);
    
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
    const logFilePath = path.join(this.logsDirectory, `easter-email-logs-${logDate}.json`);
    
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
        .filter(file => file.startsWith('easter-email-logs-'))
        .map(file => file.replace('easter-email-logs-', '').replace('.json', ''))
        .sort();
    } catch (error) {
      console.error('Error reading log directory:', error);
      return [];
    }
  }
}

module.exports = new EasterEmailService();