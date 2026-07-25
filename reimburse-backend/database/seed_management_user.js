const bcrypt = require("bcryptjs");
const db = require("../config/database");
const { SYSTEM_USERS } = require("./seed");
require("dotenv").config();

async function seedManagementUser() {
  const user = SYSTEM_USERS.find((u) => u.role === "management");
  if (!user) throw new Error("Management user definition missing");

  const hashedPassword = await bcrypt.hash(user.password, 10);
  const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [
    user.email,
  ]);

  if (existing.length === 0) {
    const [result] = await db.query(
      "INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)",
      [user.email, hashedPassword, user.name, user.role],
    );
    console.log(`✓ Created management user ${user.email} (ID: ${result.insertId})`);
  } else {
    await db.query(
      "UPDATE users SET password = ?, name = ?, role = ? WHERE email = ?",
      [hashedPassword, user.name, user.role, user.email],
    );
    console.log(`✓ Updated management user ${user.email} (ID: ${existing[0].id})`);
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
