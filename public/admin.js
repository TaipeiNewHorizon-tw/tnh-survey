// admin.js — 後台管理邏輯

let currentUser = null;

// ---------- 初始化：確認登入狀態 ----------

async function initAdmin() {
  try {
    const res = await fetch("/api/admin/me");
    if (!res.ok) { window.location.href = "/login"; return; }
    currentUser = await res.json();
  } catch {
    window.location.href = "/login";
    return;
  }

  // 顯示使用者資訊
  const roleLabel = currentUser.role === "admin" ? "管理員" : "一般人員";
  document.getElementById("current-user-info").textContent =
    `${currentUser.display_name || currentUser.username}（${roleLabel}）`;

  // 管理員才顯示帳號管理與操作紀錄分頁
  if (currentUser.role === "admin") {
    document.querySelectorAll(".admin-only-tab").forEach(el => { el.hidden = false; });
  }

  loadQuestions();
  checkUnread();
  setInterval(checkUnread, 60_000);
}

// 登出
document.getElementById("logout-btn").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/login";
});

const listEl = document.getElementById("question-list");
const formEl = document.getElementById("question-form");
const formTitle = document.getElementById("form-title");
const typeSelect = document.getElementById("q-type");
const optionsField = document.getElementById("options-field");
const cancelBtn = document.getElementById("cancel-edit");
const responseSummaryEl = document.getElementById("response-summary");

// ---------- 未讀徽章 ----------

const unreadBadgeEl = document.getElementById("unread-badge");
const STORAGE_KEY = "tnh_survey_last_seen_id";

function getLastSeenId() {
  return parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10);
}

function markAllRead(maxId) {
  if (maxId > getLastSeenId()) localStorage.setItem(STORAGE_KEY, String(maxId));
  unreadBadgeEl.hidden = true;
}

async function checkUnread() {
  try {
    const res = await fetch(`/api/admin/responses/unread?since=${getLastSeenId()}`);
    const data = await res.json();
    if (data.count > 0) {
      unreadBadgeEl.textContent = data.count > 99 ? "99+" : String(data.count);
      unreadBadgeEl.hidden = false;
      // 存最新的 maxId 備用，讓 markAllRead 可以取用
      unreadBadgeEl.dataset.maxId = data.maxId;
    } else {
      unreadBadgeEl.hidden = true;
    }
  } catch (_) {}
}

// 頁面載入時檢查，之後每 60 秒輪詢一次
checkUnread();
setInterval(checkUnread, 60_000);

// ---------- 分頁切換 ----------

let analyticsLoaded = false;
let responsesLoaded = false;

function switchTab(tabId) {
  document.querySelectorAll(".tab-btn[data-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === "tab-" + tabId);
  });
  if (tabId === "analytics" && !analyticsLoaded) {
    analyticsLoaded = true;
    loadAnalytics();
  }
  if (tabId === "responses") {
    const maxId = parseInt(unreadBadgeEl.dataset.maxId || "0", 10);
    markAllRead(maxId);
    if (!responsesLoaded) {
      responsesLoaded = true;
      respOffset = 0;
      loadResponseList();
    }
  }
  if (tabId === "users") loadUserList();
  if (tabId === "auditlog") { auditOffset = 0; loadAuditLog(); }
}

document.querySelectorAll(".tab-btn[data-tab]").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

const analyticsLikertEl = document.getElementById("analytics-likert");
const analyticsOthersEl = document.getElementById("analytics-others");
const analyticsOpentextEl = document.getElementById("analytics-opentext");

const responseListEl = document.getElementById("response-list");
const respPrevBtn = document.getElementById("resp-prev");
const respNextBtn = document.getElementById("resp-next");
const respPageInfoEl = document.getElementById("resp-page-info");

let questions = [];

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s ?? "";
  return div.innerHTML;
}

function formatTime(utcStr) {
  if (!utcStr) return "";
  // SQLite datetime('now') 回傳 UTC，加 'Z' 後轉台灣時間 (UTC+8)
  const d = new Date(utcStr.replace(" ", "T") + "Z");
  return d.toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
}

// ---------- 題目管理 ----------

function needsOptions(type) {
  return ["choice", "multichoice", "likert5"].includes(type);
}

