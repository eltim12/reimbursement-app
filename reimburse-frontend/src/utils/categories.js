/** Canonical reimbursement categories (stored value = bilingual label). */
export const CATEGORIES = [
  {
    value: "BBM, Parkir & Tol / 汽油费、停车费、过路费",
    id: "BBM, Parkir & Tol",
    zh: "汽油费、停车费、过路费",
  },
  {
    value: "Sewa Mobil & Transport Online / 租车费、网约车费",
    id: "Sewa Mobil & Transport Online",
    zh: "租车费、网约车费",
  },
  {
    value: "Konsumsi Karyawan / 员工餐饮费",
    id: "Konsumsi Karyawan",
    zh: "员工餐饮费",
  },
  {
    value: "Tagihan Listrik / 电费",
    id: "Tagihan Listrik",
    zh: "电费",
  },
  {
    value: "Tagihan Air / 水费",
    id: "Tagihan Air",
    zh: "水费",
  },
  {
    value: "Biaya Jamuan / 招待费",
    id: "Biaya Jamuan",
    zh: "招待费",
  },
  {
    value: "Akomodasi Perjalanan Dinas / 出差住宿费",
    id: "Akomodasi Perjalanan Dinas",
    zh: "出差住宿费",
  },
  {
    value: "Pembelian Kebutuhan Pabrik / 工厂采购费",
    id: "Pembelian Kebutuhan Pabrik",
    zh: "工厂采购费",
  },
  {
    value: "Pembelian Kebutuhan Kantor / 办公采购费",
    id: "Pembelian Kebutuhan Kantor",
    zh: "办公采购费",
  },
  {
    value: "Biaya Lain-lain / 其他费用",
    id: "Biaya Lain-lain",
    zh: "其他费用",
  },
];

export const CATEGORY_VALUES = CATEGORIES.map((c) => c.value);

export function getCategoryLabel(category, locale = "en") {
  if (!category) return "";
  const match = CATEGORIES.find(
    (c) => c.value === category || c.id === category || c.zh === category,
  );
  if (!match) return category;
  if (locale === "zh") return `${match.zh} / ${match.id}`;
  return `${match.id} / ${match.zh}`;
}

export function isKnownCategory(category) {
  return CATEGORY_VALUES.includes(category);
}
