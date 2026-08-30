// seed-translations.js — 只補上英文／日文翻譯，不動題目本身（不會重新排序、不會影響 id）
// 執行方式：npm run seed:translations
//
// 用途：資料庫裡已經有題目了（不管是舊系統直接跑 npm run seed 建立的，還是後台手動調整過的），
// 只是還沒有多語言翻譯，這個指令會照著中文題目文字去比對 translations-data.js 裡的翻譯草稿，
// 找得到就寫入 / 覆蓋 question_translations（不會動到 questions 資料表本身）。
//
// 找不到對應翻譯的題目（例如後台後來自己新增的題目）會被略過，請直接到後台「題目管理」
// 手動填寫該題的 English／日本語 翻譯欄位即可。

const db = require("./db");
const { lookupTranslation } = require("./translations-data");

const questions = db.prepare("SELECT * FROM questions ORDER BY order_index ASC, id ASC").all();

const insertTr = db.prepare(`
  INSERT INTO question_translations (question_id, lang, question_text, section, options, suggestion_label, updated_at)
  VALUES (@question_id, @lang, @question_text, @section, @options, @suggestion_label, datetime('now'))
  ON CONFLICT(question_id, lang) DO UPDATE SET
    question_text = excluded.question_text,
    section = excluded.section,
    options = excluded.options,
    suggestion_label = excluded.suggestion_label,
    updated_at = datetime('now')
`);

let matched = 0;
let written = 0;
const unmatched = [];

db.withTransaction(() => {
  for (const q of questions) {
    const tr = lookupTranslation(q);
    if (!tr) {
      unmatched.push(q.question_text);
      continue;
    }
    matched++;
    for (const lang of Object.keys(tr)) {
      insertTr.run({
        question_id: q.id,
        lang,
        question_text: tr[lang].question_text || "",
        section: tr[lang].section || "",
        options: tr[lang].options ? JSON.stringify(tr[lang].options) : null,
        suggestion_label: tr[lang].suggestion_label || "",
      });
      written++;
    }
  }
});

console.log(`比對到 ${matched} / ${questions.length} 題，共寫入／更新 ${written} 筆翻譯。`);
if (unmatched.length) {
  console.log(`以下題目在 translations-data.js 中找不到對應翻譯，請至後台「題目管理」手動填寫：`);
  unmatched.forEach((t) => console.log(`  - ${t}`));
}