typeSelect.addEventListener("change", () => {
  optionsField.hidden = !needsOptions(typeSelect.value);
});

async function loadQuestions() {
  const res = await fetch("/api/admin/questions");
  questions = await res.json();
  renderList();
}

function renderList() {
  listEl.innerHTML = "";
  questions.forEach((q, idx) => {
    const row = document.createElement("div");
    row.className = "q-row" + (q.active ? "" : " inactive");

    const meta = document.createElement("div");
    meta.className = "q-meta";
    meta.innerHTML = `
      ${q.section ? `<span class="q-section-tag">${escapeHtml(q.section)}</span>` : ""}
      <div class="q-text">${escapeHtml(q.question_text)}</div>
      <div class="q-sub">類型：${typeLabel(q.type)}　${q.required ? "必填" : "選填"}　${q.active ? "上架中" : "已下架"}</div>
    `;
    row.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "q-actions";

    const upBtn = button("↑", () => moveQuestion(idx, -1));
    const downBtn = button("↓", () => moveQuestion(idx, 1));
    const editBtn = button("編輯", () => startEdit(q));
    const deleteBtn = button("刪除", () => deleteQuestion(q));

    if (idx === 0) upBtn.disabled = true;
    if (idx === questions.length - 1) downBtn.disabled = true;

    actions.append(upBtn, downBtn, editBtn, deleteBtn);
    row.appendChild(actions);

    listEl.appendChild(row);
  });
}

function button(label, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function typeLabel(type) {
  return {
    shorttext: "簡短文字",
    longtext: "長文字",
    date: "日期",
    likert5: "五等量表",
    choice: "單選",
    multichoice: "多選",
  }[type] || type;
}

async function moveQuestion(idx, direction) {
  const other = idx + direction;
  if (other < 0 || other >= questions.length) return;

  [questions[idx], questions[other]] = [questions[other], questions[idx]];
  const order = questions.map((q, i) => ({ id: q.id, order_index: i + 1 }));

  await fetch("/api/admin/questions/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order }),
  });

  await loadQuestions();
}

function startEdit(q) {
  formTitle.textContent = `編輯題目 #${q.id}`;
  document.getElementById("q-id").value = q.id;
  document.getElementById("q-section").value = q.section || "";
  document.getElementById("q-text").value = q.question_text;
  document.getElementById("q-type").value = q.type;
  document.getElementById("q-options").value = (q.options || []).join("\n");
  document.getElementById("q-has-suggestion").checked = q.has_suggestion;
  document.getElementById("q-suggestion-label").value = q.suggestion_label || "";
  document.getElementById("q-required").checked = q.required;
  document.getElementById("q-active").checked = q.active;
  optionsField.hidden = !needsOptions(q.type);
  cancelBtn.hidden = false;
  switchTab("add");
}

function resetForm() {
  formTitle.textContent = "新增題目";
  formEl.reset();
  document.getElementById("q-id").value = "";
  document.getElementById("q-required").checked = true;
  document.getElementById("q-active").checked = true;
  optionsField.hidden = true;
  cancelBtn.hidden = true;
}

cancelBtn.addEventListener("click", () => {
  resetForm();
  switchTab("questions");
});

async function deleteQuestion(q) {
  if (!confirm(`確定要刪除／下架「${q.question_text}」嗎？`)) return;
  const res = await fetch(`/api/admin/questions/${q.id}`, { method: "DELETE" });
  const data = await res.json();
  if (data.mode === "deactivated") {
    alert("此題目已有填寫紀錄，已改為下架（資料保留）。");
  }
  analyticsLoaded = false;
  await loadQuestions();
}

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = document.getElementById("q-id").value;
  const type = document.getElementById("q-type").value;
  const optionsRaw = document.getElementById("q-options").value;

  const payload = {
    section: document.getElementById("q-section").value.trim(),
    question_text: document.getElementById("q-text").value.trim(),
    type,
    options: needsOptions(type)
      ? optionsRaw.split("\n").map((s) => s.trim()).filter(Boolean)
      : null,
    has_suggestion: document.getElementById("q-has-suggestion").checked,
    suggestion_label: document.getElementById("q-suggestion-label").value.trim() || "建議",
    required: document.getElementById("q-required").checked,
    active: document.getElementById("q-active").checked,
  };

  const url = id ? `/api/admin/questions/${id}` : "/api/admin/questions";
  const method = id ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json();
    alert("儲存失敗：" + (data.error || "未知錯誤"));
    return;
  }

  resetForm();
  await loadQuestions();
  analyticsLoaded = false; // 強制下次進入統計分析時重新載入
  switchTab("questions");
});

