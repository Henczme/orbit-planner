const storageKey = "tri_translate_settings_v1";
const defaultWorkerUrl = "https://tri-translate.hzyme1996.workers.dev";
const languages = {
  zh: { code: "zh-CN", label: "中文", voice: "zh-CN", element: "resultZh" },
  en: { code: "en", label: "English", voice: "en-US", element: "resultEn" },
  de: { code: "de", label: "Deutsch", voice: "de-DE", element: "resultDe" }
};
const languageOrder = ["zh", "en", "de"];
const sourceText = document.querySelector("#sourceText");
const translateButton = document.querySelector("#translateButton");
const clearText = document.querySelector("#clearText");
const speakSource = document.querySelector("#speakSource");
const statusText = document.querySelector("#statusText");
const detectedLabel = document.querySelector("#detectedLabel");
const settingsToggle = document.querySelector("#settingsToggle");
const settingsPanel = document.querySelector("#settingsPanel");
const settingsForm = document.querySelector("#settingsForm");
const workerUrl = document.querySelector("#workerUrl");
const cards = [...document.querySelectorAll("[data-lang-card]")];
let typingTimer = null;
let lastRequestId = 0;

init();

function init() {
  const settings = loadSettings();
  workerUrl.value = settings.workerUrl || "";
  bindEvents();
  registerServiceWorker();
}

function bindEvents() {
  translateButton.addEventListener("click", translateNow);
  clearText.addEventListener("click", clearAll);
  speakSource.addEventListener("click", () => speak(sourceText.value, detectLocalLanguage(sourceText.value)));
  sourceText.addEventListener("input", () => {
    updateDetectedLabel(detectLocalLanguage(sourceText.value));
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      if (sourceText.value.trim().length >= 2) translateNow();
    }, 650);
  });
  settingsToggle.addEventListener("click", () => settingsPanel.classList.toggle("open"));
  settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveSettings({ workerUrl: normalizeWorkerUrl(workerUrl.value) });
    workerUrl.value = normalizeWorkerUrl(workerUrl.value);
    settingsPanel.classList.remove("open");
    setStatus("已保存 Worker 地址。");
  });
  document.addEventListener("click", (event) => {
    const speakButton = event.target.closest("[data-speak]");
    if (!speakButton) return;
    const lang = normalizeLanguage(speakButton.dataset.speak);
    const text = document.querySelector(`#${languages[lang].element}`).textContent;
    speak(text, lang);
  });
}

async function translateNow() {
  const text = sourceText.value.trim();
  const settings = loadSettings();
  if (!settings.workerUrl) {
    settingsPanel.classList.add("open");
    setStatus("先填写 Cloudflare Worker 地址。");
    return;
  }
  if (!text) {
    clearAll();
    return;
  }
  const requestId = ++lastRequestId;
  setStatus("正在翻译...");
  translateButton.disabled = true;
  try {
    const response = await fetch(settings.workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "翻译失败。");
    if (requestId !== lastRequestId) return;
    renderResults(payload);
    setStatus(payload.usage?.counted ? `已翻译。今日用量约 ${payload.usage.used}/${payload.usage.limit} 字符。` : "已翻译。");
  } catch (error) {
    setStatus(error.message || "翻译失败，请检查 Worker 地址。");
  } finally {
    if (requestId === lastRequestId) translateButton.disabled = false;
  }
}

function renderResults(payload) {
  const sourceLanguage = normalizeLanguage(payload.sourceLanguage);
  updateDetectedLabel(sourceLanguage);
  languageOrder.forEach((lang) => {
    const result = payload.translations?.[lang] || (lang === sourceLanguage ? sourceText.value.trim() : "");
    document.querySelector(`#${languages[lang].element}`).textContent = result || "暂无结果";
  });
  cards.forEach((card) => {
    card.dataset.active = normalizeLanguage(card.dataset.langCard) === sourceLanguage ? "true" : "false";
  });
}

function clearAll() {
  sourceText.value = "";
  detectedLabel.textContent = "自动识别";
  document.querySelector("#resultZh").textContent = "等待输入";
  document.querySelector("#resultEn").textContent = "Waiting";
  document.querySelector("#resultDe").textContent = "Warten";
  cards.forEach((card) => card.dataset.active = "false");
  setStatus("输入后点翻译，或停顿片刻自动翻译。");
  sourceText.focus();
}

function speak(text, lang) {
  const cleanText = String(text || "").trim();
  if (!cleanText || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = languages[normalizeLanguage(lang)].voice;
  utterance.rate = 0.92;
  window.speechSynthesis.speak(utterance);
}

function updateDetectedLabel(lang) {
  if (!sourceText.value.trim()) {
    detectedLabel.textContent = "自动识别";
    return;
  }
  detectedLabel.textContent = `识别为 ${languages[normalizeLanguage(lang)].label}`;
}

function detectLocalLanguage(text) {
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

function normalizeWorkerUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function setStatus(message) {
  statusText.textContent = message;
}

function loadSettings() {
  try {
    const settings = { workerUrl: defaultWorkerUrl, ...(JSON.parse(localStorage.getItem(storageKey)) || {}) };
    if (!settings.workerUrl || settings.workerUrl.includes("your-name.workers.dev")) settings.workerUrl = defaultWorkerUrl;
    return settings;
  } catch {
    return { workerUrl: defaultWorkerUrl };
  }
}

function saveSettings(settings) {
  localStorage.setItem(storageKey, JSON.stringify(settings));
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}
