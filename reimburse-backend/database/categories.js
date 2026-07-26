/**
 * Default bilingual categories (seeded when categories table is empty).
 * Stored entry value format: `${name_id} / ${name_zh}`
 */
const DEFAULT_CATEGORIES = [
  { name_id: "BBM, Parkir & Tol", name_zh: "汽油费、停车费、过路费" },
  { name_id: "Sewa Mobil & Transport Online", name_zh: "租车费、网约车费" },
  { name_id: "Konsumsi Karyawan", name_zh: "员工餐饮费" },
  { name_id: "Tagihan Listrik, Air & Internet", name_zh: "水电网络费" },
  { name_id: "Biaya Jamuan", name_zh: "招待费" },
  { name_id: "Akomodasi Perjalanan Dinas", name_zh: "出差住宿费" },
  { name_id: "Pembelian Kebutuhan Pabrik", name_zh: "工厂采购费" },
  { name_id: "Pembelian Kebutuhan Kantor", name_zh: "办公采购费" },
  { name_id: "Biaya Lain-lain", name_zh: "其他费用" },
];

function categoryValue(nameId, nameZh) {
  return `${String(nameId || "").trim()} / ${String(nameZh || "").trim()}`;
}

function mapCategoryRow(row) {
  const name_id = row.name_id;
  const name_zh = row.name_zh;
  return {
    id: row.id,
    name_id,
    name_zh,
    value: categoryValue(name_id, name_zh),
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Seed default categories only when the table is empty (idempotent).
 */
async function seedCategories(db) {
  const [countRows] = await db.query(
    "SELECT COUNT(*) AS c FROM categories",
  );
  const count = Number(countRows[0]?.c) || 0;
  if (count > 0) {
    console.log(`✓ categories already seeded (${count})`);
    return;
  }

  for (let i = 0; i < DEFAULT_CATEGORIES.length; i += 1) {
    const item = DEFAULT_CATEGORIES[i];
    await db.query(
      "INSERT INTO categories (name_id, name_zh, sort_order) VALUES (?, ?, ?)",
      [item.name_id, item.name_zh, i + 1],
    );
  }
  console.log(`✓ Seeded ${DEFAULT_CATEGORIES.length} categories`);
}

module.exports = {
  DEFAULT_CATEGORIES,
  categoryValue,
  mapCategoryRow,
  seedCategories,
};
