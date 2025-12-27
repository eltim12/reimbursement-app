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
    "pdfmake is not loaded. Please ensure the CDN scripts are loaded in index.html"
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

export async function exportPDFEnglish(
  listName,
  entries,
  total,
  userName = ""
) {
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
              // Prefer base64 if available, otherwise use URL
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
                  height: 220,
                  alignment: "center",
                };
              }
            }
          } catch (error) {
            console.error("Error converting proof image:", error);
            proofImage = "Image unavailable";
          }
        }
        return [
          item.Date,
          item.Category,
          item.Note || "-",
          formatCurrency(item.Amount, item.Currency || "IDR"),
          proofImage,
        ];
      })
    );

    const docDefinition = {
      defaultStyle: {
        font: "NotoSansSC",
      },
      pageMargins: [20, 40, 20, 40],
      header: {
        text: `Reimbursement Summary - ${listName || "Unnamed"}`,
        style: "header",
        margin: [0, 0, 0, 10],
      },
      content: [
        {
          columns: [
            {
              text: `Generated: ${new Date().toLocaleDateString()}`,
              style: "subheader",
              alignment: "left",
            },
            {
              text: userName ? `Name: ${userName}` : "",
              style: "subheader",
              alignment: "right",
            },
          ],
        },
        {
          table: {
            headerRows: 1,
            widths: [70, 70, 150, 90, 120],
            heights: 30,
            body: [["Date", "Category", "Note", "Amount", "Proof"], ...rows],
          },
          layout: "lightHorizontalLines",
        },
        {
          text: "",
          margin: [0, 20],
        },
        // Calculate totals
        ...Object.entries(
          entries.reduce((acc, item) => {
            const curr = item.Currency || "IDR";
            acc[curr] = (acc[curr] || 0) + (item.Amount || 0);
            return acc;
          }, {})
        ).map(([currency, amount]) => ({
          text: `Total (${currency}): ${formatCurrency(amount, currency)}`,
          style: "total",
        })),
      ],
      styles: {
        header: {
          fontSize: 16,
          bold: true,
          color: "#00bcd4",
          alignment: "center",
        },
        subheader: {
          fontSize: 10,
          margin: [0, 5, 0, 10],
        },
        total: {
          fontSize: 14,
          bold: true,
          alignment: "right",
          margin: [0, 10],
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
        link.download = `${fileName}_EN.pdf`;
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

export async function exportPDFChinese(
  listName,
  entries,
  total,
  userName = ""
) {
  try {
    const pdfMake = getPdfMake();

    const rows = await Promise.all(
      entries.map(async (item) => {
        let proofImage = "-";
        if (item.Proof) {
          try {
            let proofUrl = null;
            if (typeof item.Proof === "object") {
              // Prefer base64 if available, otherwise use URL
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
                  height: 220,
                  alignment: "center",
                };
              }
            }
          } catch (error) {
            console.error("Error converting proof image:", error);
            proofImage = "图片不可用";
          }
        }
        return [
          item.Date,
          item.Category,
          item.Note || "-",
          formatCurrency(item.Amount, item.Currency || "IDR"),
          proofImage,
        ];
      })
    );

    const docDefinition = {
      defaultStyle: {
        font: "NotoSansSC",
      },
      pageMargins: [20, 40, 20, 40],
      header: {
        text: `报销汇总 - ${listName || "未命名"}`,
        style: "header",
        margin: [0, 0, 0, 10],
      },
      content: [
        {
          columns: [
            {
              text: `生成日期: ${new Date().toLocaleDateString("zh-CN")}`,
              style: "subheader",
              alignment: "left",
            },
            {
              text: userName ? `姓名: ${userName}` : "",
              style: "subheader",
              alignment: "right",
            },
          ],
        },
        {
          table: {
            headerRows: 1,
            widths: [70, 70, 150, 90, 120],
            heights: 30,
            body: [["日期", "类别", "备注", "金额", "凭证"], ...rows],
          },
          layout: "lightHorizontalLines",
        },
        {
          text: "",
          margin: [0, 20],
        },
        // Calculate totals
        ...Object.entries(
          entries.reduce((acc, item) => {
            const curr = item.Currency || "IDR";
            acc[curr] = (acc[curr] || 0) + (item.Amount || 0);
            return acc;
          }, {})
        ).map(([currency, amount]) => ({
          text: `总计 (${currency}): ${formatCurrency(amount, currency)}`,
          style: "total",
        })),
      ],
      styles: {
        header: {
          fontSize: 16,
          bold: true,
          color: "#00bcd4",
          alignment: "center",
        },
        subheader: {
          fontSize: 10,
          margin: [0, 5, 0, 10],
        },
        total: {
          fontSize: 14,
          bold: true,
          alignment: "right",
          margin: [0, 10],
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
        link.download = `${fileName}_CN.pdf`;
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
