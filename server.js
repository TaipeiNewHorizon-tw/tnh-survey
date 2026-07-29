// server.js — 問卷網站主程式
//
// 路由規劃：
//   GET  /                          手機填寫頁面（public/index.html）
//   GET  /admin                     後台管理頁面（需密碼，public/admin.html）
//   GET  /api/questions             取得目前上架中的題目（給填寫頁面用）
//   POST /api/responses             送出一份問卷填寫結果
//   GET  /api/admin/questions       後台：取得全部題目（含已下架）
//   POST /api/admin/questions       後台：新增題目
//   PUT  /api/admin/questions/:id   後台：編輯題目
//   DELETE /api/admin/questions/:id 後台：刪除或下架題目
//   POST /api/admin/questions/reorder  後台：調整題目順序
//   GET  /api/admin/responses       後台：分頁取得填寫結果（?limit=&offset=，逐筆查詢用）
//   GET  /api/admin/analytics       後台：統計分析（五等量表平均分數排名、單選/多選分布）
//   GET  /api/admin/responses.csv   後台：匯出 CSV（可直接用 Excel 開啟分析）

require("dotenv").config();
const path = require("path");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { Resend } = require("resend");
const db = require("./db");

// ---------- 電子郵件通知 ----------

const emailEnabled = !!(process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL_TO);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function sendResponseNotification(responseId, answers) {
  if (!resend) return;

  // 取出基本資料欄位作為郵件摘要
  const get = (label) => {
    const a = answers.find((x) =>
      x.question_text_snapshot && x.question_text_snapshot.includes(label)
    );
    return a && a.answer_value ? a.answer_value : "（未填）";
  };

  const activityName = get("活動名稱");
  const floor       = get("樓層");
  const date        = get("活動日期");
  const name        = get("姓名");
  const email       = get("E-MAIL");
  const identity    = get("身分");

  const adminUrl = `https://tnh-customet-survey-production.up.railway.app/admin`;
  const now = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;border:1px solid #eee;border-radius:8px;overflow:hidden;">
      <div style="background:#007AFF;color:#fff;padding:16px 20px;">
        <h2 style="margin:0;font-size:16px;">📋 新問卷填寫通知 #${responseId}</h2>
        <p style="margin:4px 0 0;font-size:12px;opacity:.85;">${now}</p>
      </div>
      <div style="padding:20px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:6px 0;color:#888;width:90px;">活動名稱</td><td style="padding:6px 0;font-weight:600;">${activityName}</td></tr>
          <tr><td style="padding:6px 0;color:#888;">樓層/廳別</td><td style="padding:6px 0;">${floor}</td></tr>
          <tr><td style="padding:6px 0;color:#888;">活動日期</td><td style="padding:6px 0;">${date}</td></tr>
          <tr><td style="padding:6px 0;color:#888;">填表人</td><td style="padding:6px 0;">${name}</td></tr>
          <tr><td style="padding:6px 0;color:#888;">E-MAIL</td><td style="padding:6px 0;">${email}</td></tr>
          <tr><td style="padding:6px 0;color:#888;">參與身分</td><td style="padding:6px 0;">${identity}</td></tr>
        </table>
        <div style="margin-top:20px;text-align:center;">
          <a href="${adminUrl}" style="background:#007AFF;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;">前往後台查看完整紀錄</a>
        </div>
      </div>
    </div>
  `;

  const notifyTo = process.env.NOTIFY_EMAIL_TO.split(",").map((s) => s.trim()).filter(Boolean);
  resend.emails.send({
    from: process.env.NOTIFY_EMAIL_FROM || "onboarding@resend.dev",
    to: notifyTo,
    subject: `【新問卷】#${responseId} ${activityName} — ${now}`,
    html,
  }).catch((err) => console.error("通知信寄送失敗：", err.message));
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret: process.env.SESSION_SECRET || "tnh-survey-2024-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 24 小時
}));

// ---------- 認證中介層 ----------

function requireAuth(req, res, next) {
  if (!req.session.user) {
    if (req.path.startsWith("/api/")) return res.status(401).json({ error: "請先登入" });
    return res.redirect("/login");
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).json({ error: "需要管理員權限" });
  }
  next();
}

// ---------- 操作紀錄 ----------

function auditLog(req, action, target, details) {
  const u = req.session && req.session.user ? req.session.user : { id: null, username: "系統" };
  try {
    db.prepare("INSERT INTO audit_logs (user_id, username, action, target, details) VALUES (?, ?, ?, ?, ?)").run(
      u.id, u.username, action, target || null, details || null
    );
  } catch (_) {}
}

