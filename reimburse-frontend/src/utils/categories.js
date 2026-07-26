/** Default categories used as offline fallback before API load. */
export const DEFAULT_CATEGORIES = [
  {
    id: "BBM, Parkir & Tol",
    zh: "汽油费、停车费、过路费",
    value: "BBM, Parkir & Tol / 汽油费、停车费、过路费",
  },
  {
    id: "Sewa Mobil & Transport Online",
    zh: "租车费、网约车费",
    value: "Sewa Mobil & Transport Online / 租车费、网约车费",
  },
  {
    id: "Konsumsi Karyawan",
    zh: "员工餐饮费",
    value: "Konsumsi Karyawan / 员工餐饮费",
  },
  {
    id: "Tagihan Listrik, Air & Internet",
    zh: "水电网络费",
    value: "Tagihan Listrik, Air & Internet / 水电网络费",
  },
  {
    id: "Biaya Jamuan",
    zh: "招待费",
    value: "Biaya Jamuan / 招待费",
  },
  {
    id: "Akomodasi Perjalanan Dinas",
    zh: "出差住宿费",
    value: "Akomodasi Perjalanan Dinas / 出差住宿费",
  },
  {
    id: "Pembelian Kebutuhan Pabrik",
    zh: "工厂采购费",
    value: "Pembelian Kebutuhan Pabrik / 工厂采购费",
  },
  {
    id: "Pembelian Kebutuhan Kantor",
    zh: "办公采购费",
    value: "Pembelian Kebutuhan Kantor / 办公采购费",
  },
  {
    id: "Biaya Lain-lain",
    zh: "其他费用",
    value: "Biaya Lain-lain / 其他费用",
  },
];

export function toCategoryValue(nameId, nameZh) {
  return `${String(nameId || "").trim()} / ${String(nameZh || "").trim()}`;
}

export function normalizeCategory(item) {
  if (!item) return null;
  const name_id = item.name_id || item.id || "";
  const name_zh = item.name_zh || item.zh || "";
  return {
    id: item.id,
    name_id,
    name_zh,
    value: item.value || toCategoryValue(name_id, name_zh),
    sort_order: item.sort_order,
  };
}

/**
 * Display label for UI — single language only.
 * locale "zh" → Chinese; otherwise Indonesian.
 */
export function getCategoryLabel(category, locale = "en", list = DEFAULT_CATEGORIES) {
  if (!category) return "";
  const categories = (list || []).map(normalizeCategory).filter(Boolean);
  const match = categories.find(
    (c) =>
      c.value === category ||
      c.name_id === category ||
      c.name_zh === category,
  );
  if (match) {
    return locale === "zh" ? match.name_zh : match.name_id;
  }

  // Fallback: split stored bilingual "ID / ZH"
  const parts = String(category).split(" / ");
  if (parts.length >= 2) {
    return locale === "zh" ? parts.slice(1).join(" / ").trim() : parts[0].trim();
  }
  return category;
}

export function isKnownCategory(category, list = DEFAULT_CATEGORIES) {
  if (!category) return false;
  const categories = (list || []).map(normalizeCategory).filter(Boolean);
  return categories.some(
    (c) =>
      c.value === category ||
      c.name_id === category ||
      c.name_zh === category,
  );
}

/** @deprecated use DEFAULT_CATEGORIES / API-loaded list */
export const CATEGORIES = DEFAULT_CATEGORIES.map((c) => ({
  value: c.value,
  id: c.id,
  zh: c.zh,
}));

export const CATEGORY_VALUES = CATEGORIES.map((c) => c.value);
