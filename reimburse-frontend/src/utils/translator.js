/**
 * Simple text translator using a free Google Translate API endpoint
 */

function detectIsChinese(text) {
  return /[\u4e00-\u9fa5]/.test(text);
}

function detectHasLatin(text) {
  return /[A-Za-z]/.test(text);
}

async function googleTranslate(text, sourceLang, targetLang) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Translation API error: ${response.status}`);
  }
  const data = await response.json();
  let translated = "";
  if (data && data[0]) {
    data[0].forEach((item) => {
      if (item[0]) translated += item[0];
    });
  }
  return translated || text;
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
 * Always returns Chinese then Indonesian, separated by one line break.
 * Chinese input  → 中文\nindonesian
 * Indonesian input → 中文\nindonesian
 */
export async function translateBilingualZhId(text) {
  if (!text || text.trim() === "-" || text.trim() === "") return text;
  if (isAlreadyBilingual(text)) {
    return text.trim().replace(/\n{2,}/g, "\n");
  }

  const source = text.trim();
  const isChinese = detectIsChinese(source);
  const sourceLang = isChinese ? "zh-CN" : "id";
  const targetLang = isChinese ? "id" : "zh-CN";

  try {
    const translated = await googleTranslate(source, sourceLang, targetLang);
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

  const isChinese = detectIsChinese(text);
  const sourceLang = isChinese ? "zh-CN" : "id";
  const targetLang = isChinese ? "id" : "zh-CN";

  try {
    const translated = await googleTranslate(text, sourceLang, targetLang);

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
    return await googleTranslate(text, sourceLang, targetLang);
  } catch (error) {
    console.error("Translation to locale failed:", error);
    return text;
  }
}
