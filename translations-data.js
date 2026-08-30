// translations-data.js — 問卷題目的英文／日文翻譯草稿（AI 產生，後台可再修改調整字句）
//
// 使用方式：
//   - seed.js / reseed.js 建立題目時，會用「中文題目文字」比對這裡的 key，
//     若有對應翻譯就一併寫入 question_translations 資料表。
//   - seed-translations.js 則是給「題目已經存在（不想重新 seed）」的情況，
//     單純比對現有題目的中文文字，把翻譯補進 question_translations。
//
// 之後如果在後台新增了新題目，直接在後台的「English 翻譯」「日本語 翻訳」欄位填寫即可，
// 不需要改這個檔案；這個檔案只是最初 15 題的翻譯草稿來源。

const SECTION_MAP = {
  "基本資料": { en: "Basic Information", ja: "基本情報" },
  "場地體驗滿意度": { en: "Venue Experience Satisfaction", ja: "会場体験満足度" },
  "綜合反饋": { en: "Overall Feedback", ja: "総合フィードバック" },
};

const LIKERT5_ZH = ["非常滿意", "滿意", "普通", "不滿意", "非常不滿意"];
const LIKERT5 = {
  en: ["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very Dissatisfied"],
  ja: ["非常に満足", "満足", "普通", "不満", "非常に不満"],
};

// key = 中文題目文字（question_text，須與 seed.js / reseed.js / 目前資料庫內容完全一致才會比對到）
const QUESTIONS = {
  "參與活動名稱": {
    en: { question_text: "Name of Event Attended" },
    ja: { question_text: "参加イベント名" },
  },
  "樓層/廳別": {
    en: { question_text: "Floor / Hall" },
    ja: { question_text: "フロア／会場名" },
  },
  "活動日期": {
    en: { question_text: "Event Date" },
    ja: { question_text: "イベント日" },
  },
  "填表人姓名": {
    en: { question_text: "Your Name" },
    ja: { question_text: "お名前" },
  },
  "填表人 E-MAIL": {
    en: { question_text: "Your Email" },
    ja: { question_text: "メールアドレス" },
  },
  "您此次參與活動的身分為？": {
    en: {
      question_text: "What is your role at this event?",
      options: ["General Attendee", "Organizer Staff", "Exhibitor / Performer", "Media", "Other"],
    },
    ja: {
      question_text: "今回のイベントでのお立場を教えてください",
      options: ["一般来場者", "主催者スタッフ", "出展者／出演者", "メディア", "その他"],
    },
  },
  "您對臺北文創場地的交通便利性是否滿意？": {
    en: { question_text: "Are you satisfied with the transportation convenience of the Taipei New Horizon venue?", options: LIKERT5.en },
    ja: { question_text: "台北文創会場への交通の利便性にご満足いただけましたか？", options: LIKERT5.ja },
  },
  "您認為進入大樓及活動會場的動線指引與標示是否清晰易懂？": {
    en: { question_text: "Were the wayfinding signs into the building and event venue clear and easy to understand?", options: LIKERT5.en },
    ja: { question_text: "建物や会場までの案内表示は分かりやすかったですか？", options: LIKERT5.ja },
  },
  "您對公共區域（如洗手間、廊道、茶水間等）的整潔程度是否滿意？": {
    en: { question_text: "Are you satisfied with the cleanliness of the common areas (e.g. restrooms, corridors, pantry)?", options: LIKERT5.en },
    ja: { question_text: "共用エリア（お手洗い、廊下、給茶スペースなど）の清潔さにご満足いただけましたか？", options: LIKERT5.ja },
  },
  "您對活動場地的舒適度（如空調、照明及整體環境品質）是否滿意？": {
    en: { question_text: "Are you satisfied with the comfort of the venue (e.g. air conditioning, lighting, and overall environment)?", options: LIKERT5.en },
    ja: { question_text: "会場の快適さ（空調、照明、全体的な環境の質など）にご満足いただけましたか？", options: LIKERT5.ja },
  },
  "您對活動期間現場服務人員的服務態度與協助效率是否滿意？": {
    en: { question_text: "Are you satisfied with the attitude and helpfulness of the on-site staff during the event?", options: LIKERT5.en },
    ja: { question_text: "イベント期間中のスタッフの対応や案内の効率にご満足いただけましたか？", options: LIKERT5.ja },
  },
  "您對活動現場的影音設備效果（如音響、燈光及視覺呈現）是否滿意？": {
    en: { question_text: "Are you satisfied with the audiovisual quality on site (e.g. sound, lighting, and visual presentation)?", options: LIKERT5.en },
    ja: { question_text: "会場の音響・映像設備（音響、照明、視覚演出など）にご満足いただけましたか？", options: LIKERT5.ja },
  },
  "您對本次活動場地的整體環境與空間體驗是否滿意？": {
    en: { question_text: "Are you satisfied with the overall environment and spatial experience of the venue for this event?", options: LIKERT5.en },
    ja: { question_text: "今回の会場全体の環境と空間体験にご満足いただけましたか？", options: LIKERT5.ja },
  },
  "未來若有感興趣的活動，您是否願意再次參與臺北文創舉辦或舉辦於臺北文創之活動？": {
    en: {
      question_text: "If there is a future event that interests you, would you be willing to attend another event held by or at Taipei New Horizon?",
      options: ["Definitely willing", "Willing", "Neutral", "Unwilling", "Definitely unwilling"],
    },
    ja: {
      question_text: "今後、興味のあるイベントがあれば、台北文創が主催する、または台北文創で開催されるイベントに再度参加したいと思いますか？",
      options: ["非常にそう思う", "そう思う", "普通", "そう思わない", "全くそう思わない"],
    },
  },
  "您對本次活動場地是否有其他建議或意見？": {
    en: { question_text: "Do you have any other suggestions or comments about the venue for this event?" },
    ja: { question_text: "今回の会場について、その他ご意見やご要望がございましたらご記入ください。" },
  },
};

// 依「中文題目物件」（seed.js questions 陣列中的一筆，含 section / question_text）
// 組出可直接寫進 question_translations 的 {en: {...}, ja: {...}}（找不到就回傳 null）
function lookupTranslation(zhQuestion) {
  const base = QUESTIONS[zhQuestion.question_text];
  if (!base) return null;
  const sectionTr = SECTION_MAP[zhQuestion.section] || null;
  const out = {};
  for (const lang of ["en", "ja"]) {
    const t = base[lang];
    if (!t) continue;
    out[lang] = {
      question_text: t.question_text || "",
      section: (sectionTr && sectionTr[lang]) || "",
      options: t.options || null,
      suggestion_label: t.suggestion_label || "",
    };
  }
  return out;
}

module.exports = { SECTION_MAP, LIKERT5_ZH, LIKERT5, QUESTIONS, lookupTranslation };
