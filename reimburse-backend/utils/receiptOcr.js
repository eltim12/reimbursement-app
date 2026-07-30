/**
 * OCR.space receipt parsing + heuristic field extraction
 * for Indonesian / English / Chinese receipts.
 */

const OCR_ENDPOINT = "https://api.ocr.space/parse/image";
const FREE_TIER_MAX_BYTES = 900 * 1024; // stay under ~1MB free limit

async function ensureUnderSize(buffer, sharp) {
  if (!sharp || buffer.length <= FREE_TIER_MAX_BYTES) return buffer;
  let quality = 80;
  let out = buffer;
  while (quality >= 40) {
    out = await sharp(buffer)
      .rotate()
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    if (out.length <= FREE_TIER_MAX_BYTES) return out;
    quality -= 15;
  }
  return out;
}

/**
 * Call OCR.space and return raw text.
 */
async function ocrSpaceExtractText(imageBuffer, filename = "receipt.jpg") {
  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) {
    throw new Error("OCR_SPACE_API_KEY is not configured");
  }

  let sharp;
  try {
    sharp = require("sharp");
  } catch {
    sharp = null;
  }

  const prepared = await ensureUnderSize(imageBuffer, sharp);
  const form = new FormData();
  form.append("apikey", apiKey);
  form.append("language", "auto");
  form.append("OCREngine", "2");
  form.append("isTable", "true");
  form.append("scale", "true");
  form.append("detectOrientation", "true");
  form.append(
    "file",
    new Blob([prepared], { type: "image/jpeg" }),
    filename.replace(/\.[^.]+$/, "") + ".jpg",
  );

  const response = await fetch(OCR_ENDPOINT, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new Error(`OCR.space HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data.IsErroredOnProcessing) {
    const msg = Array.isArray(data.ErrorMessage)
      ? data.ErrorMessage.join("; ")
      : data.ErrorMessage || "OCR processing failed";
    throw new Error(msg);
  }

  const text = (data.ParsedResults || [])
    .map((r) => r.ParsedText || "")
    .join("\n")
    .trim();

  return { text, raw: data };
}

function parseDateFromText(text) {
  const lines = String(text || "");

  // ISO / YYYY-MM-DD
  let m = lines.match(/\b(20\d{2})[./-](\d{1,2})[./-](\d{1,2})\b/);
  if (m) {
    return normalizeYmd(m[1], m[2], m[3]);
  }

  // DD/MM/YYYY or DD-MM-YYYY (common ID)
  m = lines.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/);
  if (m) {
    // Prefer DMY for Indonesia
    return normalizeYmd(m[3], m[2], m[1]);
  }

  // Chinese: 2024年7月30日
  m = lines.match(/(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (m) return normalizeYmd(m[1], m[2], m[3]);

  return null;
}

function normalizeYmd(y, m, d) {
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseAmountFromText(text) {
  const lines = String(text || "").split(/\r?\n/);
  const candidates = [];

  const pushCandidate = (raw, currencyHint, priority) => {
    const n = normalizeMoney(raw, currencyHint);
    if (n == null || n <= 0) return;
    candidates.push({ amount: n, currency: currencyHint, priority });
  };

  for (const line of lines) {
    const lower = line.toLowerCase();
    const isTotalLine =
      /total|jumlah|grand\s*total|amount\s*due|合计|总计|总额|应付/.test(
        lower,
      ) || /合计|总计|总额/.test(line);

    let m;
    const idrRe = /(?:rp\.?|idr)\s*([0-9][0-9.,]*)/gi;
    while ((m = idrRe.exec(line))) {
      pushCandidate(m[1], "IDR", isTotalLine ? 100 : 10);
    }

    const rmbRe = /(?:¥|￥|rmb|cny|元)\s*([0-9][0-9.,]*)/gi;
    while ((m = rmbRe.exec(line))) {
      pushCandidate(m[1], "RMB", isTotalLine ? 100 : 10);
    }
    const yuanRe = /([0-9][0-9.,]*)\s*元/g;
    while ((m = yuanRe.exec(line))) {
      pushCandidate(m[1], "RMB", isTotalLine ? 100 : 10);
    }

    if (isTotalLine) {
      const bare = line.match(
        /([0-9]{1,3}(?:[.,][0-9]{3})+(?:[.,][0-9]{1,2})?|[0-9]+[.,][0-9]{2})/,
      );
      if (bare) {
        const currency = /¥|￥|元|rmb|cny/i.test(line) ? "RMB" : "IDR";
        pushCandidate(bare[1], currency, 80);
      }
    }
  }

  if (candidates.length === 0) {
    const all =
      String(text).match(
        /[0-9]{1,3}(?:[.,][0-9]{3})+(?:[.,][0-9]{1,2})?|[0-9]+[.,][0-9]{2}/g,
      ) || [];
    for (const raw of all) {
      pushCandidate(raw, "IDR", 1);
    }
  }

  if (candidates.length === 0) return { amount: null, currency: "IDR" };

  candidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.amount - a.amount;
  });

  return {
    amount: candidates[0].amount,
    currency: candidates[0].currency || "IDR",
  };
}

function normalizeMoney(raw, currency) {
  let s = String(raw).trim().replace(/\s/g, "");
  if (!s) return null;

  if (currency === "RMB") {
    if (s.includes(",") && s.includes(".")) {
      s = s.replace(/,/g, "");
    } else if (s.includes(",") && !s.includes(".")) {
      const parts = s.split(",");
      if (parts[1] && parts[1].length <= 2) s = parts.join(".");
      else s = s.replace(/,/g, "");
    }
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  }

  if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    return parseFloat(s.replace(/\./g, ""));
  }
  if (s.includes(",") && !s.includes(".")) {
    if (/^\d{1,3}(,\d{3})+$/.test(s)) return parseFloat(s.replace(/,/g, ""));
  }
  const cleaned = s.replace(/[^\d]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseNoteFromText(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const skip =
    /^(total|jumlah|subtotal|tax|ppn|change|kembali|qty|item|harga|price|date|tanggal|tel|phone|npwp|thank|terima|收银|合计|总计)/i;

  for (const line of lines.slice(0, 8)) {
    if (line.length < 3) continue;
    if (skip.test(line)) continue;
    if (/^[\d\s.,:/-]+$/.test(line)) continue;
    return line.slice(0, 120);
  }
  return lines[0] ? lines[0].slice(0, 120) : "";
}

function scoreCategoryMatch(haystack, category) {
  const h = haystack.toLowerCase();
  const id = String(category.name_id || "").toLowerCase();
  const zh = String(category.name_zh || "");
  let score = 0;

  if (id && h.includes(id)) score += 10;
  if (zh && haystack.includes(zh)) score += 10;

  const tokens = id.split(/[^a-z0-9]+/).filter((t) => t.length > 3);
  for (const t of tokens) {
    if (h.includes(t)) score += 2;
  }

  const keywords = [
    { re: /parkir|tol|bbm|pertamina|shell|fuel|汽油|停车|过路/i, needle: "bbm" },
    { re: /grab|gojek|taxi|uber|transport|租车|网约/i, needle: "sewa" },
    { re: /makan|resto|cafe|kopi|starbucks|餐饮|消费/i, needle: "konsumsi" },
    { re: /listrik|pln|wifi|internet|水|电|网络/i, needle: "tagihan" },
    { re: /hotel|airbnb|住宿|出差/i, needle: "akomodasi" },
    { re: /office|atk|stationery|办公/i, needle: "kantor" },
    { re: /pabrik|factory|工厂/i, needle: "pabrik" },
    { re: /jamuan|招待/i, needle: "jamuan" },
  ];
  for (const k of keywords) {
    if (k.re.test(haystack) && id.includes(k.needle)) score += 5;
  }

  return score;
}

function matchCategory(text, categories = []) {
  if (!categories.length) return null;
  let best = null;
  let bestScore = 0;
  for (const cat of categories) {
    const score = scoreCategoryMatch(text, cat);
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }
  if (bestScore < 4) return null;
  return best.value || `${best.name_id} / ${best.name_zh}`;
}

/**
 * Full pipeline: OCR → structured fields.
 */
async function parseReceipt(imageBuffer, { filename, categories } = {}) {
  const { text } = await ocrSpaceExtractText(imageBuffer, filename);
  const date = parseDateFromText(text);
  const { amount, currency } = parseAmountFromText(text);
  const note = parseNoteFromText(text);
  const category = matchCategory(text, categories);

  return {
    text,
    date,
    amount,
    currency,
    note,
    category,
    confidence: {
      date: !!date,
      amount: amount != null,
      note: !!note,
      category: !!category,
    },
  };
}

module.exports = {
  parseReceipt,
  ocrSpaceExtractText,
  parseDateFromText,
  parseAmountFromText,
  parseNoteFromText,
  matchCategory,
};