// ---------- 共用工具 ----------

function serializeQuestion(row) {
  return {
    id: row.id,
    order_index: row.order_index,
    section: row.section,
    question_text: row.question_text,
    type: row.type,
    options: row.options ? JSON.parse(row.options) : null,
    has_suggestion: !!row.has_suggestion,
    suggestion_label: row.suggestion_label,
    required: !!row.required,
    active: !!row.active,
  };
}

const VALID_TYPES = ["shorttext", "longtext", "date", "likert5", "choice", "multichoice"];

function validateQuestionPayload(body) {
  if (!body.question_text || !String(body.question_text).trim()) {
    return "question_text 不能為空";
  }
  if (!VALID_TYPES.includes(body.type)) {
    return `type 必須是其中之一：${VALID_TYPES.join(", ")}`;
  }
  if (["choice", "multichoice", "likert5"].includes(body.type)) {
    if (!Array.isArray(body.options) || body.options.length === 0) {
      return "此題目類型需要至少一個選項（options）";
    }
  }
  return null;
}

// ---------- 公開 API：填寫頁面 ----------

app.get("/api/questions", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM questions WHERE active = 1 ORDER BY order_index ASC, id ASC")
    .all();
  res.json(rows.map(serializeQuestion));
});

app.post("/api/responses", (req, res) => {
  const { answers, source } = req.body;

  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: "answers 不能為空" });
  }

  const activeQuestions = db
    .prepare("SELECT * FROM questions WHERE active = 1")
    .all();
  const questionMap = new Map(activeQuestions.map((q) => [q.id, q]));

  // 檢查必填題目是否都有回答
  for (const q of activeQuestions) {
    if (!q.required) continue;
    const a = answers.find((x) => x.question_id === q.id);
    if (!a || a.answer_value === undefined || a.answer_value === null || String(a.answer_value).trim() === "") {
      return res.status(400).json({ error: `題目「${q.question_text}」為必填` });
    }
  }

  const insertResponse = db.prepare(
    "INSERT INTO responses (user_agent, source) VALUES (?, ?)"
  );
  const insertAnswer = db.prepare(`
    INSERT INTO answers
      (response_id, question_id, question_text_snapshot, section_snapshot, question_type_snapshot, answer_value, suggestion_text)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  try {
    const responseId = db.withTransaction(() => {
      const { lastInsertRowid } = insertResponse.run(
        req.headers["user-agent"] || null,
        source || null
      );

      for (const a of answers) {
        const q = questionMap.get(a.question_id);
        if (!q) continue; // 忽略不存在或已下架的題目 id，避免被偽造資料污染
        const value = a.answer_value === undefined || a.answer_value === null ? "" : String(a.answer_value);
        const suggestion = a.suggestion_text ? String(a.suggestion_text) : null;
        insertAnswer.run(
          lastInsertRowid,
          q.id,
          q.question_text,
          q.section,
          q.type,
          value,
          suggestion
        );
      }
      return lastInsertRowid;
    });

    // 非同步寄送通知信（不阻擋回應）
    const savedAnswers = answers.map((a) => {
      const q = questionMap.get(a.question_id);
      return q ? { question_text_snapshot: q.question_text, answer_value: a.answer_value } : null;
    }).filter(Boolean);
    sendResponseNotification(responseId, savedAnswers);

    res.status(201).json({ ok: true, response_id: responseId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "伺服器錯誤，請稍後再試" });
  }
});

// ---------- 登入 / 登出 ----------

app.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/admin");
  res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "請輸入帳號與密碼" });
  const user = db.prepare("SELECT * FROM users WHERE username = ? AND active = 1").get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "帳號或密碼錯誤" });
  }
  req.session.user = { id: user.id, username: user.username, role: user.role, display_name: user.display_name };
  auditLog(req, "LOGIN", null, null);
  res.json({ ok: true, user: req.session.user });
});

app.post("/api/logout", (req, res) => {
  auditLog(req, "LOGOUT", null, null);
  req.session.destroy(() => res.json({ ok: true }));
});

// ---------- 後台管理（Session 保護） ----------

app.get("/admin", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "admin.html"));
});

// 所有 /api/admin/* 都需要登入
app.use("/api/admin", requireAuth);

app.get("/api/admin/me", (req, res) => {
  res.json(req.session.user);
});

// ---------- 帳號管理（管理員專用） ----------

app.get("/api/admin/users", requireAdmin, (req, res) => {
  const users = db.prepare("SELECT id, username, display_name, role, active, created_at FROM users ORDER BY id ASC").all();
  res.json(users);
});

app.post("/api/admin/users", requireAdmin, (req, res) => {
  const { username, password, display_name, role } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "帳號與密碼為必填" });
  if (!["admin", "staff"].includes(role)) return res.status(400).json({ error: "role 必須是 admin 或 staff" });
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) return res.status(409).json({ error: "帳號已存在" });
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare("INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)").run(username, hash, display_name || "", role);
  auditLog(req, "ADD_USER", username, `role=${role}`);
  res.status(201).json({ ok: true, id: info.lastInsertRowid });
});

app.put("/api/admin/users/:id", requireAdmin, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "找不到此帳號" });
  const { password, display_name, role, active } = req.body || {};
  const newHash = password ? bcrypt.hashSync(password, 10) : user.password_hash;
  const newRole = ["admin", "staff"].includes(role) ? role : user.role;
  const newActive = active === false || active === 0 ? 0 : 1;
  db.prepare("UPDATE users SET password_hash=?, display_name=?, role=?, active=? WHERE id=?").run(
    newHash, display_name ?? user.display_name, newRole, newActive, user.id
  );
  auditLog(req, "EDIT_USER", user.username, `role=${newRole}, active=${newActive}${password ? ", 已更新密碼" : ""}`);
  res.json({ ok: true });
});

app.delete("/api/admin/users/:id", requireAdmin, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "找不到此帳號" });
  if (user.id === req.session.user.id) return res.status(400).json({ error: "無法刪除自己的帳號" });
  db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
  auditLog(req, "DELETE_USER", user.username, null);
  res.json({ ok: true });
});

// ---------- 刪除密碼設定（管理員專用） ----------

app.post("/api/admin/settings/delete-password", requireAdmin, (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: "請輸入刪除密碼" });
  const hash = bcrypt.hashSync(password, 10);
  db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('delete_password', ?, datetime('now'))").run(hash);
  auditLog(req, "CHANGE_DELETE_PASSWORD", null, null);
  res.json({ ok: true });
});

// ---------- 操作紀錄（管理員專用） ----------

app.get("/api/admin/audit-logs", requireAdmin, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const total = db.prepare("SELECT COUNT(*) AS n FROM audit_logs").get().n;
  const logs = db.prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT ? OFFSET ?").all(limit, offset);
  res.json({ total, limit, offset, items: logs });
});

app.get("/api/admin/questions", (req, res) => {
  const rows = db.prepare("SELECT * FROM questions ORDER BY order_index ASC, id ASC").all();
  res.json(rows.map(serializeQuestion));
});

app.post("/api/admin/questions", (req, res) => {
  const err = validateQuestionPayload(req.body);
  if (err) return res.status(400).json({ error: err });

  const maxOrder = db.prepare("SELECT COALESCE(MAX(order_index), 0) AS m FROM questions").get().m;

  const insert = db.prepare(`
    INSERT INTO questions
      (order_index, section, question_text, type, options, has_suggestion, suggestion_label, required, active)
    VALUES (@order_index, @section, @question_text, @type, @options, @has_suggestion, @suggestion_label, @required, @active)
  `);

  const info = insert.run({
    order_index: req.body.order_index ?? maxOrder + 1,
    section: req.body.section || "",
    question_text: req.body.question_text.trim(),
    type: req.body.type,
    options: req.body.options ? JSON.stringify(req.body.options) : null,
    has_suggestion: req.body.has_suggestion ? 1 : 0,
    suggestion_label: req.body.suggestion_label || "建議",
    required: req.body.required ? 1 : 0,
    active: req.body.active === false ? 0 : 1,
  });

  const row = db.prepare("SELECT * FROM questions WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(serializeQuestion(row));
});

app.put("/api/admin/questions/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM questions WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "題目不存在" });

  const merged = { ...existing, ...req.body };
  const err = validateQuestionPayload(merged);
  if (err) return res.status(400).json({ error: err });

  db.prepare(`
    UPDATE questions SET
      order_index = @order_index,
      section = @section,
      question_text = @question_text,
      type = @type,
      options = @options,
      has_suggestion = @has_suggestion,
      suggestion_label = @suggestion_label,
      required = @required,
      active = @active,
      updated_at = datetime('now')
    WHERE id = @id
  `).run({
    id: existing.id,
    order_index: merged.order_index,
    section: merged.section || "",
    question_text: String(merged.question_text).trim(),
    type: merged.type,
    options: merged.options ? JSON.stringify(merged.options) : null,
    has_suggestion: merged.has_suggestion ? 1 : 0,
    suggestion_label: merged.suggestion_label || "建議",
    required: merged.required ? 1 : 0,
    active: merged.active === false || merged.active === 0 ? 0 : 1,
  });

  const row = db.prepare("SELECT * FROM questions WHERE id = ?").get(existing.id);
  res.json(serializeQuestion(row));
});

app.delete("/api/admin/questions/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM questions WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "題目不存在" });

  const answerCount = db
    .prepare("SELECT COUNT(*) AS n FROM answers WHERE question_id = ?")
    .get(req.params.id).n;

  if (answerCount > 0) {
    // 已經有人填過這題，為了保留歷史資料的完整性，改成「下架」而不是真的刪除
    db.prepare("UPDATE questions SET active = 0, updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    return res.json({ ok: true, mode: "deactivated", reason: "已有填寫紀錄，僅下架不刪除" });
  }

  db.prepare("DELETE FROM questions WHERE id = ?").run(req.params.id);
  res.json({ ok: true, mode: "deleted" });
});

app.post("/api/admin/questions/reorder", (req, res) => {
  const { order } = req.body; // [{id, order_index}, ...]
  if (!Array.isArray(order)) return res.status(400).json({ error: "order 必須是陣列" });

  const update = db.prepare("UPDATE questions SET order_index = ?, updated_at = datetime('now') WHERE id = ?");
  db.withTransaction(() => {
    for (const item of order) update.run(item.order_index, item.id);
  });

  res.json({ ok: true });
});

app.get("/api/admin/responses/unread", (req, res) => {
  const since = parseInt(req.query.since, 10) || 0;
  const row = db.prepare("SELECT COUNT(*) AS cnt, MAX(id) AS maxId FROM responses WHERE id > ?").get(since);
  res.json({ count: row.cnt || 0, maxId: row.maxId || since });
});

app.get("/api/admin/responses", (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  const total = db.prepare("SELECT COUNT(*) AS n FROM responses").get().n;
  const responses = db
    .prepare("SELECT * FROM responses ORDER BY id DESC LIMIT ? OFFSET ?")
    .all(limit, offset);

  let answers = [];
  if (responses.length > 0) {
    const ids = responses.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(",");
    answers = db
      .prepare(`SELECT * FROM answers WHERE response_id IN (${placeholders}) ORDER BY response_id DESC, id ASC`)
      .all(...ids);
  }

  const byResponse = new Map(responses.map((r) => [r.id, { ...r, answers: [] }]));
  for (const a of answers) {
    const r = byResponse.get(a.response_id);
    if (r) r.answers.push(a);
  }

  res.json({ total, limit, offset, items: Array.from(byResponse.values()) });
});

app.delete("/api/admin/responses/:id", (req, res) => {
  const pwd = req.headers["x-delete-password"];
  if (!pwd) return res.status(400).json({ error: "請輸入刪除密碼" });

  const setting = db.prepare("SELECT value FROM settings WHERE key = 'delete_password'").get();
  const valid = setting
    ? bcrypt.compareSync(pwd, setting.value)
    : pwd === (process.env.ADMIN_PASSWORD || "changeme");

  if (!valid) return res.status(403).json({ error: "密碼錯誤，無法刪除" });

  const response = db.prepare("SELECT id FROM responses WHERE id = ?").get(req.params.id);
  if (!response) return res.status(404).json({ error: "找不到此筆紀錄" });
  db.prepare("DELETE FROM responses WHERE id = ?").run(req.params.id);
  auditLog(req, "DELETE_RESPONSE", `#${req.params.id}`, null);
  res.json({ ok: true });
});

