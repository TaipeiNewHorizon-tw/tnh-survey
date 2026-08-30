// app.js — 手機填寫頁面邏輯：抓題目、動態畫出表單、送出答案、多語言切換
// 介面文字翻譯定義在 i18n.js（SURVEY_STRINGS / SURVEY_LANG_OPTIONS），此檔案在 index.html 中排在 i18n.js 之後載入。

const questionsEl = document.getElementById("questions");
const formEl = document.getElementById("survey-form");
const submitBtn = document.getElementById("submit-btn");
const thankyouEl = document.getElementById("thankyou");
const errorEl = document.getElementById("error");
const langSwitcherEl = document.getElementById("lang-switcher");

// 讀取問卷來源（email 邀請 / qrcode 掃碼 / 其他）
const surveySource = new URLSearchParams(window.location.search).get("source") || null;

const LANG_STORAGE_KEY = "tnh_survey_lang";

let questions = [];
let currentLang = getInitialLang();

// ---------- 語言判斷與切換 ----------

function getInitialLang() {
  const urlLang = new URLSearchParams(window.location.search).get("lang");
  if (urlLang && SURVEY_LANGS.includes(urlLang)) return urlLang;

  let saved = null;
  try {
    saved = localStorage.getItem(LANG_STORAGE_KEY);
  } catch (_) {}
  if (saved && SURVEY_LANGS.includes(saved)) return saved;

  const browserLang = (navigator.language || "zh").toLowerCase();
  if (browserLang.startsWith("en")) return "en";
  if (browserLang.startsWith("ja")) return "ja";
  return "zh";
}

function setLang(lang) {
  if (!SURVEY_LANGS.includes(lang) || lang === currentLang) return;
  currentLang = lang;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch (_) {}

  document.documentElement.lang = SURVEY_STRINGS[lang].htmlLang;

  // 讓網址列同步 ?lang=，方便直接分享特定語言版本的連結（不觸發整頁重新載入）
  const url = new URL(window.location.href);
  url.searchParams.set("lang", lang);
  window.history.replaceState({}, "", url);

  applyStaticText();
  renderLangSwitcher();
  loadQuestions();
}

function renderLangSwitcher() {
  langSwitcherEl.innerHTML = "";
  SURVEY_LANG_OPTIONS.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lang-btn" + (opt.code === currentLang ? " active" : "");
    btn.textContent = opt.label;
    btn.addEventListener("click", () => setLang(opt.code));
    langSwitcherEl.appendChild(btn);
  });
}

function applyStaticText() {
  const t = SURVEY_STRINGS[currentLang];

  document.getElementById("page-title").textContent = t.pageTitle;
  document.getElementById("heading").textContent = t.heading;
  document.getElementById("intro").textContent = t.intro;
  submitBtn.textContent = t.submit;
  document.getElementById("thankyou-main").textContent = t.thankyouMain;
  document.getElementById("thankyou-see-you").textContent = t.thankyouSeeYou;
  document.getElementById("social-title").textContent = t.socialTitle;
  document.getElementById("social-caption").textContent = t.socialCaption;

  // 社群連結的文字內容（emoji + 名稱），連結網址本身不隨語言改變
  setLinkText("social-site", t.socialSite);
  setLinkText("social-app-apple", t.socialAppApple);
  setLinkText("social-app-google", t.socialAppGoogle);
  setLinkText("social-fb", t.socialFb);
  setLinkText("social-ig", t.socialIg);
}

function setLinkText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ---------- 表單渲染 ----------

function fieldName(q, suffix = "") {
  return `q_${q.id}${suffix}`;
}

