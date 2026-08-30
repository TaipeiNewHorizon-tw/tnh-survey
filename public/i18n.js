// i18n.js — 填寫頁面的介面文字翻譯（不含題目本身，題目翻譯由後端 /api/questions?lang= 提供）
// 題目管理／統計分析等「後台」介面維持中文，不受此檔案影響。

const SURVEY_LANGS = ["zh", "en", "ja"];

const SURVEY_STRINGS = {
  zh: {
    htmlLang: "zh-TW",
    pageTitle: "臺北文創場地參與體驗滿意度調查",
    heading: "臺北文創場地參與體驗滿意度調查",
    intro: "感謝您今日蒞臨參與本活動。為了提供更優質的環境與服務，誠摯邀請您抽出 1 分鐘填寫這份問卷，您的寶貴意見將是我們進步的動力！",
    langLabel: "語言",
    submit: "送出問卷",
    submitting: "送出中...",
    submitError: "送出失敗，請稍後再試",
    thankyouMain: "🙏 問卷到此結束，再次感謝您的協助！",
    thankyouSeeYou: "期待與您在下一次的活動中相見！✨",
    socialTitle: "📢 精彩不散場！掌握更多臺北文創活動資訊：",
    socialSite: "🔗 臺北文創官網",
    socialAppApple: "🍎 臺北文創 APP（Apple）",
    socialAppGoogle: "🤖 臺北文創 APP（Android）",
    socialFb: "🔵 臺北文創 FB",
    socialIg: "📷 臺北文創 IG",
    socialCaption: "歡迎點擊上方連結或下載 APP，隨時隨地與我們共享美好時光！",
  },
  en: {
    htmlLang: "en",
    pageTitle: "Taipei New Horizon Venue Experience Satisfaction Survey",
    heading: "Taipei New Horizon Venue Experience Satisfaction Survey",
    intro: "Thank you for joining today's event. To help us provide an even better environment and service, we kindly invite you to spend one minute completing this survey — your valuable feedback drives our continuous improvement!",
    langLabel: "Language",
    submit: "Submit Survey",
    submitting: "Submitting...",
    submitError: "Submission failed, please try again later",
    thankyouMain: "🙏 That's the end of the survey — thank you again for your help!",
    thankyouSeeYou: "We look forward to seeing you at our next event! ✨",
    socialTitle: "📢 The fun doesn't stop here! Stay updated on more Taipei New Horizon events:",
    socialSite: "🔗 Taipei New Horizon Official Website",
    socialAppApple: "🍎 Taipei New Horizon App (Apple)",
    socialAppGoogle: "🤖 Taipei New Horizon App (Android)",
    socialFb: "🔵 Taipei New Horizon Facebook",
    socialIg: "📷 Taipei New Horizon Instagram",
    socialCaption: "Click the links above or download the app to enjoy great moments with us anytime, anywhere!",
  },
  ja: {
    htmlLang: "ja",
    pageTitle: "台北文創 会場参加体験満足度アンケート",
    heading: "台北文創 会場参加体験満足度アンケート",
    intro: "本日はイベントにご参加いただき、誠にありがとうございます。より良い環境とサービスをご提供するため、1分ほどお時間をいただき、本アンケートにご協力くださいますようお願いいたします。皆さまの貴重なご意見が私たちの励みとなります！",
    langLabel: "言語",
    submit: "アンケートを送信",
    submitting: "送信中…",
    submitError: "送信に失敗しました。しばらくしてから再度お試しください",
    thankyouMain: "🙏 アンケートは以上です。ご協力いただき誠にありがとうございました！",
    thankyouSeeYou: "次回のイベントでも皆さまにお会いできますことを楽しみにしております！✨",
    socialTitle: "📢 まだまだ続く台北文創の魅力！最新情報はこちらから：",
    socialSite: "🔗 台北文創 公式サイト",
    socialAppApple: "🍎 台北文創 アプリ（Apple）",
    socialAppGoogle: "🤖 台北文創 アプリ（Android）",
    socialFb: "🔵 台北文創 Facebook",
    socialIg: "📷 台北文創 Instagram",
    socialCaption: "上記のリンクをクリックするか、アプリをダウンロードして、いつでもどこでも私たちと素敵なひとときをお楽しみください！",
  },
};

// 語言選單顯示用的短標籤（選單本身永遠用三種語言的自稱顯示，不隨目前語言改變，方便切換）
const SURVEY_LANG_OPTIONS = [
  { code: "zh", label: "中文" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
];
