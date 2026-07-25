require("dotenv").config();

const migrate = require("./migrate");
const seed = require("./seed");

/**
 * Full deploy setup: migrate schema, then seed system users.
 * Safe to run repeatedly.
 */
async function setup(options = {}) {
  const { db = null, runSeed = true } = options;

  console.log("→ Running database migrate…");
  await migrate(db);

  if (runSeed) {
    const connection = db || require("../config/database");
    console.log("→ Running database seed…");
    await seed(connection);
  }

  console.log("✓ Database setup complete");
}

if (require.main === module) {
  const runSeed = !["0", "false", "no"].includes(
    String(process.env.RUN_SEEDS || "true").toLowerCase(),
  );

  setup({ runSeed })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Database setup failed:", error);
      process.exit(1);
    });
}

module.exports = setup;