// ---------- 統計分析 ----------

let analyticsSource = ""; // '' = 全部, 'email', 'qrcode'

document.querySelectorAll(".source-filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".source-filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    analyticsSource = btn.dataset.source;
    loadAnalytics();
  });
});

async function loadAnalytics() {
  const url = analyticsSource
    ? `/api/admin/analytics?source=${encodeURIComponent(analyticsSource)}`
    : "/api/admin/analytics";
  const res = await fetch(url);
  const data = await res.json();
  renderLikertAnalytics(data.likert);
  renderOthersAnalytics(data.others);
  renderOpentextAnalytics(data.opentext || []);
}

// 圓形圖顏色：最高分（非常滿意）→ 最低分（非常不滿意）
const STACKED_COLORS = ["#1a7a1a", "#52c41a", "#aaaaaa", "#fa8c16", "#cf1322"];

function makeDonutSVG(distribution, average, maxScore) {
  const R = 46, C = 2 * Math.PI * R;
  const entries = Object.entries(distribution);
  const total = entries.reduce((s, [, c]) => s + c, 0);
  let segs = "";
  if (total === 0) {
    segs = `<circle cx="60" cy="60" r="${R}" fill="none" stroke="#e2ddd5" stroke-width="13"/>`;
  } else {
    let off = 0;
    entries.forEach(([, count], i) => {
      if (!count) return;
      const len = (count / total) * C;
      segs += `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${STACKED_COLORS[i % STACKED_COLORS.length]}" stroke-width="13" stroke-dasharray="${len.toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`;
      off += len;
    });
  }
  return `<svg width="110" height="110" viewBox="0 0 120 120" style="display:block">
    <g transform="rotate(-90 60 60)">${segs}</g>
    <text x="60" y="57" text-anchor="middle" font-size="21" font-weight="700" fill="#1a1000">${average}</text>
    <text x="60" y="73" text-anchor="middle" font-size="11" fill="#9a8878">平均 / ${maxScore}</text>
  </svg>`;
}

