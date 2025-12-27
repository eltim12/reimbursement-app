const mysql = require('mysql2/promise');
require('dotenv').config();

const REMOTE_API = 'https://reimburse-api.trimind.studio/api';

async function importData() {
  let connection;
  try {
    // 1. Connect to Local DB
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'reimbursement_db',
      port: process.env.DB_PORT || 3306,
    });
    console.log('Connected to local MySQL');

    // 2. Get User ID
    const [users] = await connection.query('SELECT id FROM users WHERE email = ?', ['michael.eltim@gmail.com']);
    if (users.length === 0) {
      throw new Error('User michael.eltim@gmail.com not found');
    }
    const userId = users[0].id;
    console.log(`Importing data for user ID: ${userId}`);

    // 3. Fetch Remote Lists
    console.log('Fetching remote lists...');
    const listsRes = await fetch(`${REMOTE_API}/lists`);
    const listsData = await listsRes.json();
    
    if (!listsData.success) {
      throw new Error('Failed to fetch remote lists');
    }

    const lists = listsData.lists;
    console.log(`Found ${lists.length} lists to import`);

    // 4. Import Lists and Entries
    for (const list of lists) {
      console.log(`Importing list: ${list.name}...`);
      
      // Insert List
      const [listResult] = await connection.query(
        'INSERT INTO lists (user_id, name, total, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [userId, list.name, list.total, new Date(list.createdAt), new Date(list.lastUpdated)]
      );
      const newListId = listResult.insertId;

      // Fetch Remote Entries
      const entriesRes = await fetch(`${REMOTE_API}/lists/${list.id}`);
      const entriesData = await entriesRes.json();
      
      if (entriesData.success && entriesData.list.entries) {
        const entries = entriesData.list.entries;
        console.log(`  Importing ${entries.length} entries...`);

        if (entries.length > 0) {
          const values = entries.map(entry => {
            // Handle Proof Image URL
            let proofUrl = null;
            if (entry.Proof && entry.Proof.url) {
              // Convert relative remote URL to absolute
              if (entry.Proof.url.startsWith('http')) {
                proofUrl = entry.Proof.url;
              } else {
                proofUrl = `https://reimburse-api.trimind.studio${entry.Proof.url}`;
              }
            }
            
            return [
              newListId,
              entry.Date,
              entry.Category,
              entry.Note,
              entry.Amount,
              proofUrl
            ];
          });

          await connection.query(
            'INSERT INTO entries (list_id, date, category, note, amount, proof_image) VALUES ?',
            [values]
          );
        }
      }
    }

    console.log('✓ Import complete!');

  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    if (connection) await connection.end();
  }
}

importData();
