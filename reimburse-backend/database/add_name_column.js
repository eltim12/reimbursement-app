const db = require("../config/database");

async function addNameColumn() {
  try {
    console.log("Checking for name column in users table...");
    const [columns] = await db.query('SHOW COLUMNS FROM users LIKE "name"');

    if (columns.length === 0) {
      console.log("Adding name column to users table...");
      await db.query(
        "ALTER TABLE users ADD COLUMN name VARCHAR(255) AFTER password"
      );
      console.log("✓ Column added successfully");
    } else {
      console.log('ℹ️  Column "name" already exists');
    }

    process.exit(0);
  } catch (error) {
    console.error("Failed to add column:", error);
    process.exit(1);
  }
}

addNameColumn();
