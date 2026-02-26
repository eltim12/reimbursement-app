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
    // Handle relative URLs from backend
    let fullUrl = imageUrl;
    if (imageUrl.startsWith("/images/")) {
      fullUrl = `https://reimburse-api.trimind.studio${imageUrl}`;
    } else if (!imageUrl.startsWith("http")) {
      fullUrl = `https://reimburse-api.trimind.studio/${imageUrl}`;
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
      { text: zh, fontSize: opts.fontSize || 9, bold: opts.bold || false },
      {
        text: en,
        fontSize: (opts.fontSize || 9) - 1,
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
      entries.map(async (item) => {
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
                  width: 110,
                  height: 215,
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
      biCell("日期", "Tanggal", { bold: true }),
      biCell("类别", "Kategori", { bold: true }),
      biCell("备注", "Catatan", { bold: true }),
      biCell("金额", "Jumlah", { bold: true }),
      biCell("凭证", "Bukti", { bold: true }),
    ];

    const docDefinition = {
      defaultStyle: {
        font: "NotoSansSC",
      },
      pageMargins: [20, 60, 20, 40],
      header: {
        stack: [
          {
            text: `报销汇总 / Ringkasan Reimbursement`,
            style: "headerZh",
            margin: [0, 10, 0, 2],
          },
          {
            text: listName || "未命名 / Tidak Bernama",
            style: "headerSub",
            margin: [0, 0, 0, 0],
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
                  text: `Tanggal: ${new Date().toLocaleDateString("zh-CN")}`,
                  fontSize: 9,
                },
                {
                  text: `Dibuat: ${new Date().toLocaleDateString()}`,
                  fontSize: 8,
                  color: "#555555",
                },
              ],
              alignment: "left",
            },
            userName
              ? {
                  stack: [
                    { text: `姓名: ${userName}`, fontSize: 9 },
                    {
                      text: `Nama: ${userName}`,
                      fontSize: 8,
                      color: "#555555",
                    },
                  ],
                  alignment: "right",
                }
              : { text: "" },
          ],
          margin: [0, 0, 0, 8],
        },
        {
          table: {
            headerRows: 1,
            widths: [70, 70, 150, 90, 120],
            heights: 30,
            body: [headerRow, ...rows],
          },
          layout: "lightHorizontalLines",
        },
        {
          text: "",
          margin: [0, 20],
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
            },
            {
              text: `Total (${currency}): ${formatCurrency(amount, currency)}`,
              style: "totalId",
            },
          ],
          margin: [0, 6, 0, 0],
        })),
      ],
      styles: {
        headerZh: {
          fontSize: 15,
          bold: true,
          color: "#00bcd4",
          alignment: "center",
        },
        headerSub: {
          fontSize: 11,
          color: "#444444",
          alignment: "center",
        },
        totalZh: {
          fontSize: 13,
          bold: true,
          alignment: "right",
        },
        totalId: {
          fontSize: 11,
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
