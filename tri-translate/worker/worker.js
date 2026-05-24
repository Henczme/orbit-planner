const googleTranslateUrl = "https://translation.googleapis.com/language/translate/v2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
const languageKeys = ["zh", "en", "de"];

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (request.method !== "POST") return json({ error: "Only POST is supported." }, 405);
    if (!env.GOOGLE_TRANSLATE_API_KEY) return json({ error: "Worker 缺少 GOOGLE_TRANSLATE_API_KEY secret。" }, 500);

    try {
      const body = await request.json();
      const text = String(body.text || "").trim();
      if (!text) return json({ error: "Text is required." }, 400);
      if (text.length > 5000) return json({ error: "一次最多翻译 5000 个字符。" }, 400);

      const firstTarget = guessFirstTarget(text);
      const first = await translateText(env.GOOGLE_TRANSLATE_API_KEY, text, firstTarget);
      const sourceLanguage = normalizeLanguage(first.detectedSourceLanguage || guessLanguage(text));
      const targets = languageKeys.filter((lang) => lang !== sourceLanguage);
      const translations = { [sourceLanguage]: text };

      await Promise.all(targets.map(async (target) => {
        if (target === firstTarget) {
          translations[target] = first.translatedText;
          return;
        }
        translations[target] = (await translateText(env.GOOGLE_TRANSLATE_API_KEY, text, target)).translatedText;
      }));

      return json({ sourceLanguage, translations });
    } catch (error) {
      return json({ error: error.message || "Translation failed." }, 500);
    }
  }
};

async function translateText(apiKey, text, target) {
  const response = await fetch(`${googleTranslateUrl}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: text,
      target: target === "zh" ? "zh-CN" : target,
      format: "text"
    })
  });
  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || "Google Translation API request failed.";
    throw new Error(message);
  }
  const item = payload.data.translations[0];
  return {
    translatedText: decodeHtmlEntities(item.translatedText),
    detectedSourceLanguage: item.detectedSourceLanguage
  };
}

function guessFirstTarget(text) {
  const guessed = guessLanguage(text);
  return guessed === "en" ? "de" : "en";
}

function guessLanguage(text) {
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";
  if (/[äöüßÄÖÜ]/.test(text)) return "de";
  return "en";
}

function normalizeLanguage(value) {
  const lang = String(value || "").toLowerCase();
  if (lang.startsWith("zh") || lang === "cmn") return "zh";
  if (lang.startsWith("de")) return "de";
  return "en";
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'");
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