function renderLikertAnalytics(likert) {
  analyticsLikertEl.innerHTML = "";

  const scored = likert.filter((q) => q.average !== null);

  if (likert.length === 0) {
    analyticsLikertEl.innerHTML = '<p class="hint">目前沒有五等量表類型的題目。</p>';
    return;
  }
  if (scored.length === 0) {
    analyticsLikertEl.innerHTML = '<p class="hint">目前尚無填寫資料可供分析。</p>';
    return;
  }

  // ── 整體 KPI ──
  const totalResp = Math.max(...scored.map(q => q.response_count));
  const overallAvg = (scored.reduce((s, q) => s + parseFloat(q.average), 0) / scored.length).toFixed(1);
  let vsCount = 0, vsTotal = 0;
  scored.forEach(q => {
    const entries = Object.entries(q.distribution);
    if (entries.length > 0) vsCount += entries[0][1]; // 非常滿意（第一項）
    vsTotal += Object.values(q.distribution).reduce((a, b) => a + b, 0);
  });
  const vsPct = vsTotal > 0 ? Math.round(vsCount / vsTotal * 100) : 0;

  const bestId  = scored[0].question_id;
  const worstId = scored[scored.length - 1].question_id;

  const summaryHtml = `<div class="analytics-kpi-row">
    <div class="kpi-card">
      <div class="kpi-value">${overallAvg}<span class="kpi-unit"> / 5</span></div>
      <div class="kpi-label">整體平均分</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${vsPct}<span class="kpi-unit">%</span></div>
      <div class="kpi-label">非常滿意平均占比</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${totalResp}</div>
      <div class="kpi-label">總回應筆數</div>
    </div>
  </div>`;

  // ── 題目卡片 ──
  const cardsHtml = likert.map(q => {
    const isScored = q.average !== null;
    const isBest   = scored.length > 1 && q.question_id === bestId;
    const isWorst  = scored.length > 1 && q.question_id === worstId;
    const badge    = isBest  ? '<span class="badge badge-best">表現最佳</span>'
                   : isWorst ? '<span class="badge badge-worst">表現最差</span>'
                   : '';

    const entries = Object.entries(q.distribution);
    const distTotal = entries.reduce((s, [, c]) => s + c, 0);
    const legendHtml = entries.map(([opt, count], i) => {
      const pct = distTotal > 0 ? Math.round(count / distTotal * 100) : 0;
      return `<div class="donut-legend-item">
        <span class="legend-dot" style="background:${STACKED_COLORS[i % STACKED_COLORS.length]}"></span>
        <span class="donut-legend-label">${escapeHtml(opt)}</span>
        <span class="donut-legend-pct">${pct}%</span>
      </div>`;
    }).join('');

    return `<div class="analytics-card">
      <div class="analytics-card-title">${escapeHtml(q.question_text)} ${badge}</div>
      <div class="analytics-card-meta">平均 ${isScored ? q.average : '—'} / ${q.max_score} 分　共 ${q.response_count} 筆</div>
      <div class="analytics-card-body">
        <div class="donut-wrap">${isScored ? makeDonutSVG(q.distribution, q.average, q.max_score) : '<div class="donut-empty">尚無資料</div>'}</div>
        <div class="donut-legend">${legendHtml}</div>
      </div>
    </div>`;
  }).join('');

  analyticsLikertEl.innerHTML = summaryHtml + '<div class="analytics-card-grid">' + cardsHtml + '</div>';
}

function renderOthersAnalytics(others) {
  analyticsOthersEl.innerHTML = "";

  if (others.length === 0) {
    analyticsOthersEl.innerHTML = '<p class="hint">沒有其他單選／多選題目。</p>';
    return;
  }

  others.forEach((q) => {
    const total = Object.values(q.distribution).reduce((a, b) => a + b, 0);
    const wrap = document.createElement("div");
    wrap.className = "analytics-row";

    const lines = Object.entries(q.distribution)
      .map(([opt, count]) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return `<div class="dist-line"><span>${escapeHtml(opt)}</span><span>${count} 筆（${pct}%）</span></div>`;
      })
      .join("");

    wrap.innerHTML = `<div class="analytics-label">${escapeHtml(q.question_text)}</div>${lines}`;
    analyticsOthersEl.appendChild(wrap);
  });
}

function renderOpentextAnalytics(opentext) {
  analyticsOpentextEl.innerHTML = "";

  if (opentext.length === 0) {
    analyticsOpentextEl.innerHTML = '<p class="hint">目前沒有開放式文字題目。</p>';
    return;
  }

  opentext.forEach((q) => {
    const wrap = document.createElement("div");
    wrap.className = "analytics-row";

    const header = document.createElement("div");
    header.className = "analytics-label";
    header.innerHTML = `${escapeHtml(q.question_text)}
      <span class="opentext-count">已填寫 ${q.filled_count} / ${q.total_count} 筆</span>`;
    wrap.appendChild(header);

    if (q.filled_count === 0) {
      const empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "目前尚無填寫內容。";
      wrap.appendChild(empty);
    } else {
      const list = document.createElement("div");
      list.className = "opentext-list";
      q.responses.forEach((item, i) => {
        const el = document.createElement("div");
        el.className = "opentext-item";
        el.title = "點擊查看完整問卷";
        el.innerHTML = `<span class="opentext-num">${i + 1}</span><span class="opentext-text">${escapeHtml(item.text)}</span><span class="opentext-view">查看 ›</span>`;
        el.addEventListener("click", () => openResponseModal(item.response_id));
        list.appendChild(el);
      });
      wrap.appendChild(list);
    }

    analyticsOpentextEl.appendChild(wrap);
  });
}

// ---------- 問卷詳情 Modal ----------

