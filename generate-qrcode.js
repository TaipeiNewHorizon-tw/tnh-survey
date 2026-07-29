// generate-qrcode.js — 產生指向問卷網址的 QR Code 圖片
// 用法：
//   node generate-qrcode.js https://your-survey-domain.com
//   （沒有帶網址的話，預設用 http://localhost:3000，僅供本機測試用）

require("dotenv").config();
const QRCode = require("qrcode");
const path = require("path");

const url = process.argv[2] || process.env.SURVEY_URL || "http://localhost:3000";
const outPath = path.join(__dirname, "qrcode.png");

QRCode.toFile(outPath, url, { width: 500, margin: 2 }, (err) => {
  if (err) {
    console.error("產生 QR Code 失敗：", err);
    process.exit(1);
  }
  console.log(`已產生 QR Code：${outPath}`);
  console.log(`對應網址：${url}`);
  console.log("請將 qrcode.png 印出或放到活動現場，讓參與者掃描填寫問卷。");
});
