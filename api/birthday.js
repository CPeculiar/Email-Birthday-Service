// api/birthday.js
const axios = require('axios');

module.exports = async (req, res) => {
  try {
    const response = await axios.get('https://email-birthday-service.onrender.com/run-job');
    res.status(200).json({ message: 'Render endpoint called successfully', result: response.data  });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'Failed to call Render endpoint' });
  }
};