const modalOverlay = document.getElementById("response-modal");
const modalBody = document.getElementById("modal-body");
const modalTitle = document.getElementById("modal-title");
const modalCloseBtn = document.getElementById("modal-close");

modalCloseBtn.addEventListener("click", closeResponseModal);
modalOverlay.addEventListener("click", (e) => { if (e.target === modalOverlay) closeResponseModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeResponseModal(); });

function closeResponseModal() {
  modalOverlay.hidden = true;
  modalBody.innerHTML = "";
}

async function openResponseModal(responseId) {
  modalOverlay.hidden = false;
  modalBody.innerHTML = '<p class="hint">載入中…</p>';
  modalTitle.textContent = `填寫紀錄 #${responseId}`;

  const res = await fetch(`/api/admin/responses/${responseId}`);
  if (!res.ok) {
    modalBody.innerHTML = '<p class="hint">載入失敗，請稍後再試。</p>';
    return;
  }

  const data = await res.json();
  modalTitle.textContent = `填寫紀錄 #${responseId}　${formatTime(data.submitted_at)}`;

  // 依 section 分組
  const sections = [];
  let lastSection = null;
  for (const a of data.answers) {
    const sec = a.section_snapshot || "（未分類）";
    if (sec !== lastSection) {
      sections.push({ section: sec, answers: [] });
      lastSection = sec;
    }
    sections[sections.length - 1].answers.push(a);
  }

  modalBody.innerHTML = sections.map((s) => `
    <div class="modal-section">
      <div class="modal-section-title">${escapeHtml(s.section)}</div>
      ${s.answers.map((a) => `
        <div class="modal-answer">
          <div class="modal-q">${escapeHtml(a.question_text_snapshot)}</div>
          <div class="modal-v">${a.answer_value ? escapeHtml(a.answer_value) : '<span class="hint">（未填）</span>'}</div>
        </div>
      `).join("")}
    </div>
  `).join("");
}

// ---------- 列印單筆問卷 ----------

