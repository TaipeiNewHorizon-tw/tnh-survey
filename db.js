// db.js — 資料庫連線與資料表結構（SQLite，透過 better-sqlite3）
//
// 三個資料表：
//   questions  題目本身（admin 後台可新增/編輯/刪除/排序）
//   responses  每一次問卷送出 = 一筆
//   answers    每一筆送出裡，每一題的答案（用 snapshot 保存當時的題目文字與類型，
//              這樣即使日後 admin 修改或刪除題目，舊資料的意義仍然完整保留）

// 使用 Node.js 內建的 node:sqlite（Node 22.5+），不需要額外安裝原生模組、
// 也不需要編譯，避免在沙盒或某些雲端平台上因為抓不到 node-gyp 編譯工具而裝不起來。
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "survey.db");
const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_index INTEGER NOT NULL DEFAULT 0,
  section TEXT NOT NULL DEFAULT '',
  question_text TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'shorttext',     -- shorttext | longtext | date | likert5 | choice | multichoice
  options TEXT,                                -- JSON 陣列字串，例如 ["非常滿意","滿意","普通","不滿意","非常不滿意"]
  has_suggestion INTEGER NOT NULL DEFAULT 0,   -- 是否附加一個額外文字欄位
  suggestion_label TEXT NOT NULL DEFAULT '建議',
  required INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,           -- 0 = 已下架（但歷史資料仍保留）
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  user_agent TEXT,
  source TEXT                                  -- 'email' | 'qrcode' | NULL（直接開啟）
);

CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  response_id INTEGER NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES questions(id) ON DELETE SET NULL,
  question_text_snapshot TEXT NOT NULL,
  section_snapshot TEXT,
  question_type_snapshot TEXT NOT NULL,
  answer_value TEXT,
  suggestion_text TEXT
);

CREATE INDEX IF NOT EXISTS idx_answers_response ON answers(response_id);
CREATE INDEX IF NOT EXISTS idx_questions_order ON questions(order_index);
`);

// 多語言翻譯表：題目文字／分類／選項／額外欄位標籤的英文、日文翻譯。
// 每一題、每個語言一筆，找不到翻譯時（尚未填寫）就 fallback 回中文原文（見 server.js）。
db.exec(`
CREATE TABLE IF NOT EXISTS question_translations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  lang TEXT NOT NULL,                          -- 'en' | 'ja'
  question_text TEXT,
  section TEXT,
  options TEXT,                                 -- JSON 陣列字串，翻譯後的選項文字，順序需與原題 options 一一對應
  suggestion_label TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(question_id, lang)
);

CREATE INDEX IF NOT EXISTS idx_question_translations_qid ON question_translations(question_id);
`);

// 帳號、操作紀錄、設定資料表
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',        -- 'admin' | 'staff'
  display_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
`);

// 既有資料庫的欄位遷移（新欄位若已存在會拋錯，catch 後忽略）
try { db.exec("ALTER TABLE responses ADD COLUMN source TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE responses ADD COLUMN lang TEXT"); } catch (_) {} // 填寫問卷當下使用的語言：'zh' | 'en' | 'ja'

// node:sqlite 沒有像 better-sqlite3 的 db.transaction(fn) 語法糖，
// 用這個小工具手動包 BEGIN/COMMIT/ROLLBACK，失敗時自動回滾。
function withTransaction(fn) {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

module.exports = db;
module.exports.withTransaction = withTransaction;
