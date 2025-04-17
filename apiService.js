const axios = require('axios');

class ApiService {
  constructor() {
    this.baseUrl = 'https://api.thelordsbrethrenchurch.org/api';
    this.accessToken = null;
  }

  async login() {
    try {
      const response = await axios.post(`${this.baseUrl}/login/`, {
        username: process.env.API_USERNAME || 'Peculiar21',
        password: process.env.API_PASSWORD || 'Peculiar21#'
      });

      if (response.data && response.data.access) {
        this.accessToken = response.data.access;
        console.log('Login successful');
        return true;
      } else {
        console.error('Login failed: No access token received');
        return false;
      }
    } catch (error) {
      console.error('Login failed:', error.message);
      return false;
    }
  }

  async getAllUsers() {
    try {
      if (!this.accessToken) {
        await this.login();
      }
  
      let allUsers = [];
      let nextPageUrl = `${this.baseUrl}/users/`;
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
      return [];
    }
  }
  
  async getUsersWithBirthdaysToday() {
    const allUsers = await this.getAllUsers();
    const today = new Date();
    const month = today.getMonth() + 1; // 1-12
    const day = today.getDate();
    
    console.log(`Checking for birthdays today (${month}/${day})...`);
    
    // Filter users whose birthdays are today
    const birthdayUsers = allUsers.filter(user => {
      if (!user.birth_date) return false;
      
      const birthDate = new Date(user.birth_date);
      return birthDate.getDate() === day && 
             birthDate.getMonth() + 1 === month;
    });
    
    if (birthdayUsers.length > 0) {
      console.log(`🎂 Found ${birthdayUsers.length} users with birthdays today:`);
      birthdayUsers.forEach(user => {
        console.log(`- ${user.first_name || ''} ${user.last_name || ''} (${user.email || 'No email'})`);
      });
    } else {
      console.log('😔 No users have birthdays today');
    }
    
    return birthdayUsers;
  }

  // async getUsersWithBirthdaysToday() {
  //   const allUsers = await this.getAllUsers();
  //   const today = new Date();
  //   const month = today.getMonth() + 1; // 1-12
  //   const day = today.getDate();
    
  //   // Filter users whose birthdays are today
  //   const birthdayUsers = allUsers.filter(user => {
  //     if (!user.birth_date) return false;
      
  //     const birthDate = new Date(user.birth_date);
  //     return birthDate.getDate() === day && 
  //            birthDate.getMonth() + 1 === month;
  //   });
    
  //   console.log(`Found ${birthdayUsers.length} users with birthdays today`);
  //   return birthdayUsers;
  // }
}

module.exports = new ApiService();