app.get("/api/admin/responses/:id", (req, res) => {
  const response = db.prepare("SELECT * FROM responses WHERE id = ?").get(req.params.id);
  if (!response) return res.status(404).json({ error: "找不到此筆紀錄" });

  const answers = db
    .prepare("SELECT * FROM answers WHERE response_id = ? ORDER BY id ASC")
    .all(req.params.id);

  res.json({ ...response, answers });
});

app.get("/api/admin/analytics", (req, res) => {
  const sourceFilter = req.query.source || null; // 'email' | 'qrcode' | null = 全部
  const questions = db.prepare("SELECT * FROM questions ORDER BY order_index ASC, id ASC").all();
  const answers = sourceFilter
    ? db.prepare("SELECT a.* FROM answers a JOIN responses r ON r.id = a.response_id WHERE r.source = ?").all(sourceFilter)
    : db.prepare("SELECT * FROM answers").all();

  // 以 question_id 建立索引（正常情況）
  const answersByQuestionId = new Map();
  // 以 question_text_snapshot 建立索引（question_id 為 NULL 的孤立答案）
  const orphansByText = new Map();

  for (const a of answers) {
    if (a.question_id !== null && a.question_id !== undefined) {
      if (!answersByQuestionId.has(a.question_id)) answersByQuestionId.set(a.question_id, []);
      answersByQuestionId.get(a.question_id).push(a);
    } else if (a.question_text_snapshot) {
      if (!orphansByText.has(a.question_text_snapshot)) orphansByText.set(a.question_text_snapshot, []);
      orphansByText.get(a.question_text_snapshot).push(a);
    }
  }

  const likert = [];
  const others = [];
  const opentext = [];

  for (const q of questions) {
    // 合併：有 question_id 對應的答案 + question_id 為 NULL 但題目文字相符的孤立答案
    const byId = answersByQuestionId.get(q.id) || [];
    const byText = orphansByText.get(q.question_text) || [];
    const qAnswers = [...byId, ...byText];
    const options = q.options ? JSON.parse(q.options) : null;

    if (q.type === "likert5" && options) {
      const distribution = {};
      options.forEach((opt) => (distribution[opt] = 0));

      let sum = 0;
      let scored = 0;
      for (const a of qAnswers) {
        const idx = options.indexOf(a.answer_value);
        if (idx === -1) continue;
        distribution[a.answer_value] = (distribution[a.answer_value] || 0) + 1;
        sum += options.length - idx;
        scored++;
      }

      likert.push({
        question_id: q.id,
        section: q.section,
        question_text: q.question_text,
        response_count: qAnswers.length,
        scored_count: scored,
        average: scored > 0 ? Math.round((sum / scored) * 100) / 100 : null,
        max_score: options.length,
        distribution,
      });
    } else if ((q.type === "choice" || q.type === "multichoice") && options) {
      const distribution = {};
      options.forEach((opt) => (distribution[opt] = 0));

      for (const a of qAnswers) {
        const values =
          q.type === "multichoice"
            ? String(a.answer_value || "").split("、").filter(Boolean)
            : [a.answer_value];
        for (const v of values) {
          if (v in distribution) distribution[v]++;
        }
      }

      others.push({
        question_id: q.id,
        section: q.section,
        question_text: q.question_text,
        type: q.type,
        response_count: qAnswers.length,
        distribution,
      });
    } else if (q.type === "longtext") {
      const responses = qAnswers
        .filter((a) => a.answer_value && a.answer_value.trim())
        .map((a) => ({ text: a.answer_value.trim(), response_id: a.response_id }));

      opentext.push({
        question_id: q.id,
        section: q.section,
        question_text: q.question_text,
        total_count: qAnswers.length,
        filled_count: responses.length,
        responses,
      });
    }
  }

  likert.sort((a, b) => {
    if (a.average === null) return 1;
    if (b.average === null) return -1;
    return b.average - a.average;
  });

  res.json({ likert, others, opentext });
});

