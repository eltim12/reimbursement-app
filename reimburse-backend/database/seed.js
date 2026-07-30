const bcrypt = require("bcryptjs");
require("dotenv").config();

/**
 * System accounts that should exist after every deploy.
 * Passwords are set on create. On update, password is reset only when
 * SEED_RESET_PASSWORDS=true (default: true for bootstrap accounts).
 */
const SYSTEM_USERS = [
  {
    email: process.env.SUPERADMIN_EMAIL || "superadmin@trimind.studio",
    password: process.env.SUPERADMIN_PASSWORD || "TrimindSuper88!",
    name: "Platform Superadmin",
    role: "superadmin",
    company_id: null,
  },
  {
    email: "admin@whtb.com",
    password: "Wuhuatianbao88!",
    name: "Whtb Management 管理层",
    role: "management",
    // company assigned via default company in seed
  },
  {
    email: "finance@whtb.com",
    password: "BankOfChina88!",
    name: "Finance",
    role: "finance",
  },
];

function shouldResetPasswords() {
  const value = process.env.SEED_RESET_PASSWORDS;
  if (value == null || value === "") return true;
  return !["0", "false", "no"].includes(String(value).toLowerCase());
}

async function upsertUser(db, user, resetPassword, defaultCompanyId) {
  const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [
    user.email,
  ]);
  const hashedPassword = await bcrypt.hash(user.password, 10);
  const companyId =
    user.role === "superadmin"
      ? null
      : user.company_id != null
        ? user.company_id
        : defaultCompanyId;

  if (existing.length === 0) {
    const [result] = await db.query(
      "INSERT INTO users (email, password, name, role, company_id) VALUES (?, ?, ?, ?, ?)",
      [user.email, hashedPassword, user.name, user.role, companyId],
    );
    console.log(
      `✓ Created ${user.role} user ${user.email} (ID: ${result.insertId})`,
    );
    return;
  }

  if (resetPassword) {
    await db.query(
      "UPDATE users SET password = ?, name = ?, role = ?, company_id = ? WHERE email = ?",
      [hashedPassword, user.name, user.role, companyId, user.email],
    );
    console.log(`✓ Updated ${user.role} user ${user.email} (password reset)`);
  } else {
    await db.query(
      "UPDATE users SET name = ?, role = ?, company_id = ? WHERE email = ?",
      [user.name, user.role, companyId, user.email],
    );
    console.log(`✓ Updated ${user.role} user ${user.email} (kept password)`);
  }
}

/**
 * Idempotent seed for deploy / startup.
 */
async function seed(db) {
  if (!db) {
    throw new Error("seed() requires a database connection or pool");
  }

  const { ensureDefaultCompany } = require("./companies");
  const defaultCompanyId = await ensureDefaultCompany(db);

  const resetPassword = shouldResetPasswords();
  for (const user of SYSTEM_USERS) {
    await upsertUser(db, user, resetPassword, defaultCompanyId);
  }

  // Assign any remaining company-less non-superadmin users to default company
  await db.query(
    "UPDATE users SET company_id = ? WHERE company_id IS NULL AND role <> 'superadmin'",
    [defaultCompanyId],
  );

  const { seedCategoriesForCompany } = require("./categories");
  await seedCategoriesForCompany(db, defaultCompanyId);

  console.log("✓ Seeding complete");
}

if (require.main === module) {
  const db = require("../config/database");
  seed(db)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Seeding failed:", error);
      process.exit(1);
    });
}

module.exports = seed;
module.exports.SYSTEM_USERS = SYSTEM_USERS;