function renderQuestion(q) {
  const wrap = document.createElement("div");
  wrap.className = "question";

  const label = document.createElement("label");
  label.className = "question-label";
  label.textContent = q.question_text;
  if (q.required) {
    const star = document.createElement("span");
    star.className = "required-mark";
    star.textContent = "*";
    label.appendChild(star);
  }
  wrap.appendChild(label);

  // options 永遠是中文原文（送出答案用的實際值，確保跨語言版本的統計可以互相比較加總），
  // optionsDisplay 是依目前語言顯示給使用者看的文字，兩個陣列一一對應（順序、長度相同）。
  const canonicalOptions = q.options || [];
  const displayOptions = (q.options_display && q.options_display.length === canonicalOptions.length)
    ? q.options_display
    : canonicalOptions;

  if (q.type === "shorttext") {
    const input = document.createElement("input");
    input.type = "text";
    input.name = fieldName(q);
    wrap.appendChild(input);
  } else if (q.type === "date") {
    const input = document.createElement("input");
    input.type = "date";
    input.name = fieldName(q);
    wrap.appendChild(input);
  } else if (q.type === "longtext") {
    const textarea = document.createElement("textarea");
    textarea.name = fieldName(q);
    wrap.appendChild(textarea);
  } else if (q.type === "likert5" || q.type === "choice") {
    const row = document.createElement("div");
    row.className = "options-row";
    canonicalOptions.forEach((opt, i) => {
      const optLabel = document.createElement("label");
      optLabel.className = "option-label";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = fieldName(q);
      input.value = opt;
      optLabel.appendChild(input);
      optLabel.appendChild(document.createTextNode(displayOptions[i]));
      row.appendChild(optLabel);
    });
    wrap.appendChild(row);
  } else if (q.type === "multichoice") {
    const row = document.createElement("div");
    row.className = "options-row";
    canonicalOptions.forEach((opt, i) => {
      const optLabel = document.createElement("label");
      optLabel.className = "option-label";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = fieldName(q);
      input.value = opt;
      optLabel.appendChild(input);
      optLabel.appendChild(document.createTextNode(displayOptions[i]));
      row.appendChild(optLabel);
    });
    wrap.appendChild(row);
  }

  if (q.has_suggestion) {
    const sugWrap = document.createElement("div");
    sugWrap.className = "suggestion-field";
    const sugLabel = document.createElement("label");
    sugLabel.textContent = q.suggestion_label || "建議";
    const sugInput = document.createElement("input");
    sugInput.type = "text";
    sugInput.name = fieldName(q, "_suggestion");
    sugWrap.appendChild(sugLabel);
    sugWrap.appendChild(sugInput);
    wrap.appendChild(sugWrap);
  }

  return wrap;
}

function renderForm() {
  questionsEl.innerHTML = "";
  let lastSection = null;

  questions.forEach((q) => {
    if (q.section && q.section !== lastSection) {
      const heading = document.createElement("div");
      heading.className = "section-title";
      heading.textContent = q.section;
      questionsEl.appendChild(heading);
      lastSection = q.section;
    }
    questionsEl.appendChild(renderQuestion(q));
  });
}

function collectAnswers() {
  const formData = new FormData(formEl);
  return questions.map((q) => {
    let value;
    if (q.type === "multichoice") {
      value = formData.getAll(fieldName(q)).join("、");
    } else {
      value = formData.get(fieldName(q)) || "";
    }
    const suggestion = q.has_suggestion ? formData.get(fieldName(q, "_suggestion")) || "" : null;
    return { question_id: q.id, answer_value: value, suggestion_text: suggestion };
  });
}

async function loadQuestions() {
  const url = currentLang === "zh" ? "/api/questions" : `/api/questions?lang=${currentLang}`;
  const res = await fetch(url);
  questions = await res.json();
  renderForm();
}

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  submitBtn.disabled = true;
  submitBtn.textContent = SURVEY_STRINGS[currentLang].submitting;

  try {
    const res = await fetch("/api/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: collectAnswers(), source: surveySource, lang: currentLang }),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || SURVEY_STRINGS[currentLang].submitError);
    }

    formEl.hidden = true;
    thankyouEl.hidden = false;
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = SURVEY_STRINGS[currentLang].submit;
  }
});

document.documentElement.lang = SURVEY_STRINGS[currentLang].htmlLang;
applyStaticText();
renderLangSwitcher();
loadQuestions();
