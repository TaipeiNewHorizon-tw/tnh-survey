const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel,
  BorderStyle, WidthType, ShadingType, PageNumber, PageBreak, ExternalHyperlink,
} = require('/sessions/pensive-optimistic-mayer/.npm-global/lib/node_modules/docx');
const fs = require('fs');

const CW = 9360;
const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const allBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, bold: true, font: 'Arial', size: 34, color: '1F4E79' })],
    spacing: { before: 480, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '2E75B6', space: 4 } },
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, bold: true, font: 'Arial', size: 26, color: '2E75B6' })],
    spacing: { before: 320, after: 140 },
  });
}
function h3(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, font: 'Arial', size: 24, color: '333333' })],
    spacing: { before: 220, after: 100 },
  });
}
function p(...runs) {
  const children = runs.map(r => typeof r === 'string' ? new TextRun({ text: r, font: 'Arial', size: 22 }) : r);
  return new Paragraph({ children, spacing: { before: 60, after: 80 } });
}
function bold(text, color) {
  return new TextRun({ text, bold: true, font: 'Arial', size: 22, ...(color ? { color } : {}) });
}
function run(text) { return new TextRun({ text, font: 'Arial', size: 22 }); }
function code(text) { return new TextRun({ text, font: 'Courier New', size: 20, color: '1F4E79' }); }

function bullet(children_or_text, sub = false) {
  const children = typeof children_or_text === 'string'
    ? [new TextRun({ text: children_or_text, font: 'Arial', size: 22 })]
    : children_or_text;
  return new Paragraph({ numbering: { reference: 'bullets', level: sub ? 1 : 0 }, children, spacing: { before: 40, after: 40 } });
}
function step(text) {
  return new Paragraph({
    numbering: { reference: 'steps', level: 0 },
    children: [new TextRun({ text, font: 'Arial', size: 22 })],
    spacing: { before: 60, after: 60 },
  });
}
function warn(text) {
  return new Paragraph({
    children: [
      new TextRun({ text: '⚠ 注意：', bold: true, font: 'Arial', size: 22, color: 'BF0000' }),
      new TextRun({ text: ' ' + text, font: 'Arial', size: 22, color: 'BF0000' }),
    ],
    indent: { left: 200 },
    spacing: { before: 100, after: 100 },
    border: { left: { style: BorderStyle.SINGLE, size: 8, color: 'FF0000', space: 4 } },
  });
}
function tip(text) {
  return new Paragraph({
    children: [
      new TextRun({ text: '★ 提示：', bold: true, font: 'Arial', size: 22, color: '005A9C' }),
      new TextRun({ text: ' ' + text, font: 'Arial', size: 22, color: '005A9C' }),
    ],
    spacing: { before: 80, after: 80 },
  });
}
function blank() { return new Paragraph({ children: [new TextRun('')], spacing: { before: 40, after: 40 } }); }
function pb() { return new Paragraph({ children: [new PageBreak()] }); }

