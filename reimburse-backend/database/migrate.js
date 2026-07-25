const mysql = require("mysql2/promise");
require("dotenv").config();

function dbConfig(includeDatabase = true) {
  const config = {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    port: Number(process.env.DB_PORT || 3306),
  };
  if (includeDatabase) {
    config.database = process.env.DB_NAME || "reimbursement_db";
  }
  return config;
}

async function ensureDatabaseExists() {
  const dbName = process.env.DB_NAME || "reimbursement_db";
  const connection = await mysql.createConnection(dbConfig(false));
  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`✓ Database ready: ${dbName}`);
  } finally {
    await connection.end();
  }
}

async function columnExists(db, table, column) {
  const [columns] = await db.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [
    column,
  ]);
  return columns.length > 0;
}

async function tableExists(db, table) {
  const [rows] = await db.query("SHOW TABLES LIKE ?", [table]);
  return rows.length > 0;
}

/**
 * Idempotent schema migration for deploy / startup.
 * Accepts a mysql2 pool or connection; creates one if omitted.
 */
async function migrate(existingDb = null) {
  let db = existingDb;
  let shouldClose = false;

  if (!db) {
    await ensureDatabaseExists();
    db = await mysql.createConnection(dbConfig(true));
    shouldClose = true;
  }

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✓ users table");

    if (!(await columnExists(db, "users", "name"))) {
      await db.query(
        "ALTER TABLE users ADD COLUMN name VARCHAR(255) AFTER password",
      );
      console.log("✓ Added users.name column");
    }

    if (!(await columnExists(db, "users", "role"))) {
      await db.query(
        "ALTER TABLE users ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'user' AFTER name",
      );
      console.log("✓ Added users.role column");
    }

    await db.query(`
      CREATE TABLE IF NOT EXISTS lists (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        name VARCHAR(255) NOT NULL,
        total DECIMAL(15, 2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✓ lists table");

    await db.query(`
      CREATE TABLE IF NOT EXISTS entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        list_id INT NOT NULL,
        date DATE NOT NULL,
        category VARCHAR(255) NOT NULL,
        note TEXT,
        amount DECIMAL(15, 2) NOT NULL,
        proof_image VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
        INDEX idx_list_id (list_id),
        INDEX idx_date (date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✓ entries table");

    const required = ["users", "lists", "entries"];
    for (const table of required) {
      if (!(await tableExists(db, table))) {
        throw new Error(`Required table missing after migrate: ${table}`);
      }
    }

    console.log("✓ Schema migration complete");
  } finally {
    if (shouldClose && db) {
      await db.end();
    }
  }
}

if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}

module.exports = migrate;
module.exports.ensureDatabaseExists = ensureDatabaseExists;
