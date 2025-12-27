const mysql = require('mysql2/promise');
require('dotenv').config();

async function showDatabases() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306,
    });

    const [dbs] = await connection.query('SHOW DATABASES');
    console.log('--- Databases ---');
    console.table(dbs);
    
    // Check entries table count in current db
    await connection.query('USE reimbursement_db');
    const [entries] = await connection.query('SELECT COUNT(*) as count FROM entries');
    console.log('Entries count:', entries[0].count);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (connection) await connection.end();
  }
}

showDatabases();
