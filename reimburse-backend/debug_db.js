const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkData() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'reimbursement_db',
      port: process.env.DB_PORT || 3306,
    });

    console.log('Connected to MySQL server');

    // 1. Check User
    const [users] = await connection.query('SELECT * FROM users');
    console.log('--- Users ---');
    console.table(users);

    // 2. Check Lists
    const [lists] = await connection.query('SELECT id, user_id, name, total FROM lists');
    console.log('--- Lists ---');
    console.table(lists);

  } catch (error) {
    console.error('Error checking data:', error);
  } finally {
    if (connection) await connection.end();
  }
}

checkData();
