const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function migrateUsers() {
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

    // 1. Create users table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Created users table');

    // 2. Add user_id to lists table if not exists
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'lists' AND COLUMN_NAME = 'user_id'
    `, [process.env.DB_NAME || 'reimbursement_db']);

    if (columns.length === 0) {
      await connection.query(`
        ALTER TABLE lists 
        ADD COLUMN user_id INT,
        ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      `);
      console.log('✓ Added user_id column to lists table');
    } else {
      console.log('✓ Lists table already has user_id column');
    }

    // 3. Create default user
    const email = 'michael.eltim@gmail.com';
    const password = 'Notion12';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if user exists
    const [users] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
    
    let userId;
    if (users.length === 0) {
      const [result] = await connection.query(
        'INSERT INTO users (email, password) VALUES (?, ?)',
        [email, hashedPassword]
      );
      userId = result.insertId;
      console.log(`✓ Created user: ${email} (ID: ${userId})`);
    } else {
      userId = users[0].id;
      // Update password just in case
      await connection.query(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, userId]
      );
      console.log(`✓ User ${email} already exists (ID: ${userId}). Password updated.`);
    }

    // 4. Update existing lists to belong to this user
    const [updateResult] = await connection.query(
      'UPDATE lists SET user_id = ? WHERE user_id IS NULL',
      [userId]
    );
    console.log(`✓ Assigned ${updateResult.affectedRows} existing lists to user ${email}`);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

migrateUsers().then(() => {
  console.log('Migration complete');
  process.exit(0);
});
