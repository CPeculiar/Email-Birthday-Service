const axios = require('axios');

module.exports = async (req, res) => {
  try {
    const result = await axios.get('https://email-birthday-service.onrender.com/run-job');
    console.log('Successfully called the Render endpoint');
    res.status(200).json({ message: 'Success', data: result.data });
  } catch (error) {
    console.error('Error hitting the Render endpoint:', error.message);
    res.status(500).json({ error: 'Failed to call Render endpoint' });
  }
};
