const mysql = require("mysql2/promise");
require("dotenv").config();

async function verifyDatabase() {
  let connection;

  try {
    const dbName = process.env.DB_NAME || "reimbursement_db";

    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      port: process.env.DB_PORT || 3306,
      database: dbName,
    });

    console.log(`Connected to database: ${dbName}`);

    // Check if tables exist
    const [tables] = await connection.query("SHOW TABLES");
    const tableNames = tables.map((t) => Object.values(t)[0]);

    console.log("\nExisting tables:", tableNames);

    const requiredTables = ["users", "lists", "entries"];
    const missingTables = requiredTables.filter((t) => !tableNames.includes(t));

    if (missingTables.length === 0) {
      console.log("✓ All required tables exist");

      // Check table structure
      const [userColumns] = await connection.query("DESCRIBE users");
      const [listColumns] = await connection.query("DESCRIBE lists");
      const [entryColumns] = await connection.query("DESCRIBE entries");

      const userColNames = userColumns.map((c) => c.Field);
      const listColNames = listColumns.map((c) => c.Field);

      console.log("\nUsers table columns:", userColNames.join(", "));
      console.log("Lists table columns:", listColNames.join(", "));
      console.log(
        "Entries table columns:",
        entryColumns.map((c) => c.Field).join(", ")
      );

      if (!userColNames.includes("name")) {
        console.log('⚠️  Warning: Missing "name" column in users table');
      }
      if (!listColNames.includes("user_id")) {
        console.log('⚠️  Warning: Missing "user_id" column in lists table');
      }
    } else {
      console.log("✗ Missing tables!");
      console.log("  Required:", requiredTables.join(", "));
      console.log("  Missing:", missingTables.join(", "));
      console.log("\nRun: npm run init-db");
      process.exit(1);
    }
  } catch (error) {
    if (error.code === "ER_BAD_DB_ERROR") {
      console.error(
        `✗ Database '${
          process.env.DB_NAME || "reimbursement_db"
        }' does not exist`
      );
      console.log("Run: npm run init-db");
    } else {
      console.error("Error:", error.message);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

verifyDatabase();
