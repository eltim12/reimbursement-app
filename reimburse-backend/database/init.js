/**
 * Backwards-compatible entry point.
 * Prefer: npm run db:setup
 */
const migrate = require("./migrate");

async function initDatabase() {
  await migrate();
  console.log("Database schema initialized successfully");
}

if (require.main === module) {
  initDatabase()
    .then(() => {
      console.log("Database initialization complete");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Database initialization failed:", error);
      process.exit(1);
    });
}

module.exports = initDatabase;
