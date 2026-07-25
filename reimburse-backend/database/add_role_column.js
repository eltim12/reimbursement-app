const mysql = require("mysql2/promise");
require("dotenv").config();

async function addRoleColumn() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "reimbursement_db",
    port: process.env.DB_PORT || 3306,
  });

  try {
    const [columns] = await connection.query("DESCRIBE users");
    const hasRole = columns.some((col) => col.Field === "role");

    if (!hasRole) {
      await connection.query(
        "ALTER TABLE users ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'user' AFTER name",
      );
      console.log("✓ Added role column to users table");
    } else {
      console.log("✓ users.role column already exists");
    }
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  addRoleColumn()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = addRoleColumn;
