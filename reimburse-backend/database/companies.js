/**
 * Default company for existing production data migration.
 */
const DEFAULT_COMPANY = {
  name: "PT WHTB Glass Industry",
  slug: "whtb",
};

/**
 * Ensure default company exists; return its id.
 */
async function ensureDefaultCompany(db) {
  const [existing] = await db.query(
    "SELECT id FROM companies WHERE slug = ?",
    [DEFAULT_COMPANY.slug],
  );
  if (existing.length > 0) {
    // Keep name in sync if renamed in code
    await db.query("UPDATE companies SET name = ? WHERE id = ?", [
      DEFAULT_COMPANY.name,
      existing[0].id,
    ]);
    return existing[0].id;
  }

  const [result] = await db.query(
    "INSERT INTO companies (name, slug) VALUES (?, ?)",
    [DEFAULT_COMPANY.name, DEFAULT_COMPANY.slug],
  );
  console.log(
    `✓ Created default company ${DEFAULT_COMPANY.name} (ID: ${result.insertId})`,
  );
  return result.insertId;
}

function slugify(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || `company-${Date.now()}`;
}

module.exports = {
  DEFAULT_COMPANY,
  ensureDefaultCompany,
  slugify,
};