app.post("/api/admin/send-invite", async (req, res) => {
  if (!resend) {
    return res.status(503).json({ error: "電子郵件功能尚未設定（請在 Railway 環境變數中設定 RESEND_API_KEY 與 NOTIFY_EMAIL_TO）" });
  }

  const { emails, subject, message } = req.body;
  if (!Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: "請提供至少一個電子郵件地址" });
  }

  const baseUrl = process.env.SURVEY_URL || "https://tnh-customet-survey-production.up.railway.app";
  const surveyUrl = `${baseUrl}/?source=email`;
  const customNote = message
    ? `<p style="margin:14px 0 0;font-size:14px;color:#555;line-height:1.7;padding:10px 14px;background:#f5f5f5;border-radius:6px;">${String(message).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/\n/g,"<br>")}</p>`
    : "";

  const buildHtml = () => `
    <div style="font-family:sans-serif;max-width:540px;margin:auto;border:1px solid #eee;border-radius:8px;overflow:hidden;">
      <div style="background:#1a1a2e;color:#fff;padding:20px 24px;text-align:center;">
        <h2 style="margin:0;font-size:18px;letter-spacing:1px;">臺北文創</h2>
        <p style="margin:4px 0 0;font-size:13px;opacity:.8;">Taipei New Horizon</p>
      </div>
      <div style="padding:24px;">
        <p style="font-size:15px;margin:0 0 14px;">親愛的貴賓，您好！</p>
        <p style="font-size:14px;color:#444;margin:0 0 14px;line-height:1.75;">感謝您參與本次活動！為了持續提升我們的服務品質，誠摯邀請您花幾分鐘填寫問卷，您的寶貴意見對我們非常重要。</p>
        ${customNote}
        <div style="text-align:center;margin:28px 0;">
          <a href="${surveyUrl}" style="background:#007AFF;color:#fff;padding:14px 40px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:bold;display:inline-block;">立即填寫問卷</a>
        </div>
        <p style="font-size:12px;color:#aaa;text-align:center;margin:0;">或複製以下連結至瀏覽器開啟：<br><a href="${surveyUrl}" style="color:#007AFF;">${surveyUrl}</a></p>
      </div>
      <div style="background:#f9f9f9;padding:12px 24px;text-align:center;font-size:11px;color:#aaa;border-top:1px solid #eee;">
        臺北文創 Taipei New Horizon　｜　<a href="https://www.taipeinewhorizon.com.tw" style="color:#aaa;">www.taipeinewhorizon.com.tw</a>
      </div>
    </div>
  `;

  let sent = 0;
  const errors = [];
  for (const email of emails) {
    const addr = String(email).trim();
    if (!addr) continue;
    try {
      const result = await resend.emails.send({
        from: process.env.NOTIFY_EMAIL_FROM || "onboarding@resend.dev",
        to: [addr],
        subject: subject || "邀請您填寫臺北文創場地體驗滿意度問卷",
        html: buildHtml(),
      });
      if (result.error) throw new Error(result.error.message);
      sent++;
    } catch (err) {
      errors.push({ email: addr, error: err.message });
    }
  }

  res.json({ ok: true, sent, total: emails.length, errors });
});

