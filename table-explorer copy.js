require('dotenv').config();
const { sequelize, listTables, testConnection } = require('./db');

async function exploreDatabase() {
  try {
    // Test the connection first
    const connected = await testConnection();
    if (!connected) {
      console.error('Could not connect to database. Check your connection string.');
      return;
    }
    
    // List all tables
    await listTables();
    
    // Explore table structure for potential Bio and User tables
    const tablesToExplore = ['accounts_bio', 'accounts_user'];
    
    for (const table of tablesToExplore) {
      try {
        const [columns] = await sequelize.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = '${table}'
          ORDER BY ordinal_position;
        `);
        
        console.log(`\nColumns in ${table}:`);
        columns.forEach(col => {
          console.log(`- ${col.column_name}: ${col.data_type}`);
        });
        
        // Get sample data (first row)
        const [sampleData] = await sequelize.query(`
          SELECT * FROM "${table}" LIMIT 1;
        `);
        
        if (sampleData.length > 0) {
          console.log(`\nSample data from ${table}:`);
          console.log(sampleData[0]);
        } else {
          console.log(`No data found in ${table}`);
        }
      } catch (error) {
        console.log(`Table ${table} not found or error exploring it:`, error.message);
      }
    }
    
    // Close the connection
    await sequelize.close();
    console.log('\nDatabase exploration complete');
  } catch (error) {
    console.error('Error exploring database:', error);
  }
}

exploreDatabase();