function codeBlock(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: 'Courier New', size: 20, color: '1F4E79' })],
    shading: { fill: 'F0F4F8', type: ShadingType.CLEAR },
    indent: { left: 400 },
    spacing: { before: 80, after: 80 },
  });
}
function infoTable(rows, colWidths = [3200, 6160]) {
  return new Table({
    width: { size: CW, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: rows.map(([label, value, isHeader]) => {
      const headerFill = '2E75B6', rowFill = 'EBF3FB', textColor = isHeader ? 'FFFFFF' : '222222';
      return new TableRow({
        children: [
          new TableCell({ borders: allBorders, width: { size: colWidths[0], type: WidthType.DXA }, shading: { fill: isHeader ? headerFill : rowFill, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, font: 'Arial', size: 22, color: textColor })] })] }),
          new TableCell({ borders: allBorders, width: { size: colWidths[1], type: WidthType.DXA }, shading: { fill: isHeader ? headerFill : 'FFFFFF', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: value, font: 'Arial', size: 22, color: textColor })] })] }),
        ],
      });
    }),
  });
}
function faqTable(rows) {
  const hdr = (text) => new TableCell({ borders: allBorders, width: { size: 3600, type: WidthType.DXA }, shading: { fill: '2E75B6', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text, bold: true, font: 'Arial', size: 22, color: 'FFFFFF' })] })] });
  const hdr2 = (text) => new TableCell({ borders: allBorders, width: { size: 5760, type: WidthType.DXA }, shading: { fill: '2E75B6', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text, bold: true, font: 'Arial', size: 22, color: 'FFFFFF' })] })] });
  return new Table({
    width: { size: CW, type: WidthType.DXA },
    columnWidths: [3600, 5760],
    rows: [
      new TableRow({ children: [hdr('常見問題'), hdr2('解決方式')] }),
      ...rows.map(([q, a], i) => new TableRow({
        children: [
          new TableCell({ borders: allBorders, width: { size: 3600, type: WidthType.DXA }, shading: { fill: i % 2 === 0 ? 'FFFFFF' : 'F5F9FF', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: q, font: 'Arial', size: 22, bold: true })] })] }),
          new TableCell({ borders: allBorders, width: { size: 5760, type: WidthType.DXA }, shading: { fill: i % 2 === 0 ? 'FFFFFF' : 'F5F9FF', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: a, font: 'Arial', size: 22 })] })] }),
        ],
      })),
    ],
  });
}

const checklistItems = [
  '告知後台登入網址與帳號密碼，確認對方能成功登入',
  '實際操作示範：新增題目、修改題目、刪除題目',
  '示範如何查看統計圖表與逐筆填寫紀錄',
  '示範如何匯出 CSV，並確認對方能用 Excel 開啟',
  '確認 Railway 平台帳號是否需要轉移（railway.com 登入）',
  '確認 Railway 方案到期日與付款方式',
  '告知備份位置（CSV 存放的共用資料夾路徑）',
  '提供本說明書一份給接任人員',
  '確認接任人員有 IT 聯絡方式（遇到系統問題可聯絡）',
];

