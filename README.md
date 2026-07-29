# 臺北文創場地參與體驗滿意度調查（網路版問卷）

讓參與者掃描 QR Code、用手機填寫問卷，結果存進資料庫，後台可隨時新增/編輯/刪除/排序題目，並匯出 CSV。

## 功能

- 手機版填寫頁面：`/`，題目完全從資料庫讀取，不是寫死在程式碼裡
- 後台管理（需密碼）：`/admin`，可新增、編輯、刪除、上下架、排序題目
- 已有人填寫過的題目，刪除時會自動「下架」而不是真的刪除，歷史資料不會壞掉
- 後台可逐筆查詢每一筆填寫紀錄（分頁瀏覽、展開看詳細答案），也可下載 CSV（Excel 可直接開，中文不會亂碼）
- 後台「統計分析」會自動計算五等量表題目的平均分數並排名，找出表現最好與最差的項次；單選/多選題目則顯示各選項的分布
- QR Code 產生工具，掃了就能直接打開填寫頁面

## 本機執行

需要 Node.js 22.5 以上版本（用到內建的 `node:sqlite`）。

```bash
npm install
cp .env.example .env
# 編輯 .env，設定後台帳號密碼（ADMIN_USER / ADMIN_PASSWORD）
npm run seed       # 第一次執行，把問卷題目寫入資料庫
npm start          # 啟動伺服器，預設 http://localhost:3000
```

打開 `http://localhost:3000` 看填寫頁面，`http://localhost:3000/admin` 進後台（會跳出帳號密碼框）。

## 部署到雲端（以 Render 為例）

1. 把這個專案 push 到一個 GitHub repository。
2. 到 [Render](https://render.com) 建立一個新的 **Web Service**，選擇剛剛的 repository。
3. 設定：
   - Build Command：`npm install`
   - Start Command：`npm start`
4. 在 Render 的 Environment 設定這幾個變數：
   - `ADMIN_USER`、`ADMIN_PASSWORD`：後台登入帳密，務必改成自己的，不要用範例值
   - `DB_PATH`：設成 `/data/survey.db`（搭配下面的 Persistent Disk）
5. 新增一個 **Persistent Disk**，Mount Path 設為 `/data`。這一步很重要：沒有的話，Render 每次重新部署都會把資料庫清空。
6. 部署完成後，Render 會給一個網址（例如 `https://xxx.onrender.com`）。先打開這個網址確認填寫頁面正常，再用同一個網址後面加 `/admin` 確認後台也能登入。
7. 第一次部署後，要手動執行一次 seed 把題目寫進資料庫。Render 的 Shell 功能裡執行：
   ```bash
   npm run seed
   ```

其他平台（Railway、Fly.io 等）邏輯類似：找一個支援掛載持久化磁碟、可以跑 Node.js 22.5+ 的方案即可。

## 產生 QR Code

部署網址確定後，執行：

```bash
node generate-qrcode.js https://你的部署網址.onrender.com
```

會在專案資料夾產生 `qrcode.png`，把這張圖印出來或放到活動現場螢幕上，讓參與者掃描後就能直接打開填寫頁面。

## 後台怎麼編輯題目

1. 開啟 `/admin`，輸入帳號密碼。
2. 「題目管理」區塊可以看到目前所有題目，用 ↑/↓ 調整順序，「編輯」修改內容，「刪除」移除（已有填寫紀錄的題目會自動改成下架，資料不會不見）。
3. 「新增題目」表單可以加題目，選擇題目類型：
   - 簡短文字／長文字／日期：開放式填寫
   - 五等量表：適合「非常滿意～非常不滿意」這類題目
   - 單選／多選：自訂選項，每行輸入一個
   - 可以勾選「附加一個額外文字欄位」，讓這題多一格讓填寫者寫原因或建議（對應紙本問卷的「請說明：____」欄位）
4. 「統計分析」區塊會自動列出所有五等量表題目的平均分數，由高到低排序，並標示「表現最佳」「表現最差」；單選/多選題目顯示各選項被選的次數與比例。
5. 「填寫紀錄」區塊可逐頁瀏覽每一筆填寫結果（每頁 10 筆，點一筆可展開看完整答案），也可按「下載 CSV」匯出全部資料。

## 資料庫結構（給未來維護用）

- `questions`：題目本身，admin 後台操作的對象
- `responses`：每一次問卷送出算一筆
- `answers`：每一筆送出裡，每一題的答案。answer 裡會保留當時題目的文字、分類、類型（snapshot），所以即使之後在後台修改或刪除了某題，舊的填寫資料還是完整可讀，不會因為題目變動而對不起來。

## 檔案結構

```
server.js            主程式（所有路由）
db.js                資料庫連線與資料表結構
seed.js              第一次執行時寫入紙本問卷的題目
generate-qrcode.js   產生 QR Code 圖片
public/              填寫頁面（index.html / app.js / style.css）+ 後台用的 admin.css / admin.js
views/admin.html     後台頁面（特意放在 public 之外，避免繞過密碼直接看到後台畫面）
.env.example          環境變數範例
```
