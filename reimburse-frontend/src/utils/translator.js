/**
 * Simple text translator using a free Google Translate API endpoint
 */
export async function translateText(text) {
  if (!text || text.trim() === "-" || text.trim() === "") return text;

  // Detect Chinese characters
  const isChinese = /[\u4e00-\u9fa5]/.test(text);

  const sourceLang = isChinese ? "zh-CN" : "id";
  const targetLang = isChinese ? "id" : "zh-CN";

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Translation API error: ${response.status}`);
    }

    const data = await response.json();

    // Google API returns nested arrays: [[[translatedText, originalText, null, null, 1]], null, "id"]
    let translated = "";
    if (data && data[0]) {
      data[0].forEach((item) => {
        if (item[0]) translated += item[0];
      });
    }

    if (!translated) return text; // fallback

    // Result formatting: <indonesian> <chinese>
    if (isChinese) {
      return `${translated.toLowerCase()} ${text}`;
    } else {
      return `${text.toLowerCase()} ${translated}`;
    }
  } catch (error) {
    console.error("Translation failed:", error);
    return text; // Return original on error
  }
}
