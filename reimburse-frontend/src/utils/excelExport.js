import { formatCurrency } from "./formatters";
import { translateText } from "./translator";

function sanitizeFileName(name) {
  if (!name || name.trim() === "") {
    return "Reimbursement";
  }
  return name
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "_")
    .trim();
}

/**
 * Export entries to Excel (.xlsx) without proof images.
 * Category/note use the same bilingual auto-translation as PDF export.
 */
export async function exportExcel(
  listName,
  entries,
  { userName = "", userEmail = "" } = {},
) {
  const XLSX = await import("xlsx");

  const dataRows = await Promise.all(
    (entries || []).map(async (entry, index) => {
      const currency = entry.Currency || "IDR";
      const [translatedCategory, translatedNote] = await Promise.all([
        translateText(entry.Category || ""),
        translateText(entry.Note || "-"),
      ]);

      return {
        "序号 / No.": index + 1,
        "日期 / Tanggal": entry.Date || "",
        "类别 / Kategori": translatedCategory,
        "备注 / Catatan": translatedNote,
        "货币 / Mata Uang": currency,
        "金额 / Jumlah": entry.Amount ?? 0,
        "金额显示 / Jumlah (Formatted)": formatCurrency(
          entry.Amount,
          currency,
        ),
      };
    }),
  );

  const totals = {};
  (entries || []).forEach((entry) => {
    const currency = entry.Currency || "IDR";
    totals[currency] = (totals[currency] || 0) + (entry.Amount || 0);
  });

  Object.entries(totals).forEach(([currency, amount]) => {
    dataRows.push({
      "序号 / No.": "",
      "日期 / Tanggal": "",
      "类别 / Kategori": "",
      "备注 / Catatan": `总计 / Total (${currency})`,
      "货币 / Mata Uang": currency,
      "金额 / Jumlah": amount,
      "金额显示 / Jumlah (Formatted)": formatCurrency(amount, currency),
    });
  });

  const headers = [
    "序号 / No.",
    "日期 / Tanggal",
    "类别 / Kategori",
    "备注 / Catatan",
    "货币 / Mata Uang",
    "金额 / Jumlah",
    "金额显示 / Jumlah (Formatted)",
  ];

  const title = listName
    ? `报销汇总 / Ringkasan Reimbursement - ${listName}`
    : "报销汇总 / Ringkasan Reimbursement";

  const metaRows = [
    [title],
    [`申请日期 / Tanggal: ${new Date().toLocaleDateString()}`],
  ];

  if (userName) {
    metaRows.push([`姓名 / Nama: ${userName}`]);
  }
  if (userEmail) {
    metaRows.push([`邮箱 / Email: ${userEmail}`]);
  }

  metaRows.push([]);

  const sheetData = [
    ...metaRows,
    headers,
    ...dataRows.map((row) => headers.map((key) => row[key])),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  const headerRowIndex = metaRows.length;

  worksheet["!merges"] = metaRows
    .slice(0, -1)
    .map((_, index) => ({
      s: { r: index, c: 0 },
      e: { r: index, c: headers.length - 1 },
    }));

  worksheet["!cols"] = [
    { wch: 10 },
    { wch: 14 },
    { wch: 28 },
    { wch: 36 },
    { wch: 14 },
    { wch: 14 },
    { wch: 22 },
  ];

  const range = XLSX.utils.decode_range(worksheet["!ref"]);
  for (let R = headerRowIndex + 1; R <= range.e.r; R++) {
    for (const C of [2, 3]) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!worksheet[addr]) continue;
      worksheet[addr].s = {
        ...(worksheet[addr].s || {}),
        alignment: { wrapText: true, vertical: "top" },
      };
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Entries");

  const fileName = `${sanitizeFileName(listName || "Reimbursement")}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

/**
 * Export analytics filtered table (no proof images).
 */
export async function exportAnalyticsExcel(
  entries,
  { title = "Analytics", exportedBy = "", filtersLabel = "" } = {},
) {
  const XLSX = await import("xlsx");

  const dataRows = (entries || []).map((entry, index) => ({
    "序号 / No.": index + 1,
    "日期 / Tanggal": entry.date || "",
    "类别 / Kategori": entry.category || "",
    "备注 / Catatan": entry.note || "-",
    "金额 / Jumlah": entry.amount ?? 0,
    "金额显示 / Jumlah (Formatted)": formatCurrency(entry.amount, "IDR"),
    "列表 / Daftar": entry.listName || "",
    "所有者 / Pemilik": entry.ownerName
      ? `${entry.ownerName} (${entry.ownerEmail || ""})`
      : entry.ownerEmail || "",
  }));

  const totalAmount = (entries || []).reduce(
    (sum, entry) => sum + (Number(entry.amount) || 0),
    0,
  );

  dataRows.push({
    "序号 / No.": "",
    "日期 / Tanggal": "",
    "类别 / Kategori": "",
    "备注 / Catatan": "总计 / Total",
    "金额 / Jumlah": totalAmount,
    "金额显示 / Jumlah (Formatted)": formatCurrency(totalAmount, "IDR"),
    "列表 / Daftar": "",
    "所有者 / Pemilik": "",
  });

  const headers = [
    "序号 / No.",
    "日期 / Tanggal",
    "类别 / Kategori",
    "备注 / Catatan",
    "金额 / Jumlah",
    "金额显示 / Jumlah (Formatted)",
    "列表 / Daftar",
    "所有者 / Pemilik",
  ];

  const metaRows = [
    [title],
    [`申请日期 / Tanggal: ${new Date().toLocaleDateString()}`],
  ];
  if (exportedBy) metaRows.push([`导出人 / Diekspor oleh: ${exportedBy}`]);
  if (filtersLabel) metaRows.push([`筛选 / Filter: ${filtersLabel}`]);
  metaRows.push([]);

  const sheetData = [
    ...metaRows,
    headers,
    ...dataRows.map((row) => headers.map((key) => row[key])),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  worksheet["!merges"] = metaRows
    .slice(0, -1)
    .map((_, index) => ({
      s: { r: index, c: 0 },
      e: { r: index, c: headers.length - 1 },
    }));
  worksheet["!cols"] = [
    { wch: 10 },
    { wch: 14 },
    { wch: 36 },
    { wch: 28 },
    { wch: 14 },
    { wch: 22 },
    { wch: 22 },
    { wch: 28 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Analytics");
  XLSX.writeFile(
    workbook,
    `${sanitizeFileName(title || "Analytics")}.xlsx`,
  );
}