const doc = new Document({
  numbering: {
    config: [
      { reference: 'bullets', levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 600, hanging: 300 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '-', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 300 } } } },
      ]},
      { reference: 'steps', levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 600, hanging: 300 } } } },
      ]},
    ],
  },
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 34, bold: true, font: 'Arial', color: '1F4E79' }, paragraph: { spacing: { before: 480, after: 200 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, font: 'Arial', color: '2E75B6' }, paragraph: { spacing: { before: 320, after: 140 }, outlineLevel: 1 } },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1800 },
      },
    },
    headers: {
      default: new Header({ children: [
        new Paragraph({
          children: [
            new TextRun({ text: '問卷調查系統操作與維護說明書　', font: 'Arial', size: 18, color: '888888' }),
            new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 18, color: '888888' }),
          ],
          border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC', space: 4 } },
        }),
      ]}),
    },
    footers: {
      default: new Footer({ children: [
        new Paragraph({
          children: [new TextRun({ text: '臺北文創開發股份有限公司　機密文件，僅供內部使用', font: 'Arial', size: 18, color: '888888' })],
          border: { top: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC', space: 4 } },
        }),
      ]}),
    },
    children: [
      // ── 封面 ──
      blank(), blank(), blank(), blank(),
      new Paragraph({ children: [new TextRun({ text: '臺北文創開發股份有限公司', bold: true, font: 'Arial', size: 28, color: '444444' })], alignment: AlignmentType.CENTER, spacing: { before: 0, after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: '問卷調查系統', bold: true, font: 'Arial', size: 64, color: '1F4E79' })], alignment: AlignmentType.CENTER, spacing: { before: 0, after: 120 } }),
      new Paragraph({ children: [new TextRun({ text: '操作與維護說明書', bold: true, font: 'Arial', size: 48, color: '2E75B6' })], alignment: AlignmentType.CENTER, spacing: { before: 0, after: 600 } }),
      new Paragraph({ children: [new TextRun({ text: '── 臺北文創場地參與體驗滿意度調查系統 ──', font: 'Arial', size: 24, color: '666666', italics: true })], alignment: AlignmentType.CENTER, spacing: { before: 0, after: 800 } }),
      new Paragraph({ children: [new TextRun({ text: '版本 1.0　|　2026 年 7 月', font: 'Arial', size: 22, color: '888888' })], alignment: AlignmentType.CENTER, spacing: { before: 0, after: 120 } }),
      new Paragraph({ children: [new TextRun({ text: '適用對象：負責本問卷系統維護之業務人員', font: 'Arial', size: 22, color: '888888' })], alignment: AlignmentType.CENTER, spacing: { before: 0, after: 120 } }),
      pb(),

      // ── 目錄 ──
      h1('目錄大綱'),
      infoTable([
        ['章節', '內容說明', true],
        ['第一章　系統概覽', '系統架構、重要網址、平台說明'],
        ['第二章　系統權限與登入方式', '後台網址、帳號密碼管理、登入步驟、安全注意事項'],
        ['第三章　日常維護與修改指南', '新增/修改/刪除/排序題目、停用問卷（最重要章節）'],
        ['第四章　數據導出與報表檢視', '統計圖表說明、CSV 匯出、逐筆查詢、異常資料處理'],
        ['第五章　外部發布與通路管理', '問卷連結、QR Code 製作、嵌入官網的程式碼'],
        ['第六章　年度交接與故障排除', '常見 FAQ 對照表、備份建議、完整交接清單'],
      ]),
      blank(),
      warn('本說明書含有系統帳號密碼等敏感資訊，請妥善保管，不得對外公開或張貼於公共場所。'),
      pb(),

      // ── 第一章 ──
      h1('第一章　系統概覽'),
      h2('1.1 系統簡介'),
      p('本系統為臺北文創場地參與體驗滿意度調查的線上問卷平台。參與者掃描現場 QR Code 後，可直接用手機填寫問卷，填寫結果即時儲存至雲端資料庫。後台管理員可隨時新增、修改或刪除問卷題目，並查看統計圖表或匯出資料。'),
      blank(),
      h2('1.2 重要網址一覽'),
      infoTable([
        ['項目', '網址', true],
        ['問卷填寫頁面（民眾使用）', 'https://tnh-customet-survey-production.up.railway.app'],
        ['後台管理頁面（員工使用）', 'https://tnh-customet-survey-production.up.railway.app/admin'],
        ['雲端平台管理後台', 'https://railway.com'],
        ['資料匯出（CSV）', 'https://tnh-customet-survey-production.up.railway.app/api/admin/responses.csv'],
      ]),
      blank(),
      h2('1.3 技術架構簡介（參考用）'),
      bullet('程式語言：Node.js + Express 框架（雲端執行，員工不需要懂程式）'),
      bullet('資料庫：SQLite（所有填寫資料儲存於此）'),
      bullet('雲端主機：Railway 平台（自動維護伺服器，不需管理實體機器）'),
      bullet('資料儲存位置：Railway 雲端永久磁碟，即使程式更新填寫紀錄也不會消失'),
      blank(),
      tip('員工只需要用瀏覽器操作後台，不需要懂程式也不需要進入伺服器。'),
      pb(),

      // ── 第二章 ──
      h1('第二章　系統權限與登入方式'),
      h2('2.1 後台登入網址'),
      p(bold('管理後台：'), run('https://tnh-customet-survey-production.up.railway.app/admin')),
      p('建議將此網址加入瀏覽器書籤，方便日後快速進入。'),
      blank(),
      h2('2.2 帳號密碼管理'),
      infoTable([
        ['項目', '說明', true],
        ['帳號類型', '公用公務帳號（全體負責人員共用同一組帳密）'],
        ['帳號（使用者名稱）', '（請參照人員交接文件，由主管告知）'],
        ['密碼', '（請參照人員交接文件，由主管告知）'],
        ['密碼存放位置', '由主管保存，交接時當面告知接任人員'],
        ['密碼更換方式', '需請 IT 人員進入 Railway 後台修改環境變數'],
      ]),
      blank(),
      warn('帳號與密碼為公用帳號，請勿與無關人員分享。密碼遺失時請聯絡 IT 人員重新設定。'),
      blank(),
      h2('2.3 登入步驟'),
      step('開啟瀏覽器（建議使用 Chrome 或 Edge）'),
      step('在網址列輸入後台網址，按 Enter'),
      step('瀏覽器會跳出登入視窗（帳號密碼輸入框）'),
      step('輸入帳號與密碼，按「登入」或「確定」'),
      step('成功後進入後台管理頁面，看到題目清單即表示登入成功'),
      blank(),
      tip('如果跳出「此網頁需要驗證」或「Authorization Required」，這是正常的安全機制，請直接輸入帳密即可。'),
      blank(),
      h2('2.4 安全注意事項'),
      bullet('不可將後台網址或帳密張貼於公開場所（白板、Line 群組等）'),
      bullet('使用完畢後請關閉瀏覽器分頁，尤其在共用電腦上'),
      bullet('若懷疑帳密外洩，請立即聯絡 IT 人員更換密碼'),
      bullet('本系統後台不支援個人帳號，請勿嘗試自行建立多組帳號'),
      pb(),

      // ── 第三章 ──
      h1('第三章　日常維護與修改指南'),
      p(bold('本章為最重要章節。', 'BF0000'), run('所有對題目的變更均會即時生效，操作前請確認已備份現有資料。')),
      blank(),
      h2('3.1 進入題目管理'),
      step('以第二章的步驟登入後台'),
      step('頁面頂端即為「題目管理」區塊，顯示目前所有題目清單'),
      step('每一道題目右側有「↑」「↓」「編輯」「刪除」四個按鈕'),
      blank(),
      h2('3.2 新增題目'),
      step('在頁面下方找到「新增題目」表單'),
      step('填寫各欄位（說明見下表）'),
      step('確認內容後點選「儲存」按鈕，題目會出現在清單最下方'),
      blank(),
      infoTable([
        ['欄位名稱', '說明', true],
        ['題目分類', '選填。填入大分類，如「場地設施」「服務品質」，方便後台辨識'],
        ['題目內容', '必填。填入完整的題目文字'],
        ['題目類型', '從下拉選單選擇（詳見下方題目類型說明）'],
        ['選項內容', '五等量表/單選/多選題才需要填寫，每行一個選項'],
        ['是否必填', '勾選後，填寫者不填此題就無法送出問卷'],
        ['附加說明欄', '勾選後，該題下方會多一格讓填寫者補充說明原因'],
      ]),
      blank(),
      infoTable([
        ['題目類型', '適用情境', true],
        ['五等量表', '滿意度評分（非常滿意／滿意／普通／不滿意／非常不滿意），系統會自動計算平均分數'],
        ['單選題', '只能選一個答案，需自訂選項'],
        ['多選題', '可同時選多個答案，需自訂選項'],
        ['簡短文字', '開放式短答，適合姓名、電話等'],
        ['長文字', '開放式長答，適合意見、建議等大段文字'],
        ['日期', '讓填寫者選擇一個日期'],
      ]),
      blank(),
      h2('3.3 修改現有題目'),
      step('找到要修改的題目，點選右側「編輯」按鈕'),
      step('頁面下方的表單會自動填入現有內容'),
      step('修改需要更動的欄位（例如改錯字、增減選項）'),
      step('點選「儲存」確認修改'),
      blank(),
      warn('修改五等量表的選項文字後，統計分析可能因選項名稱改變而異常，如非必要不建議修改已有填寫資料的題目選項。'),
      blank(),
      h2('3.4 刪除 / 下架題目'),
      step('找到要刪除的題目，點選「刪除」按鈕'),
      step('系統會跳出確認對話框，確認後按「確定」'),
      blank(),
      p('刪除行為分兩種情況：'),
      bullet([bold('尚未有人填寫過此題：'), run(' 直接永久刪除，無法復原')]),
      bullet([bold('已有人填寫過此題：'), run(' 系統自動「下架」而非刪除，舊填寫紀錄仍保留，但新問卷不再顯示此題')]),
      blank(),
      tip('「下架」的題目在清單中顯示為灰色，可透過「編輯」功能重新上架（勾選「上架中」後儲存）。'),
      blank(),
      h2('3.5 調整題目順序'),
      step('找到要移動的題目'),
      step('點選右側「↑」將題目往上移，「↓」往下移'),
      step('多次點選可移動多個位置，順序調整後立即生效'),
      blank(),
      h2('3.6 邏輯跳題說明'),
      p(bold('目前版本尚不支援「邏輯跳題」功能。', 'BF0000')),
      p('例如「若選不滿意則跳出原因填寫欄」這類條件式顯示，目前無法設定。現行做法是在題目上勾選「附加說明欄位」，讓填寫者可選擇性填寫原因（不會自動跳題）。如需完整的跳題邏輯，請聯絡 IT 人員評估系統升級。'),
      blank(),
      h2('3.7 停用問卷（手動關閉填寫）'),
      p('本系統目前沒有設定「問卷開放時間」的功能，若需暫停問卷收集，可使用以下方式：'),
      blank(),
      h3('方式一：下架所有題目（推薦）'),
      step('進入後台，逐一點選每道題目的「刪除」按鈕（有填寫紀錄者會自動下架）'),
      step('所有題目下架後，填寫頁面會顯示無可填寫的題目'),
      step('待下次活動前，再重新上架或新增題目'),
      blank(),
      warn('停用問卷前請先匯出本次活動的所有填寫資料（見第四章），避免與下次活動資料混淆。'),
      pb(),

      // ── 第四章 ──
      h1('第四章　數據導出與報表檢視'),
      h2('4.1 即時統計圖表'),
      p('登入後台後，向下捲動頁面，可看到「統計分析」區塊：'),
      bullet('五等量表題目的平均分數排名（由高至低，並標示「表現最佳」「表現最差」）'),
      bullet('百分比堆疊條形圖：每道題目以一根橫條呈現 1～5 分各有多少人填寫'),
      bullet('單選／多選題目的各選項分布（人數與百分比）'),
      blank(),
      p('堆疊條形圖色彩說明：'),
      infoTable([
        ['顏色', '代表意義', true],
        ['深綠色（最左邊）', '非常滿意（最高分 5 分）'],
        ['淺綠色', '滿意（4 分）'],
        ['灰色', '普通（3 分）'],
        ['橘色', '不滿意（2 分）'],
        ['紅色（最右邊）', '非常不滿意（最低分 1 分）'],
      ]),
      blank(),
      tip('將滑鼠移到色塊上，會顯示確切人數與百分比。一眼就能看出是「普遍給 3 分」還是「兩極化（高低分都有）」。'),
      blank(),
      h2('4.2 逐筆查看填寫紀錄'),
      step('登入後台，向下捲動至「填寫紀錄」區塊'),
      step('可看到每一筆填寫的時間與編號，每頁顯示 10 筆'),
      step('點選任一筆紀錄可「展開」看到每題的詳細答案'),
      step('使用「上一頁」「下一頁」按鈕翻頁'),
      blank(),
      h2('4.3 匯出 CSV 資料（Excel 可開啟）'),
      step('登入後台（必須先登入，否則下載失敗）'),
      step('在「填寫紀錄」區塊找到「下載 CSV」按鈕，點選即可下載'),
      step('下載的檔案可直接用 Microsoft Excel 或 Google 試算表開啟，中文不會亂碼'),
      step('建議以活動日期命名後存入共用資料夾，如：2026-07-活動名稱-問卷.csv'),
      blank(),
      tip('CSV 中每一欄代表一道題目，每一行代表一筆填寫紀錄，第一行為標題列。'),
      blank(),
      h2('4.4 異常資料處理'),
      p(bold('目前系統不支援透過後台介面刪除單筆填寫紀錄。', 'BF0000')),
      p('若有測試資料進入系統，建議的做法：'),
      bullet('在正式開放問卷前，避免在正式系統做測試；測試請使用本機環境（洽 IT 人員）'),
      bullet('若少量測試資料已進入，可在 Excel 中手動排除後再分析（不影響系統資料）'),
      bullet('若需從資料庫直接刪除指定紀錄，請聯絡 IT 人員處理'),
      blank(),
      warn('切勿嘗試直接修改或刪除資料庫檔案（survey.db），可能導致整個系統無法運作。'),
      pb(),

      // ── 第五章 ──
      h1('第五章　外部發布與通路管理'),
      h2('5.1 問卷填寫網址'),
      p(bold('正式填寫網址：'), run('https://tnh-customet-survey-production.up.railway.app')),
      p('此網址可直接傳送給參與者，或轉換成 QR Code 印刷供現場使用。'),
      blank(),
      h2('5.2 QR Code 使用'),
      h3('使用現有 QR Code'),
      p('QR Code 圖檔（qrcode.png）存放於系統資料夾「Online-survey」中（路徑：C:\\Users\\michael\\Claude\\Projects\\Online-survey\\qrcode.png），可直接開啟印刷或投影使用。'),
      blank(),
      h3('重新產生 QR Code（網址變更時）'),
      p('若未來系統網址變更，需要重新產生。請請 IT 人員執行以下指令：'),
      codeBlock('cd "C:\\Users\\michael\\Claude\\Projects\\Online-survey"'),
      codeBlock('node generate-qrcode.js https://tnh-customet-survey-production.up.railway.app'),
      p('執行後，資料夾內會自動產生新的 qrcode.png 圖檔。'),
      blank(),
      h2('5.3 嵌入公司官網'),
      p('若需將問卷嵌入公司官網，請提供以下 HTML 程式碼給網站工程師：'),
      codeBlock('<iframe src="https://tnh-customet-survey-production.up.railway.app" width="100%" height="800px" frameborder="0"></iframe>'),
      p('工程師將其嵌入到適當的網頁位置即可。嵌入後請在手機與電腦上分別測試，確認問卷能正常填寫與送出。'),
      pb(),

      // ── 第六章 ──
      h1('第六章　年度交接與故障排除'),
      h2('6.1 常見問題 FAQ'),
      faqTable([
        ['民眾反映無法打開問卷頁面', '確認網址是否正確，然後登入 https://railway.com 確認服務是否顯示「Online」。若顯示「Crashed」，請立即聯絡 IT 人員。'],
        ['後台頁面一直跳出帳號密碼視窗', '確認帳號密碼輸入正確（注意大小寫）。確定正確但仍無法登入，請聯絡 IT 人員確認設定。'],
        ['統計圖表沒有顯示任何數據', '確認目前是否有人填寫過問卷。有填寫紀錄但圖表空白，請嘗試重新整理頁面（F5）。'],
        ['下載 CSV 時跳出帳號密碼視窗', '這是正常的安全機制，輸入後台登入的相同帳號密碼即可。'],
        ['問卷頁面顯示空白，沒有題目', '所有題目可能被下架了。登入後台確認題目清單，將需要的題目重新上架。'],
        ['Railway 顯示「N days or $5.00 left」', '這是免費試用額度提示，請及早聯絡 IT 人員升級方案，以維持服務持續運作。'],
        ['QR Code 掃描後顯示「無法連線」', '問題在民眾的手機網路，與系統無關。確認活動現場有可用的 Wi-Fi 或行動網路。'],
        ['想知道目前共有幾筆有效填寫', '登入後台，在「填寫紀錄」區塊頂端會顯示「目前共有 N 筆填寫紀錄」。'],
        ['需要更換後台帳號或密碼', '帳號密碼存放在 Railway 平台的環境變數中，需由 IT 人員登入 railway.com 修改。'],
      ]),
      blank(),
      h2('6.2 備份建議'),
      p('本系統資料存於 Railway 雲端磁碟，但仍建議員工定期自行匯出備份：'),
      blank(),
      infoTable([
        ['備份時機', '建議操作', true],
        ['每次活動結束後', '立即匯出 CSV，以活動名稱與日期命名存檔'],
        ['每季（3 個月）', '匯出一次完整 CSV，存入公司共用雲端資料夾（OneDrive 或 Google Drive）'],
        ['系統更新前', '請 IT 人員備份 Railway 雲端磁碟中的 survey.db 資料庫檔案'],
        ['人員交接時', '當面確認對方能成功登入後台、能成功匯出 CSV'],
      ]),
      blank(),
      warn('Railway 免費試用額度（$5）到期後服務會停止，資料庫將無法存取，請務必在到期前升級方案並確保資料已備份。'),
      blank(),
      h2('6.3 年度交接清單'),
      p('以下為人員交接時的必要確認事項，請逐項完成：'),
      blank(),
      new Table({
        width: { size: CW, type: WidthType.DXA },
        columnWidths: [500, 6360, 900, 1600],
        rows: [
          new TableRow({ children: [
            new TableCell({ borders: allBorders, width: { size: 500, type: WidthType.DXA }, shading: { fill: '2E75B6', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '#', bold: true, font: 'Arial', size: 20, color: 'FFFFFF' })] })] }),
            new TableCell({ borders: allBorders, width: { size: 6360, type: WidthType.DXA }, shading: { fill: '2E75B6', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 100, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: '交接項目', bold: true, font: 'Arial', size: 20, color: 'FFFFFF' })] })] }),
            new TableCell({ borders: allBorders, width: { size: 900, type: WidthType.DXA }, shading: { fill: '2E75B6', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '完成', bold: true, font: 'Arial', size: 20, color: 'FFFFFF' })] })] }),
            new TableCell({ borders: allBorders, width: { size: 1600, type: WidthType.DXA }, shading: { fill: '2E75B6', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: '備註', bold: true, font: 'Arial', size: 20, color: 'FFFFFF' })] })] }),
          ]}),
          ...checklistItems.map((item, i) => new TableRow({ children: [
            new TableCell({ borders: allBorders, width: { size: 500, type: WidthType.DXA }, shading: { fill: i % 2 === 0 ? 'FFFFFF' : 'F5F9FF', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(i + 1), font: 'Arial', size: 22 })] })] }),
            new TableCell({ borders: allBorders, width: { size: 6360, type: WidthType.DXA }, shading: { fill: i % 2 === 0 ? 'FFFFFF' : 'F5F9FF', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 100, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: item, font: 'Arial', size: 22 })] })] }),
            new TableCell({ borders: allBorders, width: { size: 900, type: WidthType.DXA }, shading: { fill: i % 2 === 0 ? 'FFFFFF' : 'F5F9FF', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '□', font: 'Arial', size: 22 })] })] }),
            new TableCell({ borders: allBorders, width: { size: 1600, type: WidthType.DXA }, shading: { fill: i % 2 === 0 ? 'FFFFFF' : 'F5F9FF', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: '', font: 'Arial', size: 22 })] })] }),
          ]})),
        ],
      }),
      blank(),
      h2('6.4 IT 聯絡資訊'),
      p('若遇到下列情況，請聯絡公司 IT 人員：'),
      bullet('Railway 服務到期需要升級或遷移平台'),
      bullet('需要刪除特定筆數的填寫資料'),
      bullet('需要新增「邏輯跳題」等進階功能'),
      bullet('系統出現「Deployment crashed」且自行重新整理後無法恢復'),
      bullet('需要更換後台帳號密碼（需修改 Railway 環境變數設定）'),
      blank(),
      infoTable([
        ['項目', '資訊', true],
        ['Railway 平台', 'https://railway.com（需 IT 人員帳號）'],
        ['程式碼資料夾', 'C:\\Users\\michael\\Claude\\Projects\\Online-survey\\'],
        ['資料庫備份路徑', 'Railway 雲端磁碟 /data/survey.db'],
        ['IT 聯絡', '請洽公司 IT 負責人'],
      ]),
      blank(), blank(),
      new Paragraph({ children: [new TextRun({ text: '── 文件結束 ──', font: 'Arial', size: 22, color: '888888', italics: true })], alignment: AlignmentType.CENTER, spacing: { before: 400, after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: '臺北文創開發股份有限公司　版本 1.0　2026/07', font: 'Arial', size: 20, color: 'AAAAAA' })], alignment: AlignmentType.CENTER }),
    ],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync('/sessions/pensive-optimistic-mayer/mnt/Online-survey/問卷調查系統操作與維護說明書.docx', buf);
  console.log('done');
});
