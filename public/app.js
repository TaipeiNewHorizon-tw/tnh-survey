// app.js — 手機填寫頁面邏輯：抓題目、動態畫出表單、送出答案

const questionsEl = document.getElementById("questions");
const formEl = document.getElementById("survey-form");
const submitBtn = document.getElementById("submit-btn");
const thankyouEl = document.getElementById("thankyou");
const errorEl = document.getElementById("error");

// 讀取問卷來源（email 邀請 / qrcode 掃碼 / 其他）
const surveySource = new URLSearchParams(window.location.search).get("source") || null;

let questions = [];

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
    (q.options || []).forEach((opt, i) => {
      const optLabel = document.createElement("label");
      optLabel.className = "option-label";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = fieldName(q);
      input.value = opt;
      optLabel.appendChild(input);
      optLabel.appendChild(document.createTextNode(opt));
      row.appendChild(optLabel);
    });
    wrap.appendChild(row);
  } else if (q.type === "multichoice") {
    const row = document.createElement("div");
    row.className = "options-row";
    (q.options || []).forEach((opt) => {
      const optLabel = document.createElement("label");
      optLabel.className = "option-label";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = fieldName(q);
      input.value = opt;
      optLabel.appendChild(input);
      optLabel.appendChild(document.createTextNode(opt));
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
  const res = await fetch("/api/questions");
  questions = await res.json();
  renderForm();
}

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  submitBtn.disabled = true;
  submitBtn.textContent = "送出中...";

  try {
    const res = await fetch("/api/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: collectAnswers(), source: surveySource }),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "送出失敗，請稍後再試");
    }

    formEl.hidden = true;
    thankyouEl.hidden = false;
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = "送出問卷";
  }
});

loadQuestions();
