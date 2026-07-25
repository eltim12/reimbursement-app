const bcrypt = require("bcryptjs");
const db = require("../config/database");
require("dotenv").config();

async function seedManagementUser() {
  const email = "admin@whtb.com";
  const password = "Wuhuatianbao88!";
  const name = "Whtb Management 管理层";
  const role = "management";

  // Ensure role column exists
  const [columns] = await db.query("DESCRIBE users");
  if (!columns.some((col) => col.Field === "role")) {
    await db.query(
      "ALTER TABLE users ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'user' AFTER name",
    );
    console.log("✓ Added users.role column");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [
    email,
  ]);

  if (existing.length === 0) {
    const [result] = await db.query(
      "INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)",
      [email, hashedPassword, name, role],
    );
    console.log(`✓ Created management user ${email} (ID: ${result.insertId})`);
  } else {
    await db.query(
      "UPDATE users SET password = ?, name = ?, role = ? WHERE email = ?",
      [hashedPassword, name, role, email],
    );
    console.log(`✓ Updated management user ${email} (ID: ${existing[0].id})`);
  }
}

if (require.main === module) {
  seedManagementUser()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = seedManagementUser;
