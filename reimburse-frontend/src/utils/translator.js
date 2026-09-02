/**
 * Text translation for exports and bilingual fields.
 * Order: local bilingual parsing → cache → Google Translate → MyMemory fallback.
 * Google often rate-limits (429); MyMemory is the backup for normal browsers too.
 */

const translationCache = new Map();

function detectIsChinese(text) {
  return /[\u4e00-\u9fa5]/.test(text);
}

function detectHasLatin(text) {
  return /[A-Za-z]/.test(text);
}

function cacheKey(text, sourceLang, targetLang) {
  return `${sourceLang}|${targetLang}|${text}`;
}

function normalizeLangCode(lang) {
  if (!lang) return lang;
  if (lang === "zh" || lang === "zh-CN" || lang === "zh-TW") return "zh-CN";
  if (lang === "id" || lang === "id-ID") return "id";
  return lang;
}

/** Parse stored "Indonesian / 中文" category values without network. */
export function splitBilingualSlash(text) {
  if (!text || !String(text).trim()) return null;
  const value = String(text).trim();
  const slashIdx = value.indexOf(" / ");
  if (slashIdx <= 0) return null;

  const id = value.slice(0, slashIdx).trim();
  const zh = value.slice(slashIdx + 3).trim();
  if (!id || !zh) return null;
  return { id, zh };
}

/**
 * True when text already looks bilingual (Chinese + Latin, often with line breaks).
 */
export function isAlreadyBilingual(text) {
  if (!text || !String(text).trim()) return false;
  const value = String(text);
  return detectIsChinese(value) && detectHasLatin(value);
}

/**
 * Format bilingual export text as Indonesian line + Chinese line (list PDF style).
 * Returns null when local parsing is not possible.
 */
export function formatBilingualExportStack(text) {
  if (!text || text.trim() === "-" || text.trim() === "") return text;

  const slashParts = splitBilingualSlash(text);
  if (slashParts) {
    return `${slashParts.id.toLowerCase()}\n${slashParts.zh}`;
  }

  if (isAlreadyBilingual(text)) {
    const lines = String(text)
      .trim()
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length >= 2) {
      const [first, second] = lines;
      if (detectIsChinese(first)) {
        return `${second.toLowerCase()}\n${first}`;
      }
      return `${first.toLowerCase()}\n${second}`;
    }
  }

  return null;
}

/** Pick one language from bilingual text for locale-aware exports. */
export function pickLocaleFromBilingual(text, locale = "en") {
  const slashParts = splitBilingualSlash(text);
  if (slashParts) {
    return locale === "zh" ? slashParts.zh : slashParts.id;
  }

  if (isAlreadyBilingual(text)) {
    const lines = String(text)
      .trim()
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length >= 2) {
      const chineseLine = lines.find((line) => detectIsChinese(line));
      const latinLine = lines.find(
        (line) => detectHasLatin(line) && !detectIsChinese(line),
      );
      if (locale === "zh" && chineseLine) return chineseLine;
      if (locale !== "zh" && latinLine) return latinLine;
    }
  }

  return null;
}

async function googleTranslate(text, sourceLang, targetLang) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Translation API error: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("Translation API returned non-JSON response");
  }

  const data = await response.json();
  let translated = "";
  if (data && data[0]) {
    data[0].forEach((item) => {
      if (item[0]) translated += item[0];
    });
  }
  if (!translated.trim()) {
    throw new Error("Translation API returned empty result");
  }
  return translated;
}

async function myMemoryTranslate(text, sourceLang, targetLang) {
  const sl = normalizeLangCode(sourceLang);
  const tl = normalizeLangCode(targetLang);
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sl}|${tl}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`MyMemory API error: ${response.status}`);
  }

  const data = await response.json();
  if (data.quotaFinished) {
    throw new Error("MyMemory daily quota exceeded");
  }
  if (data.responseStatus !== 200) {
    throw new Error(data.responseDetails || "MyMemory translation failed");
  }

  const translated = data.responseData?.translatedText?.trim();
  if (!translated) {
    throw new Error("MyMemory returned empty result");
  }
  return translated;
}

async function translateWithFallback(text, sourceLang, targetLang) {
  const key = cacheKey(text, sourceLang, targetLang);
  if (translationCache.has(key)) {
    return translationCache.get(key);
  }

  let translated;
  try {
    translated = await googleTranslate(text, sourceLang, targetLang);
  } catch (googleError) {
    console.warn("Google Translate unavailable, using MyMemory:", googleError.message);
    translated = await myMemoryTranslate(text, sourceLang, targetLang);
  }

  translationCache.set(key, translated);
  return translated;
}

/**
 * Always returns Chinese then Indonesian, separated by one line break.
 * Chinese input  → 中文\nindonesian
 * Indonesian input → 中文\nindonesian
 */
export async function translateBilingualZhId(text) {
  if (!text || text.trim() === "-" || text.trim() === "") return text;
  if (isAlreadyBilingual(text)) {
    return text.trim().replace(/\n{2,}/g, "\n");
  }

  const slashParts = splitBilingualSlash(text);
  if (slashParts) {
    return `${slashParts.zh}\n${slashParts.id}`;
  }

  const source = text.trim();
  const isChinese = detectIsChinese(source);
  const sourceLang = isChinese ? "zh-CN" : "id";
  const targetLang = isChinese ? "id" : "zh-CN";

  try {
    const translated = await translateWithFallback(source, sourceLang, targetLang);
    const zh = (isChinese ? source : translated).trim();
    const id = (isChinese ? translated : source).trim();
    return `${zh}\n${id}`;
  } catch (error) {
    console.error("Bilingual translation failed:", error);
    return text;
  }
}

/**
 * Legacy bilingual translator used by list PDF/Excel exports.
 * Returns indonesian + chinese stacked.
 */
export async function translateText(text) {
  if (!text || text.trim() === "-" || text.trim() === "") return text;

  const local = formatBilingualExportStack(text);
  if (local) return local;

  const isChinese = detectIsChinese(text);
  const sourceLang = isChinese ? "zh-CN" : "id";
  const targetLang = isChinese ? "id" : "zh-CN";

  try {
    const translated = await translateWithFallback(text, sourceLang, targetLang);

    // Result formatting: <indonesian>\n<chinese>
    if (isChinese) {
      return `${translated.toLowerCase()}\n${text}`;
    }
    return `${text.toLowerCase()}\n${translated}`;
  } catch (error) {
    console.error("Translation failed:", error);
    return text;
  }
}

/**
 * Translate free-text (e.g. catatan) into the active UI language only.
 * locale "zh" → Chinese; otherwise Indonesian.
 */
export async function translateToLocale(text, locale = "en") {
  if (!text || text.trim() === "-" || text.trim() === "") return text;

  const fromBilingual = pickLocaleFromBilingual(text, locale);
  if (fromBilingual) return fromBilingual;

  const isChinese = detectIsChinese(text);
  const targetLang = locale === "zh" ? "zh-CN" : "id";

  // Already in target language
  if (
    (targetLang === "zh-CN" && isChinese) ||
    (targetLang === "id" && !isChinese)
  ) {
    return text;
  }

  try {
    const sourceLang = isChinese ? "zh-CN" : "id";
    return await translateWithFallback(text, sourceLang, targetLang);
  } catch (error) {
    console.error("Translation to locale failed:", error);
    return text;
  }
}
