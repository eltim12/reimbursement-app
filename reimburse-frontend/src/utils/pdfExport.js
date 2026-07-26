// Get pdfmake from window (loaded via CDN in index.html)
function getPdfMake() {
  if (typeof window !== "undefined" && window.pdfMake) {
    const pdfMake = window.pdfMake;

    // Register Chinese fonts (only once)
    if (!pdfMake.fonts || !pdfMake.fonts.NotoSansSC) {
      pdfMake.fonts = {
        NotoSansSC: {
          normal:
            "https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf",
          bold: "https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/SubsetOTF/SC/NotoSansSC-Bold.otf",
        },
        Roboto: {
          normal:
            "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf",
          bold: "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf",
          italics:
            "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Italic.ttf",
          bolditalics:
            "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-MediumItalic.ttf",
        },
      };
    }

    return pdfMake;
  }
  throw new Error(
    "pdfmake is not loaded. Please ensure the CDN scripts are loaded in index.html",
  );
}

// Convert external image URL to data URL
async function convertImageToDataURL(imageUrl) {
  if (imageUrl.startsWith("data:image")) {
    return imageUrl;
  }

  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL
      ? import.meta.env.VITE_API_BASE_URL.replace(/\/api\/?$/, "")
      : "https://reimburse-api.trimind.studio";

    // Handle relative URLs from backend
    let fullUrl = imageUrl;
    if (imageUrl.startsWith("/images/")) {
      fullUrl = `${baseUrl}${imageUrl}`;
    } else if (!imageUrl.startsWith("http")) {
      fullUrl = `${baseUrl}/${imageUrl}`;
    }

    const response = await fetch(fullUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error converting image to data URL:", error);
    return "";
  }
}

import { formatCurrency } from "./formatters";
import { translateText } from "./translator";

// Sanitize filename
function sanitizeFileName(name) {
  if (!name || name.trim() === "") {
    return "Reimbursement";
  }
  return name
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "_")
    .trim();
}

// Bilingual cell helper: Chinese on top, English below
function biCell(zh, en, opts = {}) {
  return {
    stack: [
      { text: zh, fontSize: opts.fontSize || 8, bold: opts.bold || false },
      {
        text: en,
        fontSize: opts.fontSize || 8,
        color: "#555555",
        bold: false,
      },
    ],
    ...opts,
  };
}

