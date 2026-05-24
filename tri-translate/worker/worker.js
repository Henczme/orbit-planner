const googleTranslateUrl = "https://translation.googleapis.com/language/translate/v2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
const languageKeys = ["zh", "en", "de"];
const defaultDailyCharacterLimit = 15000;

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
      const estimatedCharacters = text.length * 2;
      const usage = await checkDailyUsage(env, estimatedCharacters);
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

      return json({ sourceLanguage, translations, usage });
    } catch (error) {
      return json({ error: error.message || "Translation failed." }, 500);
    }
  }
};

async function checkDailyUsage(env, characters) {
  const limit = Number(env.DAILY_CHARACTER_LIMIT || defaultDailyCharacterLimit);
  if (!env.TRI_TRANSLATE_USAGE) return { used: 0, limit, counted: false };
  const key = `usage:${new Date().toISOString().slice(0, 10)}`;
  const used = Number(await env.TRI_TRANSLATE_USAGE.get(key)) || 0;
  if (used + characters > limit) {
    throw new Error(`今天的免费额度保护已触发：${used}/${limit} 字符。明天会自动恢复。`);
  }
  const nextUsed = used + characters;
  await env.TRI_TRANSLATE_USAGE.put(key, String(nextUsed), { expirationTtl: 60 * 60 * 48 });
  return { used: nextUsed, limit, counted: true };
}

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