app.get("/api/admin/responses.csv", (req, res) => {
  const rows = db.prepare(`
    SELECT a.response_id, r.submitted_at, r.source, a.section_snapshot, a.question_text_snapshot,
           a.answer_value, a.suggestion_text
    FROM answers a
    JOIN responses r ON r.id = a.response_id
    ORDER BY a.response_id ASC, a.id ASC
  `).all();

  const escape = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };

  const header = ["response_id", "submitted_at", "source", "section", "question", "answer", "suggestion"];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push([
      row.response_id,
      row.submitted_at,
      escape(row.source),
      escape(row.section_snapshot),
      escape(row.question_text_snapshot),
      escape(row.answer_value),
      escape(row.suggestion_text),
    ].join(","));
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=responses.csv");
  res.send("﻿" + lines.join("\n")); // 加 BOM 避免 Excel 開啟中文亂碼
});

app.listen(PORT, () => {
  console.log(`問卷伺服器啟動：http://localhost:${PORT}`);
  console.log(`後台管理：http://localhost:${PORT}/admin`);

  // 若尚無任何帳號，從環境變數建立預設管理員
  const userCount = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  if (userCount === 0) {
    const adminUser = process.env.ADMIN_USER || "admin";
    const adminPass = process.env.ADMIN_PASSWORD || "changeme";
    const hash = bcrypt.hashSync(adminPass, 10);
    db.prepare("INSERT INTO users (username, password_hash, role, display_name) VALUES (?, ?, 'admin', '系統管理員')").run(adminUser, hash);
    console.log(`[INIT] 已建立預設管理員帳號：${adminUser}`);
  }

  // 若尚未設定刪除密碼，以 ADMIN_PASSWORD 作為預設（雜湊儲存）
  const delPwd = db.prepare("SELECT value FROM settings WHERE key = 'delete_password'").get();
  if (!delPwd) {
    const adminPass = process.env.ADMIN_PASSWORD || "changeme";
    const hash = bcrypt.hashSync(adminPass, 10);
    db.prepare("INSERT INTO settings (key, value) VALUES ('delete_password', ?)").run(hash);
    console.log("[INIT] 已設定預設刪除密碼（與管理員密碼相同）");
  }
});
