const db = require('../config/database');

async function migrate() {
  try {
    console.log('Adding name column to users table...');
    // Check if column exists first to avoid error? Or use IF NOT EXISTS if supported (MySQL 8.0+ supports ADD COLUMN IF NOT EXISTS, but safe way is check information schema or catch error)
    // Simple way: Try add, ignore duplicate column error code (1060)
    
    try {
      await db.query(`ALTER TABLE users ADD COLUMN name VARCHAR(255) DEFAULT '' AFTER email`);
      console.log('✓ Added name column to users table');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️  Column name already exists in users table');
      } else {
        throw error;
      }
    }

    console.log('Migration completed');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
