/**
 * Common purchasing units (office + production / warehouse).
 * value is stored in DB; labels follow UI locale.
 */
export const PURCHASING_UNITS = [
  { value: "pcs", id: "pcs / buah", zh: "个" },
  { value: "set", id: "set", zh: "套" },
  { value: "pair", id: "pasang", zh: "双" },
  { value: "dozen", id: "lusin", zh: "打" },
  { value: "pack", id: "pak", zh: "包" },
  { value: "box", id: "kotak", zh: "盒" },
  { value: "carton", id: "karton", zh: "纸箱" },
  { value: "bag", id: "kantong / karung", zh: "袋" },
  { value: "bottle", id: "botol", zh: "瓶" },
  { value: "can", id: "kaleng", zh: "罐" },
  { value: "drum", id: "drum", zh: "桶" },
  { value: "roll", id: "gulungan", zh: "卷" },
  { value: "sheet", id: "lembar", zh: "张" },
  { value: "ream", id: "rim", zh: "令" },
  { value: "unit", id: "unit", zh: "台" },
  { value: "kg", id: "kg", zh: "公斤" },
  { value: "g", id: "gram", zh: "克" },
  { value: "ton", id: "ton", zh: "吨" },
  { value: "L", id: "liter", zh: "升" },
  { value: "ml", id: "ml", zh: "毫升" },
  { value: "m", id: "meter", zh: "米" },
  { value: "cm", id: "cm", zh: "厘米" },
  { value: "mm", id: "mm", zh: "毫米" },
  { value: "m2", id: "m²", zh: "平方米" },
  { value: "m3", id: "m³", zh: "立方米" },
];

export function getUnitLabel(unit, locale = "en") {
  if (!unit) return "";
  const match = PURCHASING_UNITS.find((u) => u.value === unit);
  if (!match) return unit;
  return locale === "zh" ? match.zh : match.id;
}

export function purchasingUnitItems(locale = "en") {
  return PURCHASING_UNITS.map((u) => ({
    value: u.value,
    label: locale === "zh" ? `${u.zh} (${u.value})` : `${u.id} (${u.value})`,
    id: u.id,
    zh: u.zh,
  }));
}