async function printResponse(responseId) {
  const res = await fetch(`/api/admin/responses/${responseId}`);
  if (!res.ok) { alert("載入失敗，請稍後再試。"); return; }
  const data = await res.json();

  // 依 section 分組
  const sections = [];
  let lastSec = null;
  for (const a of data.answers) {
    const sec = a.section_snapshot || "其他";
    if (sec !== lastSec) { sections.push({ section: sec, answers: [] }); lastSec = sec; }
    sections[sections.length - 1].answers.push(a);
  }

  const sectionsHtml = sections.map((s) => `
    <div class="section">
      <div class="section-title">${s.section}</div>
      ${s.answers.map((a) => `
        <div class="qa-row">
          <div class="q-label">${a.question_text_snapshot}</div>
          ${a.answer_value
            ? `<div class="a-value">${a.answer_value}</div>`
            : `<div class="a-empty">（未填）</div>`}
        </div>
      `).join("")}
    </div>
  `).join("");

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<title>問卷填寫紀錄 #${responseId}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif; font-size: 11pt; color: #000; background: #fff; }
  .page { max-width: 800px; margin: 0 auto; padding: 20mm 18mm; }
  .header { text-align: center; border-bottom: 2.5px solid #000; padding-bottom: 12px; margin-bottom: 20px; }
  .header h1 { font-size: 17pt; font-weight: bold; margin-bottom: 6px; letter-spacing: 1px; }
  .header .meta { font-size: 10pt; color: #444; }
  .section { margin-bottom: 18px; break-inside: avoid; }
  .section-title {
    font-size: 12pt; font-weight: bold;
    background: #e8e8e8; padding: 5px 10px;
    border-left: 5px solid #333; margin-bottom: 10px;
  }
  .qa-row { padding: 7px 10px; border-bottom: 1px solid #ddd; }
  .qa-row:last-child { border-bottom: none; }
  .q-label { font-size: 10pt; color: #555; margin-bottom: 3px; line-height: 1.5; }
  .a-value { font-size: 11pt; font-weight: 700; color: #000; padding-left: 10px; line-height: 1.5; }
  .a-empty { font-size: 10pt; color: #aaa; padding-left: 10px; }
  .footer { margin-top: 24px; text-align: right; font-size: 9pt; color: #888; border-top: 1px solid #ccc; padding-top: 8px; }
  @media print {
    .page { padding: 0; }
    @page { size: A4; margin: 15mm 18mm; }
    .section { break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <h1>臺北文創場地參與體驗滿意度調查</h1>
    <div class="meta">填寫紀錄 #${responseId}　　填寫時間：${formatTime(data.submitted_at)}</div>
  </div>
  ${sectionsHtml}
  <div class="footer">列印時間：${new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}</div>
</div>
<script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) { alert("請允許瀏覽器開啟彈出視窗後再試。"); return; }
  win.document.write(html);
  win.document.close();
}

// ---------- 填寫紀錄（分頁瀏覽）----------

const PAGE_SIZE = 10;
let respOffset = 0;
let respTotal = 0;

async function loadResponseList() {
  const res = await fetch(`/api/admin/responses?limit=${PAGE_SIZE}&offset=${respOffset}`);
  const data = await res.json();
  respTotal = data.total;
  responseSummaryEl.textContent = `目前共有 ${respTotal} 筆填寫紀錄。`;
  renderResponseList(data.items);
  updatePagination();
}

function renderResponseList(items) {
  responseListEl.innerHTML = "";

  if (items.length === 0) {
    responseListEl.innerHTML = '<p class="hint">目前還沒有填寫紀錄。</p>';
    return;
  }

  items.forEach((r) => {
    const card = document.createElement("div");
    card.className = "response-card";

    const header = document.createElement("div");
    header.className = "response-card-header";

    const headerLeft = document.createElement("span");
    let sourceBadge = "";
    if (r.source === "email")  sourceBadge = '<span class="source-badge source-badge--email">📧 Email邀請</span>';
    if (r.source === "qrcode") sourceBadge = '<span class="source-badge source-badge--qrcode">📱 QR Code</span>';
    headerLeft.innerHTML = `#${r.id}　${formatTime(r.submitted_at)}${sourceBadge}`;

    const headerRight = document.createElement("span");
    headerRight.style.display = "flex";
    headerRight.style.alignItems = "center";
    headerRight.style.gap = "8px";

    const toggleArrow = document.createElement("span");
    toggleArrow.className = "toggle-arrow";
    toggleArrow.textContent = "展開 ▾";

    const printBtn = document.createElement("button");
    printBtn.type = "button";
    printBtn.className = "resp-print-btn";
    printBtn.textContent = "列印";
    printBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await printResponse(r.id);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "resp-delete-btn";
    deleteBtn.textContent = "刪除";
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const pwd = prompt(`請輸入管理員密碼以刪除第 #${r.id} 筆紀錄：`);
      if (pwd === null) return; // 按取消
      if (!confirm(`確定要刪除第 #${r.id} 筆填寫紀錄？此操作無法復原。`)) return;
      const res = await fetch(`/api/admin/responses/${r.id}`, {
        method: "DELETE",
        headers: { "X-Delete-Password": pwd },
      });
      if (res.ok) {
        card.remove();
        respTotal--;
        responseSummaryEl.textContent = `目前共有 ${respTotal} 筆填寫紀錄。`;
        analyticsLoaded = false;
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "刪除失敗，請稍後再試。");
      }
    });

    headerRight.append(toggleArrow, printBtn, deleteBtn);
    header.append(headerLeft, headerRight);

    const body = document.createElement("div");
    body.className = "response-card-body";
    body.hidden = true;
    body.innerHTML = r.answers
      .map(
        (a) => `
      <div class="answer-line">
        <div class="answer-q">${a.section_snapshot ? `[${escapeHtml(a.section_snapshot)}] ` : ""}${escapeHtml(a.question_text_snapshot)}</div>
        <div class="answer-v">${a.answer_value ? escapeHtml(a.answer_value) : '<span class="hint">（未填）</span>'}</div>
        ${a.suggestion_text ? `<div class="answer-sug">補充：${escapeHtml(a.suggestion_text)}</div>` : ""}
      </div>
    `
      )
      .join("");

    header.addEventListener("click", () => {
      body.hidden = !body.hidden;
      toggleArrow.textContent = body.hidden ? "展開 ▾" : "收合 ▴";
    });

    card.append(header, body);
    responseListEl.appendChild(card);
  });
}

function updatePagination() {
  const page = Math.floor(respOffset / PAGE_SIZE) + 1;
  const totalPages = Math.max(Math.ceil(respTotal / PAGE_SIZE), 1);
  respPageInfoEl.textContent = `第 ${page} / ${totalPages} 頁`;
  respPrevBtn.disabled = respOffset <= 0;
  respNextBtn.disabled = respOffset + PAGE_SIZE >= respTotal;
}

respPrevBtn.addEventListener("click", () => {
  respOffset = Math.max(respOffset - PAGE_SIZE, 0);
  loadResponseList();
});
respNextBtn.addEventListener("click", () => {
  respOffset += PAGE_SIZE;
  loadResponseList();
});

// ---------- 帳號管理 ----------

async function loadUserList() {
  const res = await fetch("/api/admin/users");
  if (!res.ok) return;
  const users = await res.json();
  const listEl = document.getElementById("user-list");
  listEl.innerHTML = "";
  if (users.length === 0) { listEl.innerHTML = '<p class="hint">目前沒有帳號。</p>'; return; }
  users.forEach(u => {
    const row = document.createElement("div");
    row.className = "user-row" + (u.active ? "" : " user-inactive");
    const roleBadge = u.role === "admin"
      ? '<span class="role-badge role-badge--admin">管理員</span>'
      : '<span class="role-badge role-badge--staff">一般人員</span>';
    row.innerHTML = `
      <div class="user-info">
        <div class="user-name">${escapeHtml(u.username)}${u.display_name ? `　${escapeHtml(u.display_name)}` : ""} ${roleBadge}</div>
        <div class="user-meta">建立：${formatTime(u.created_at)}　${u.active ? "啟用中" : "已停用"}</div>
      </div>
      <div class="user-actions"></div>
    `;
    const actions = row.querySelector(".user-actions");

    // 停用/啟用
    const toggleBtn = document.createElement("button");
    toggleBtn.textContent = u.active ? "停用" : "啟用";
    toggleBtn.addEventListener("click", async () => {
      await fetch(`/api/admin/users/${u.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: u.active ? false : true }),
      });
      loadUserList();
    });
    actions.appendChild(toggleBtn);

    // 重設密碼
    const pwdBtn = document.createElement("button");
    pwdBtn.textContent = "重設密碼";
    pwdBtn.addEventListener("click", async () => {
      const pwd = prompt(`請輸入「${u.username}」的新密碼：`);
      if (!pwd) return;
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      if (res.ok) alert("密碼已更新。");
      else alert("更新失敗。");
    });
    actions.appendChild(pwdBtn);

    // 刪除（不能刪自己）
    if (u.id !== currentUser.id) {
      const delBtn = document.createElement("button");
      delBtn.textContent = "刪除";
      delBtn.className = "del-btn";
      delBtn.addEventListener("click", async () => {
        if (!confirm(`確定要刪除帳號「${u.username}」嗎？`)) return;
        const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
        if (res.ok) loadUserList();
        else { const d = await res.json(); alert(d.error || "刪除失敗"); }
      });
      actions.appendChild(delBtn);
    }

    listEl.appendChild(row);
  });
}

document.getElementById("add-user-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    username: document.getElementById("new-username").value.trim(),
    password: document.getElementById("new-password").value,
    display_name: document.getElementById("new-display-name").value.trim(),
    role: document.getElementById("new-role").value,
  };
  const res = await fetch("/api/admin/users", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) { alert("新增失敗：" + (data.error || "未知錯誤")); return; }
  alert(`帳號「${payload.username}」已新增。`);
  e.target.reset();
  loadUserList();
});

document.getElementById("delete-password-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const pwd = document.getElementById("new-delete-password").value;
  const res = await fetch("/api/admin/settings/delete-password", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: pwd }),
  });
  if (res.ok) { alert("刪除密碼已更新。"); e.target.reset(); }
  else { const d = await res.json(); alert(d.error || "更新失敗"); }
});

// ---------- 操作紀錄 ----------

const AUDIT_PAGE_SIZE = 30;
let auditOffset = 0;
let auditTotal = 0;

const ACTION_LABELS = {
  LOGIN: "登入", LOGOUT: "登出",
  DELETE_RESPONSE: "刪除填寫紀錄", ADD_USER: "新增帳號",
  EDIT_USER: "編輯帳號", DELETE_USER: "刪除帳號",
  CHANGE_DELETE_PASSWORD: "變更刪除密碼", SEND_INVITE: "發送邀請",
};

async function loadAuditLog() {
  const res = await fetch(`/api/admin/audit-logs?limit=${AUDIT_PAGE_SIZE}&offset=${auditOffset}`);
  const data = await res.json();
  auditTotal = data.total;
  const listEl = document.getElementById("audit-log-list");
  listEl.innerHTML = "";
  if (data.items.length === 0) { listEl.innerHTML = '<p class="hint">目前沒有操作紀錄。</p>'; return; }
  data.items.forEach(log => {
    const row = document.createElement("div");
    row.className = "audit-row";
    const label = ACTION_LABELS[log.action] || log.action;
    row.innerHTML = `
      <span class="audit-time">${formatTime(log.created_at)}</span>
      <span class="audit-user">${escapeHtml(log.username)}</span>
      <span class="audit-action">${escapeHtml(label)}${log.target ? `　<span class="audit-target">${escapeHtml(log.target)}</span>` : ""}${log.details ? `　<span class="audit-target">${escapeHtml(log.details)}</span>` : ""}</span>
    `;
    listEl.appendChild(row);
  });
  const page = Math.floor(auditOffset / AUDIT_PAGE_SIZE) + 1;
  const totalPages = Math.max(Math.ceil(auditTotal / AUDIT_PAGE_SIZE), 1);
  document.getElementById("audit-page-info").textContent = `第 ${page} / ${totalPages} 頁　共 ${auditTotal} 筆`;
  document.getElementById("audit-prev").disabled = auditOffset <= 0;
  document.getElementById("audit-next").disabled = auditOffset + AUDIT_PAGE_SIZE >= auditTotal;
}

document.getElementById("audit-prev").addEventListener("click", () => { auditOffset = Math.max(auditOffset - AUDIT_PAGE_SIZE, 0); loadAuditLog(); });
document.getElementById("audit-next").addEventListener("click", () => { auditOffset += AUDIT_PAGE_SIZE; loadAuditLog(); });

// ---------- 發送邀請 ----------

const inviteSendBtn = document.getElementById("invite-send-btn");
const inviteEmailsEl = document.getElementById("invite-emails");
const inviteSubjectEl = document.getElementById("invite-subject");
const inviteMessageEl = document.getElementById("invite-message");
const inviteResultEl = document.getElementById("invite-result");

inviteSendBtn.addEventListener("click", async () => {
  const to = inviteEmailsEl.value.trim();
  if (!to) { alert("請輸入收件人 Email。"); return; }

  const emails = to.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
  const subject = inviteSubjectEl.value.trim() || "邀請您填寫臺北文創場地體驗滿意度問卷";
  const message = inviteMessageEl.value.trim() || "";

  inviteSendBtn.disabled = true;
  inviteSendBtn.textContent = "發送中...";
  inviteResultEl.hidden = true;

  try {
    const res = await fetch("/api/admin/send-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails, subject, message }),
    });
    const data = await res.json();

    if (!res.ok) {
      inviteResultEl.className = "error-box";
      inviteResultEl.textContent = "❌ " + (data.error || "發送失敗");
    } else {
      const errMsg = data.errors?.length
        ? `（${data.errors.length} 個地址失敗：${data.errors.map(e => e.email).join("、")}）`
        : "";
      inviteResultEl.className = "success";
      inviteResultEl.textContent = `✅ 已成功發送 ${data.sent} / ${data.total} 封邀請信。${errMsg}`;
    }
  } catch (e) {
    inviteResultEl.className = "error-box";
    inviteResultEl.textContent = "❌ 網路錯誤，請稍後再試。";
  } finally {
    inviteSendBtn.disabled = false;
    inviteSendBtn.textContent = "📨 發送邀請信";
    inviteResultEl.hidden = false;
  }
});

// ---------- 啟動 ----------
initAdmin();
