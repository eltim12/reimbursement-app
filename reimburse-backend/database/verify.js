const mysql = require('mysql2/promise');
require('dotenv').config();

async function verifyDatabase() {
  let connection;
  
  try {
    const dbName = process.env.DB_NAME || 'reimbursement_db';
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306,
      database: dbName
    });

    console.log(`Connected to database: ${dbName}`);
    
    // Check if tables exist
    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);
    
    console.log('\nExisting tables:', tableNames);
    
    if (tableNames.includes('lists') && tableNames.includes('entries')) {
      console.log('✓ All required tables exist');
      
      // Check table structure
      const [listColumns] = await connection.query('DESCRIBE lists');
      const [entryColumns] = await connection.query('DESCRIBE entries');
      
      console.log('\nLists table columns:', listColumns.map(c => c.Field).join(', '));
      console.log('Entries table columns:', entryColumns.map(c => c.Field).join(', '));
    } else {
      console.log('✗ Missing tables!');
      console.log('  Required: lists, entries');
      console.log('  Found:', tableNames);
      console.log('\nRun: npm run init-db');
      process.exit(1);
    }
    
  } catch (error) {
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.error(`✗ Database '${process.env.DB_NAME || 'reimbursement_db'}' does not exist`);
      console.log('Run: npm run init-db');
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

verifyDatabase();

