// seed.js — 將問卷題目寫入資料庫（首次部署用）
// 執行方式：npm run seed
// 只有在 questions 資料表是空的時候才會寫入，避免覆蓋 admin 後台已編輯的內容。

const db = require("./db");

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

const count = db.prepare("SELECT COUNT(*) AS n FROM questions").get().n;

if (count > 0) {
  console.log(`questions 資料表已有 ${count} 筆資料，跳過 seed。如需重置題目請改用 npm run reseed。`);
  process.exit(0);
}

const insert = db.prepare(`
  INSERT INTO questions
    (order_index, section, question_text, type, options, has_suggestion, suggestion_label, required, active)
  VALUES
    (@order_index, @section, @question_text, @type, @options, @has_suggestion, @suggestion_label, @required, 1)
`);

db.withTransaction(() => {
  questions.forEach((q, i) => {
    insert.run({
      order_index: i + 1,
      section: q.section,
      question_text: q.question_text,
      type: q.type,
      options: q.options ? JSON.stringify(q.options) : null,
      has_suggestion: q.has_suggestion || 0,
      suggestion_label: q.suggestion_label || "建議",
      required: q.required ?? 1,
    });
  });
});

console.log(`已寫入 ${questions.length} 題到資料庫。`);