// Single bilingual PDF export (Chinese + English)
export async function exportPDF(listName, entries, total, userName = "") {
  try {
    const pdfMake = getPdfMake();

    // Convert all images to data URLs
    const rows = await Promise.all(
      entries.map(async (item, index) => {
        let proofImage = "-";
        if (item.Proof) {
          try {
            let proofUrl = null;
            if (typeof item.Proof === "object") {
              proofUrl = item.Proof.base64 || item.Proof.url || null;
            } else {
              proofUrl = item.Proof;
            }

            if (proofUrl) {
              const dataUrl = await convertImageToDataURL(proofUrl);
              if (dataUrl) {
                proofImage = {
                  image: dataUrl,
                  width: 140,
                  height: 250,
                  alignment: "center",
                };
              }
            }
          } catch (error) {
            console.error("Error converting proof image:", error);
            proofImage = {
              stack: [
                { text: "凭证不可用" },
                { text: "Bukti tidak tersedia", fontSize: 8, color: "#555555" },
              ],
            };
          }
        }
        // Translate category and note
        const [translatedCategory, translatedNote] = await Promise.all([
          translateText(item.Category),
          translateText(item.Note || "-"),
        ]);

        return [
          (index + 1).toString(),
          item.Date,
          translatedCategory,
          translatedNote,
          formatCurrency(item.Amount, item.Currency || "IDR"),
          proofImage,
        ];
      }),
    );

    // Bilingual header row
    const headerRow = [
      biCell("序号", "No.", { bold: true }),
      biCell("日期", "Tanggal", { bold: true }),
      biCell("类别", "Kategori", { bold: true }),
      biCell("备注", "Catatan", { bold: true }),
      biCell("金额", "Jumlah", { bold: true }),
      biCell("凭证", "Bukti", { bold: true }),
    ];

    const docDefinition = {
      defaultStyle: {
        font: "NotoSansSC",
        fontSize: 8,
        bold: true,
      },
      pageMargins: [5, 5, 5, 5],
      header: {
        stack: [
          {
            text: `报销汇总 / Ringkasan Reimbursement`,
            style: "headerZh",
            margin: [0, 10, 0, 2],
          },
        ],
        margin: [20, 0, 20, 0],
      },
      content: [
        {
          columns: [
            {
              stack: [
                {
                  text: `申请日期 Tanggal: ${new Date().toLocaleDateString()}`,
                  fontSize: 8,
                },
              ],
              alignment: "left",
            },
            {
              stack: [
                {
                  text: listName || "未命名 / Tidak Bernama",
                  fontSize: 10,
                  color: "#00bcd4",
                  bold: true,
                },
              ],
              alignment: "center",
            },
            userName
              ? {
                  stack: [{ text: `姓名 Nama: ${userName}`, fontSize: 9 }],
                  alignment: "right",
                }
              : { text: "" },
          ],
          margin: [20, 0, 20, 10],
        },
        {
          table: {
            headerRows: 1,
            // widths: [20, 63, 70, 142, 85, 120],
            widths: [18, 50, 60, 135, 75, 150],
            heights: 30,
            body: [headerRow, ...rows],
          },
          layout: "lightHorizontalLines",
        },
        // Totals — bilingual
        ...Object.entries(
          entries.reduce((acc, item) => {
            const curr = item.Currency || "IDR";
            acc[curr] = (acc[curr] || 0) + (item.Amount || 0);
            return acc;
          }, {}),
        ).map(([currency, amount]) => ({
          stack: [
            {
              text: `总计 (${currency}): ${formatCurrency(amount, currency)}`,
              style: "totalZh",
              alignment: "center",
            },
            {
              text: `Total (${currency}): ${formatCurrency(amount, currency)}`,
              style: "totalId",
              alignment: "center",
            },
          ],
          margin: [0, 6, 0, 0],
        })),
      ],
      styles: {
        headerZh: {
          fontSize: 10,
          bold: true,
          color: "#00bcd4",
          alignment: "center",
        },
        headerSub: {
          fontSize: 10,
          color: "#444444",
          alignment: "center",
        },
        totalZh: {
          fontSize: 10,
          bold: true,
          alignment: "right",
        },
        totalId: {
          fontSize: 10,
          color: "#555555",
          alignment: "right",
        },
      },
    };

    const fileName = sanitizeFileName(listName);
    // Generate PDF blob and open it (works better on mobile)
    pdfMake.createPdf(docDefinition).getBlob((blob) => {
      const url = URL.createObjectURL(blob);
      // Open in new tab/window - works on both mobile and desktop
      const opened = window.open(url, "_blank");
      // If popup was blocked, fall back to download
      if (!opened || opened.closed || typeof opened.closed === "undefined") {
        const link = document.createElement("a");
        link.href = url;
        link.download = `${fileName}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      // Clean up the object URL after a delay
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    return true;
  } catch (error) {
    console.error("PDF generation error:", error);
    throw error;
  }
}

// Keep old named exports as aliases for backward compatibility
export const exportPDFEnglish = exportPDF;
export const exportPDFChinese = exportPDF;

/**
 * Export analytics filtered table (no proof images).
 * Category/note and headers follow the active UI language.
 */
export async function exportAnalyticsPDF(
  entries,
  {
    title = "Analytics",
    exportedBy = "",
    filtersLabel = "",
    locale = "en",
    labels = {},
    formatCategory = (v) => v,
  } = {},
) {
  try {
    const pdfMake = getPdfMake();
    const { translateToLocale } = await import("./translator");

    const L = {
      no: labels.no || (locale === "zh" ? "序号" : "No."),
      date: labels.date || (locale === "zh" ? "日期" : "Tanggal"),
      category: labels.category || (locale === "zh" ? "类别" : "Kategori"),
      note: labels.note || (locale === "zh" ? "备注" : "Catatan"),
      amount: labels.amount || (locale === "zh" ? "金额" : "Jumlah"),
      list: labels.list || (locale === "zh" ? "列表" : "Daftar"),
      owner: labels.owner || (locale === "zh" ? "所有者" : "Pemilik"),
      total: labels.total || (locale === "zh" ? "总计" : "Total"),
      exportDate:
        labels.exportDate || (locale === "zh" ? "申请日期" : "Tanggal"),
      exportedByLabel:
        labels.exportedByLabel ||
        (locale === "zh" ? "导出人" : "Diekspor oleh"),
      filter: labels.filter || (locale === "zh" ? "筛选" : "Filter"),
    };

    const localizedEntries = await Promise.all(
      (entries || []).map(async (entry) => ({
        ...entry,
        category: formatCategory(entry.category || ""),
        note: await translateToLocale(entry.note || "-", locale),
      })),
    );

    const rows = localizedEntries.map((item, index) => [
      (index + 1).toString(),
      item.date || "",
      item.category || "",
      item.note || "-",
      formatCurrency(item.amount, "IDR"),
      item.listName || "",
      item.ownerName
        ? `${item.ownerName}\n${item.ownerEmail || ""}`
        : item.ownerEmail || "",
    ]);

    const headerRow = [
      L.no,
      L.date,
      L.category,
      L.note,
      L.amount,
      L.list,
      L.owner,
    ].map((text) => ({ text, bold: true }));

    const totalAmount = localizedEntries.reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0,
    );

    const docDefinition = {
      defaultStyle: {
        font: "NotoSansSC",
        fontSize: 8,
        bold: true,
      },
      pageOrientation: "landscape",
      pageMargins: [16, 16, 16, 16],
      content: [
        {
          text: title || L.total,
          style: "headerZh",
          margin: [0, 0, 0, 8],
        },
        {
          columns: [
            {
              text: `${L.exportDate}: ${new Date().toLocaleDateString()}`,
              fontSize: 8,
            },
            exportedBy
              ? {
                  text: `${L.exportedByLabel}: ${exportedBy}`,
                  fontSize: 8,
                  alignment: "right",
                }
              : { text: "" },
          ],
          margin: [0, 0, 0, 4],
        },
        filtersLabel
          ? {
              text: `${L.filter}: ${filtersLabel}`,
              fontSize: 8,
              color: "#555555",
              margin: [0, 0, 0, 10],
            }
          : { text: "", margin: [0, 0, 0, 6] },
        {
          table: {
            headerRows: 1,
            widths: [24, 60, 110, 100, 70, 90, 110],
            body: [headerRow, ...rows],
          },
          layout: "lightHorizontalLines",
        },
        {
          text: `${L.total}: ${formatCurrency(totalAmount, "IDR")}`,
          style: "totalZh",
          margin: [0, 10, 0, 0],
          alignment: "right",
        },
      ],
      styles: {
        headerZh: {
          fontSize: 12,
          bold: true,
          color: "#171717",
          alignment: "left",
        },
        totalZh: {
          fontSize: 10,
          bold: true,
        },
      },
    };

    const fileName = sanitizeFileName(title || "Analytics");
    pdfMake.createPdf(docDefinition).getBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const opened = window.open(url, "_blank");
      if (!opened || opened.closed || typeof opened.closed === "undefined") {
        const link = document.createElement("a");
        link.href = url;
        link.download = `${fileName}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    return true;
  } catch (error) {
    console.error("Analytics PDF generation error:", error);
    throw error;
  }
}
