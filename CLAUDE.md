# 問卷調查系統（tnh-survey，版本 V.26.10.003）

來源 repo：`TaipeiNewHorizon-tw/tnh-survey`（公開）。本資料夾是 2026-10-28 commit `4a7e6df` 的完整原始碼。

## 這是什麼
場地參與體驗滿意度調查。參與者掃 QR code 在手機填寫（中／英／日），後台可管理題目、看統計、匯出 CSV、寄邀請信。

## 架構
- Node.js **≥22.5**（使用內建 `node:sqlite`，不需原生模組）、Express 4、express-session、bcryptjs、Resend（寄信）。`zbpack.json` 指定 Node 22。
- `server.js` 全部路由；`db.js` 連線與資料表；`seed.js`、`reseed.js`、`seed-translations.js`、`translations-data.js` 寫入題目與翻譯；`generate-qrcode.js` 產 QR；`make-manual.js` 產操作手冊。
- 前台：`public/index.html`、`app.js`、`i18n.js`、`style.css`。後台：`views/admin.html`、`views/login.html`（刻意放在 public 外，避免繞過登入）、`public/admin.js`、`admin.css`。
- 資料表：`questions`、`responses`、`answers`（答案內存當時題目的快照，之後改題或刪題不影響舊資料）。有答案的題目刪除時會自動「下架」而不是真刪。
- 後台權限：個人帳號加角色（admin 才能管理使用者）、操作稽核紀錄（`/api/admin/audit-logs`）、刪除填寫紀錄需另外輸入「刪除密碼」。
- 主要路由：前台 `GET /api/questions`、`POST /api/responses`；後台 `/api/admin/questions`（含排序、翻譯）、`/responses`（含 `.csv`）、`/analytics`、`/users`、`/send-invite`。
- 文件：`問卷調查系統操作與維護說明書.docx`、`問卷題目清單.txt`。

## 啟動
```
npm install
copy .env.example .env      # macOS/Linux 用 cp；填入後台帳密
npm run seed                # 第一次，寫入題目
npm start                   # http://localhost:3000 ，後台 /admin
```
其他腳本：`npm run reseed`、`npm run seed:translations`、`npm run qrcode`（或 `node generate-qrcode.js <網址>`）。

## 部署（Railway）
- `railway.json`：build 為 `npm install --omit=dev`，start 為 `npm start`。
- **必須**掛載持久化 Volume，並把 `DB_PATH` 指到 Volume 內（例如 `/data/survey.db`），否則重新部署會清空資料庫。第一次部署後要在 Railway shell 執行一次 `npm run seed`。
- **自動部署尚未設定**：push main 不會觸發 Railway。修法：Railway 專案連接 GitHub repo。
- README 的範例寫的是 Render，實際平台是 Railway；兩者邏輯相同。

## 環境變數（只列名稱，值請在 Railway Variables 查）
| 名稱 | 用途 | 在 .env.example？ |
|---|---|---|
| PORT | 埠號 | 是 |
| ADMIN_USER、ADMIN_PASSWORD | 初始管理員帳密 | 是 |
| DB_PATH | SQLite 檔路徑（指向 Volume） | 是 |
| SESSION_SECRET | session 簽章 | **否** |
| RESEND_API_KEY | Resend 寄信金鑰 | **否** |
| NOTIFY_EMAIL_TO、NOTIFY_EMAIL_FROM | 新填寫通知收件／寄件地址 | **否** |
| SURVEY_URL | 邀請信內的問卷網址 | **否** |

## 安全提醒（讀程式碼發現的）
- 沒設環境變數時會落到不安全的預設：`SESSION_SECRET` 預設為寫死字串、`ADMIN_PASSWORD` 預設 `changeme`、寄件人預設 `onboarding@resend.dev`。請確認 Railway 上這幾個都已明確設定。
- `SURVEY_URL` 的預設值是寫死的 Railway 網址（`tnh-customet-survey-production.up.railway.app`），換網址時邀請信會帶錯連結。

