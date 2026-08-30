// reseed.js — 清除現有題目並重新寫入最新版問卷題目（更新上線系統用）
// 執行方式：npm run reseed
//
// ⚠ 注意：此操作會刪除現有所有題目並重新建立，但不會刪除已收到的填寫紀錄。
//   舊填寫紀錄的答案仍完整保留（question_text_snapshot 欄位有快照），只是
//   question_id 欄位會變為 NULL，不影響 CSV 匯出與填寫紀錄查閱。

const db = require("./db");
const { lookupTranslation } = require("./translations-data");

const LIKERT5 = ["非常滿意", "滿意", "普通", "不滿意", "非常不滿意"];

const questions = [
  // ── 基本資料 ──
  { section: "基本資料", question_text: "參與活動名稱", type: "shorttext", required: 1 },
  { section: "基本資料", question_text: "樓層/廳別", type: "shorttext", required: 1 },
  { section: "基本資料", question_text: "活動日期", type: "date", required: 1 },
  { section: "基本資料", question_text: "填表人姓名", type: "shorttext", required: 1 },
  { section: "基本資料", question_text: "填表人 E-MAIL", type: "shorttext", required: 1 },
  {
    section: "基本資料",
    question_text: "您此次參與活動的身分為？",
    type: "choice",
    options: ["一般觀眾", "主辦單位工作人員", "參展／演出單位", "媒體", "其他"],
    required: 1,
  },

  // ── 場地體驗滿意度 ──
  {
    section: "場地體驗滿意度",
    question_text: "您對臺北文創場地的交通便利性是否滿意？",
    type: "likert5",
    options: LIKERT5,
    has_suggestion: 0,
    required: 1,
  },
  {
    section: "場地體驗滿意度",
    question_text: "您認為進入大樓及活動會場的動線指引與標示是否清晰易懂？",
    type: "likert5",
    options: LIKERT5,
    has_suggestion: 0,
    required: 1,
  },
  {
    section: "場地體驗滿意度",
    question_text: "您對公共區域（如洗手間、廊道、茶水間等）的整潔程度是否滿意？",
    type: "likert5",
    options: LIKERT5,
    has_suggestion: 0,
    required: 1,
  },
  {
    section: "場地體驗滿意度",
    question_text: "您對活動場地的舒適度（如空調、照明及整體環境品質）是否滿意？",
    type: "likert5",
    options: LIKERT5,
    has_suggestion: 0,
    required: 1,
  },
  {
    section: "場地體驗滿意度",
    question_text: "您對活動期間現場服務人員的服務態度與協助效率是否滿意？",
    type: "likert5",
    options: LIKERT5,
    has_suggestion: 0,
    required: 1,
  },
  {
    section: "場地體驗滿意度",
    question_text: "您對活動現場的影音設備效果（如音響、燈光及視覺呈現）是否滿意？",
    type: "likert5",
    options: LIKERT5,
    has_suggestion: 0,
    required: 1,
  },
  {
    section: "場地體驗滿意度",
    question_text: "您對本次活動場地的整體環境與空間體驗是否滿意？",
    type: "likert5",
    options: LIKERT5,
    has_suggestion: 0,
    required: 1,
  },

  // ── 綜合反饋 ──
  {
    section: "綜合反饋",
    question_text: "未來若有感興趣的活動，您是否願意再次參與臺北文創舉辦或舉辦於臺北文創之活動？",
    type: "choice",
    options: ["非常願意", "願意", "普通", "不願意", "非常不願意"],
    required: 1,
  },
  {
    section: "綜合反饋",
    question_text: "您對本次活動場地是否有其他建議或意見？",
    type: "longtext",
    required: 0,
  },
];

const insert = db.prepare(`
  INSERT INTO questions
    (order_index, section, question_text, type, options, has_suggestion, suggestion_label, required, active)
  VALUES
    (@order_index, @section, @question_text, @type, @options, @has_suggestion, @suggestion_label, @required, 1)
`);

const insertTr = db.prepare(`
  INSERT INTO question_translations (question_id, lang, question_text, section, options, suggestion_label)
  VALUES (@question_id, @lang, @question_text, @section, @options, @suggestion_label)
`);

let trCount = 0;

db.withTransaction(() => {
  db.exec("DELETE FROM questions"); // FK ON DELETE CASCADE 會一併清掉舊的 question_translations
  db.exec("DELETE FROM sqlite_sequence WHERE name='questions'");
  questions.forEach((q, i) => {
    const info = insert.run({
      order_index: i + 1,
      section: q.section,
      question_text: q.question_text,
      type: q.type,
      options: q.options ? JSON.stringify(q.options) : null,
      has_suggestion: q.has_suggestion || 0,
      suggestion_label: q.suggestion_label || "建議",
      required: q.required ?? 1,
    });

    // 內建的英文／日文翻譯草稿（見 translations-data.js），找得到就一併寫入
    const tr = lookupTranslation(q);
    if (tr) {
      for (const lang of Object.keys(tr)) {
        insertTr.run({
          question_id: info.lastInsertRowid,
          lang,
          question_text: tr[lang].question_text || "",
          section: tr[lang].section || "",
          options: tr[lang].options ? JSON.stringify(tr[lang].options) : null,
          suggestion_label: tr[lang].suggestion_label || "",
        });
        trCount++;
      }
    }
  });
});

console.log(`已清除舊題目，重新寫入 ${questions.length} 題，並附上 ${trCount} 筆英日文翻譯草稿。`);