## 給彙總儀表板用的 `/api/metrics`（2026-11-25 新增，尚未部署）
- `GET /api/metrics`，需 `Authorization: Bearer <METRICS_TOKEN>`；**沒設環境變數 `METRICS_TOKEN` 時一律拒絕（503）**，金鑰錯誤回 401。
- 回傳 `today_responses`（臺北時間）、`total_responses`、`latest_id`、`latest_at`、`survey_state`。只有數字與時間，沒有填寫內容或個資。
- 部署時要在 Railway Variables 設 `METRICS_TOKEN`（長隨機字串），並把同一個值設在 `tnh-hub` 的 `SURVEY_METRICS_TOKEN`。見 `tnh-hub/CLAUDE.md`。

## 已知小問題（讀程式碼／測試時發現，未處理）
- `app.use("/api/admin", requireAuth)` 掛載後 `req.path` 不含 `/api/`，所以未登入呼叫後台 API 會被 302 導向 `/login`，而不是回 401 JSON。資料仍受保護，只是回應型態不如預期；`requireAuth` 內改用 `req.originalUrl` 判斷即可。

## 待辦清單（與專案檢討文件一致）
1. Railway ↔ GitHub 自動部署。
2. ~~移除未使用的 `nodemailer` 套件~~（2026-11-25 已從 package.json 與 package-lock.json 移除；尚未部署、未實際啟動驗證）。
3. Railway 上卡超過一個月的「暫存變更」要確認後套用或捨棄。
4. ~~補齊 `.env.example`~~（2026-11-25 已補上 SESSION_SECRET、RESEND_API_KEY、NOTIFY_EMAIL_TO、NOTIFY_EMAIL_FROM、SURVEY_URL）。
5. ~~後台「系統說明」分頁壞掉~~（2026-11-25 已修：連結本身沒壞，`/docs.html` 由 `public/` 靜態提供、後台以 iframe 載入；壞的是頁內「目前問卷題目結構」，因為 `docs.html` 把後台 API 已解析成陣列的 `options` 再 `JSON.parse`，遇到單選題就丟例外而顯示「無法讀取題目資料」，已改為同時接受陣列與字串，並修正「已下架」判斷。本機驗證 15 題都顯示；尚未部署）。
   - 注意：`/docs.html` 不需登入就能開（頁面刻意設計成未登入時退回公開題目 API），內容是系統說明與上架題目結構，不含回覆資料。若想只給後台看，要把它移到 `views/` 並加 `requireAuth` 路由。
6. ~~新增「問卷開放時間」設定~~（2026-11-25 完成，本機驗證，尚未部署）。
   - 後台新增「⏰ 開放時間」分頁：開放時間、結束時間兩個選填欄位（臺北時間，UTC+8），兩欄都空 = 不限制（預設，行為與以前相同）。所有登入者可看，**只有管理員能修改**；修改會寫入操作紀錄（`CHANGE_SURVEY_WINDOW`）。
   - 儲存在 `settings` 表的 `survey_open_at`、`survey_close_at`（格式 `YYYY-MM-DDTHH:MM`）。目前時間 < 開放 → `not_open`；目前時間 >= 結束 → `closed`（結束時間那一分鐘起即關閉）。
   - API：公開 `GET /api/survey-status`；後台 `GET/PUT /api/admin/settings/survey-window`。`POST /api/responses` 在不開放期間回 403（含 `code`，訊息依填寫語言：中／英／日）。
   - 填寫頁（`app.js`、`i18n.js`、`index.html`、`style.css`）載入時查狀態，不在開放期間就隱藏表單並顯示說明（含開放時間）；頁面載入後才過期的情況由後端 403 擋下。
   - 限制：只擋「送出」，不擋「讀題目」；邀請信與 QR code 不會因此失效；沒有「寄信通知即將截止」。結束後再次開放要手動改時間。
7. 評估跳題邏輯。
8. 收回公司組織帳號；建議備份 DB 的流程寫成固定排程。
