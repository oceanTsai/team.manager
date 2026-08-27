// config.gs
// B Team 線上問題助理 — 集中設定檔
//
// 【使用方式】
//   在 Google Apps Script 專案中新增一個檔案，命名為 config.gs
//   把這個檔案的內容貼進去，主程式 BTeam_線上問題助理_v1.9.gs 會自動讀取這裡的設定
//
// 【需要手動填入的值】
//   標示 ← 填入 的欄位，請換成你自己的實際值
//   其他欄位通常不需要動

// ============================================================
// Google Drive 設定
// ============================================================

/**
 * 「線上問題」根資料夾 ID
 *
 * 從資料夾 URL 取得：
 * https://drive.google.com/drive/folders/【這段就是ID】
 *
 * 資料夾結構：
 *   線上問題/          ← 這個資料夾的 ID
 *     2026/
 *       2026_線上問題  ← 試算表（檔名需包含 SPREADSHEET_FILENAME_KEYWORD）
 *     2027/
 *       2027_線上問題
 */
const CONFIG_DRIVE_ROOT_FOLDER_ID = "19LoNnayLWGomyfhKQZ4e9YQSvQ7-r15u";

/**
 * 試算表檔名關鍵字
 * 程式會在當年度資料夾中找檔名包含此字串的試算表
 * 預設：線上問題（對應檔名 2026_線上問題）
 */
const CONFIG_SPREADSHEET_FILENAME_KEYWORD = "線上問題";

// ============================================================
// Teams Webhook 設定
// ============================================================

/**
 * Teams @tag 白名單
 * 只有訊息中包含這些 tag 才會觸發派工流程
 */
const CONFIG_ALLOWED_TAGS = ["掛單水流_前端", "掛單水流_All"];

// ============================================================
// 派工設定
// ============================================================

/**
 * 兩軸加權設定
 *
 * X 軸：difficulty（修復難度）
 *   fixComplexity — 修復複雜度（權重 0.5）
 *   risk          — 修復風險  （權重 0.3）
 *   repro         — 重現難度  （權重 0.2）
 *
 * Y 軸：priority（急迫程度）
 *   impact        — 影響範圍  （權重 0.6）
 *   urgency       — 業務緊急度（權重 0.4）
 */
const CONFIG_WEIGHTS = {
  difficulty: { fixComplexity: 0.5, risk: 0.3, repro: 0.2 },
  priority:   { impact: 0.6, urgency: 0.4 },
};

/**
 * 象限門檻
 * 軸分 >= 此值視為「高」，影響落入哪個象限
 * 範圍 1.0～3.0，預設 2.0（中間值）
 * 太多 Q1/Q2 → 調高（例如 2.3）
 * 太少 Q1/Q2 → 調低（例如 1.8）
 */
const CONFIG_AXIS_THRESHOLD = 2;

/**
 * 象限 → 可接單的工程師水平
 *
 * 職級代號對照：
 *   L1 = 資淺
 *   L2 = 中階
 *   L3 = 中高階
 *   L4 = 資深
 *   L5 = TL
 *
 *             │  低急迫       │  高急迫
 *   ──────────┼───────────────┼──────────────
 *   高難度    │  Q2 排程深修  │  Q1 立刻救火
 *   低難度    │  Q4 日常練手  │  Q3 快速處理
 */
const CONFIG_QUADRANT_LEVEL = {
  Q1: ["L5", "L4"],         // 高難度 + 高急迫：立刻救火
  Q2: ["L5", "L4", "L3"],   // 高難度 + 低急迫：排程深修
  Q3: ["L3", "L2", "L1"],   // 低難度 + 高急迫：快速處理
  Q4: ["L2", "L1"],         // 低難度 + 低急迫：日常練手
};

// ============================================================
// OpenAI 設定
// ============================================================

/**
 * 使用的 OpenAI 模型
 * 預設 gpt-4o-mini（平衡效能與成本）
 * 若分析品質不夠可換 gpt-4o
 */
const CONFIG_OPENAI_MODEL = "gpt-4o-mini";

/**
 * OpenAI 回傳的最大 token 數
 * 評分 JSON 約 300～500 token，800 有足夠餘裕
 */
const CONFIG_OPENAI_MAX_TOKENS = 800;

/**
 * Jira 附件最多下載幾張圖片送給 AI 分析
 * 越多越準但越慢，建議 3 張
 */
const CONFIG_MAX_IMAGES = 3;


// ============================================================
// 以下為主程式
// ============================================================

// v1.9.0
// B_TEAM 線上問題助理（含 AI 難度量化派工）
//
// 【整體流程說明】
//   1. Teams 頻道有人 @tag 並附上 Jira 連結
//   2. Power Automate（或其他 webhook 觸發器）呼叫本 Web App (doPost)
//   3. doPost 驗證 token → 確認 tag 在白名單 → 抓 Jira 單號
//   4. getSpreadsheet_() 用 DriveApp 爬資料夾，找到當年度試算表
//      驗證規則：資料夾名稱 = 當年年份（例如 "2026"）
//               檔案名稱   = 包含「線上問題」（例如 "2026_線上問題"）
//   5. analyzeJiraIssue_() 呼叫 Jira API 取得標題/描述/圖片
//      → 送 OpenAI 分析，拿回結構化 JSON（評分 + domain）
//   6. calcQuadrant_() 根據五項指標加權，算出象限（Q1～Q4）
//   7. getAndUpdateAssignee_() 依象限水平 + domain 從值星表挑人
//   8. 寫入「線上問題」試算表，回傳結果給呼叫端
//
// 【指令碼屬性設定（專案設定 > 指令碼屬性）】
//   WEBHOOK_TOKEN  — 驗證來源的 token，防止任意呼叫
//   JIRA_EMAIL     — Jira 帳號 email
//   JIRA_TOKEN     — Jira API token（非密碼）
//   JIRA_URL       — Jira 站台 URL，例如 https://104corp.atlassian.net
//   OPENAI_API_KEY — OpenAI API 金鑰
//
// 【設定檔】
//   所有可調整的常數（象限門檻、加權、白名單、Drive ID 等）
//   統一放在 config.gs，不需要改這個檔案
//
// ============================================================
// 【測試方式】
// ============================================================
//
// ── 步驟一：發布 Web App ────────────────────────────────────
//   1. GAS 編輯器右上角 Deploy > Manage deployments
//   2. 點鉛筆圖示（Edit）> Version 選「New version」> Deploy
//   3. Execute as：Me
//      Who has access：Anyone（Power Automate 需要匿名存取）
//   4. 複製 Web App URL，格式如下：
//      https://script.google.com/macros/s/【DEPLOYMENT_ID】/exec
//   ※ 每次改完程式都要重新發布（選 New version），URL 不會變
//
// ── 步驟二：用 curl 直接打 API 測試 ────────────────────────
//   在終端機（iTerm）執行以下指令，把 YOUR_WEB_APP_URL 和
//   YOUR_WEBHOOK_TOKEN 換成你的實際值，VIPOP-XXXXX 換成真實單號：
//
//   curl -X POST "YOUR_WEB_APP_URL" //     -H "Content-Type: application/json" //     -d '{
//       "token": "YOUR_WEBHOOK_TOKEN",
//       "sender": "測試人員",
//       "sentAt": "2026-01-01T00:00:00.000Z",
//       "messageContent": "<at>掛單水流_前端</at> 請協助 https://104corp.atlassian.net/browse/VIPOP-XXXXX",
//       "messageUrl": "https://teams.microsoft.com/test",
//       "messageId": "test-001",
//       "teamId": "test-team",
//       "channelId": "test-channel"
//     }'
//
// ── 步驟三：確認回傳結果 ────────────────────────────────────
//   成功時 curl 會回傳 JSON，例如：
//   {
//     "status": "ok",
//     "assignee": "Agnes Kao 高慈謙",
//     "assigneeEmail": "agnes@104.com.tw",
//     "quadrant": "Q3",
//     "domain": "frontend",
//     "difficulty": 1.6,
//     "priority": 2.2,
//     "summary": "VIP列印自定版履歷被裁切..."
//   }
//
//   失敗時會回傳：
//   { "status": "error", "message": "錯誤原因" }
//   { "status": "skip",  "reason": "no matching tag" }
//
// ── 常見錯誤排查 ─────────────────────────────────────────────
//   unauthorized          → WEBHOOK_TOKEN 對不上
//   no matching tag       → messageContent 裡沒有白名單 tag
//   no jira issue found   → messageContent 裡沒有 Jira URL
//   找不到年份資料夾       → Drive 裡還沒建 2026 資料夾
//   找不到試算表           → 試算表檔名不含「線上問題」
//   找不到「線上問題值星」  → 工作表名稱打錯或還沒建立
//
// ── GAS 內建測試函式（不用 curl，直接在 GAS 跑）────────────
//   在 GAS 編輯器選擇 testDoPost 函式然後點執行，
//   可以在不依賴 Power Automate 的情況下直接測試完整流程：
//
//   function testDoPost() {
//     const fakeEvent = {
//       postData: {
//         contents: JSON.stringify({
//           token: PropertiesService.getScriptProperties().getProperty("WEBHOOK_TOKEN"),
//           sender: "測試人員",
//           sentAt: new Date().toISOString(),
//           messageContent: "<at>掛單水流_前端</at> 請協助 https://104corp.atlassian.net/browse/VIPOP-XXXXX",
//           messageUrl: "https://teams.microsoft.com/test",
//           messageId: "test-001",
//           teamId:    "test-team",
//           channelId: "test-channel",
//         })
//       }
//     };
//     const result = doPost(fakeEvent);
//     Logger.log(result.getContent());
//   }
//
// ============================================================

// ============================================================
// 設定區（統一管理，調整行為只需改這裡）
// ============================================================

/**
 * 兩軸加權設定
 *
 * 派工系統用兩個軸來決定象限：
 *
 * ── X 軸：difficulty（修復難度）────────────────────────────
 *   由三個指標加權合成，代表「這個 bug 技術上有多難搞」：
 *   - fixComplexity（修復複雜度，權重 0.5）：改起來要動多少東西
 *   - risk         （修復風險，  權重 0.3）：改了以後有沒有副作用
 *   - repro        （重現難度，  權重 0.2）：能不能穩定重現來 debug
 *
 * ── Y 軸：priority（急迫程度）──────────────────────────────
 *   由兩個指標加權合成，代表「這個 bug 業務上有多急」：
 *   - impact  （影響範圍，權重 0.6）：影響多少用戶 / 模組
 *   - urgency （業務緊急，權重 0.4）：業務方要求多快修
 *
 * 權重總和各自為 1.0，不需要調整。
 * 如果你覺得哪個指標更重要，可以在這裡調整數字。
 */
// 以下常數從 config.gs 讀取，請勿在此修改
const WEIGHTS     = CONFIG_WEIGHTS;

/**
 * 象限門檻
 *
 * 兩軸的加權分數範圍都是 1.0～3.0（因為 AI 對每個指標給 1～3 分）。
 * 當軸分 >= AXIS_THRESHOLD，視為「高」，否則為「低」。
 *
 * 預設 2.0 = 中間值，代表「超過平均就算高」。
 * 如果你覺得現在太多 Q1/Q2，可以調高到 2.3；太少則調低到 1.8。
 */
const AXIS_THRESHOLD = CONFIG_AXIS_THRESHOLD;

/**
 * 象限 → 可處理的工程師水平
 *
 * 四象限定義（difficulty 高低 × priority 高低）：
 *
 *             │  低 priority  │  高 priority
 *   ──────────┼───────────────┼──────────────
 *   高difficulty│  Q2 排程深修  │  Q1 立刻救火
 *   低difficulty│  Q4 日常練手  │  Q3 快速處理
 *
 * 工程師職級代號對照（試算表 C 欄填代號，D 欄填中文稱呼供人讀）：
 *   L1 = 資淺
 *   L2 = 中階
 *   L3 = 中高階
 *   L4 = 資深
 *   L5 = TL
 *
 * 程式只比對 C 欄的代號（L1～L5），D 欄稱呼不參與運算。
 * Ocean（工程主管）不在派工名單內，他是決策者，不參與輪替。
 */
const QUADRANT_LEVEL = CONFIG_QUADRANT_LEVEL;

/**
 * Google Drive 根資料夾 ID
 *
 * 「線上問題」資料夾的 ID，從 URL 取得：
 * https://drive.google.com/drive/folders/【這段就是ID】
 *
 * 資料夾結構：
 *   線上問題/          ← 這個資料夾的 ID 填在指令碼屬性 DRIVE_ROOT_FOLDER_ID
 *     2026/
 *       2026_線上問題  ← 試算表（檔名必須包含「線上問題」）
 *     2027/
 *       2027_線上問題
 *
 * 程式會依當下日期自動找對應年份資料夾與試算表，不需要寫死 ID。
 */
const SPREADSHEET_FILENAME_KEYWORD = CONFIG_SPREADSHEET_FILENAME_KEYWORD;

/**
 * Teams @tag 白名單
 *
 * 只有訊息中包含這些 tag 才會觸發處理。
 * 其他頻道的訊息即使打到本 webhook 也會被忽略（回傳 skip）。
 */
const ALLOWED_TAGS = CONFIG_ALLOWED_TAGS;

/**
 * AI 分析 System Prompt（Skill）
 *
 * 這段 prompt 決定 AI 如何評分，是整個量化邏輯的核心。
 * 如果評分結果不準，優先從這裡的「評分指標」說明下手調整，
 * 而不是去改 WEIGHTS 或 AXIS_THRESHOLD。
 *
 * 五個指標說明：
 *   repro         — 重現難度：能不能穩定讓 bug 出現
 *   fixComplexity — 修復複雜度：要動多少程式碼、跨多少模組
 *   risk          — 修復風險：改了以後有沒有機會引發其他問題
 *   impact        — 影響範圍：這個 bug 影響多少用戶或系統範圍
 *   urgency       — 業務緊急度：業務方的緊迫程度
 */
const AI_SKILL_PROMPT = `你是一位資深軟體工程師，專門分析 Jira 線上問題單，並輸出結構化的難度量化評分，供自動派工系統使用。

# 任務
分析問題單後，針對下列指標各給 1～3 分（1=低, 2=中, 3=高），並判斷前後端歸屬。

# 評分指標
- repro（重現難度）：1=隨手可重現 / 2=需特定流程 / 3=隨機或環境依賴
- fixComplexity（修復複雜度）：1=少量代碼 / 2=跨多文件 / 3=涉及核心邏輯或架構
- risk（修復風險）：1=幾乎無副作用 / 2=可能影響鄰近模組 / 3=可能引入連鎖問題
- impact（影響範圍）：1=單模組少數用戶 / 2=多模組 / 3=整體系統或多數用戶
- urgency（業務緊急度）：1=可延後 / 2=需較快處理 / 3=須立即修復

# 前後端歸屬（domain）
- "frontend"  ：UI 顯示、互動、瀏覽器相容性、前端效能
- "backend"   ：API、資料、伺服器邏輯、DB
- "fullstack" ：明顯橫跨前後端
- "unknown"   ：資訊不足無法判斷

# 信心度（confidence）
- 對你判斷的整體把握：1=資訊嚴重不足靠猜 / 2=部分推測 / 3=資訊充足

# 輸出格式（嚴格遵守）
只輸出 JSON，不要任何前言、說明、Markdown 標記、程式碼圍欄。
JSON 結構如下：

{
  "summary": "問題摘要，50字內",
  "category": "UI顯示問題 | API資料錯誤 | 使用者操作問題 | 瀏覽器相容性 | 效能問題 | 非軟體問題 | 不明確",
  "domain": "frontend | backend | fullstack | unknown",
  "scores": {
    "repro": 1,
    "fixComplexity": 1,
    "risk": 1,
    "impact": 1,
    "urgency": 1
  },
  "confidence": 1,
  "missingInfo": ["缺少的資訊，最多5點，無則空陣列"],
  "suggestedQuestions": ["可回覆開單者的問題，最多5題，無則空陣列"],
  "reasoning": "一句話說明評分理由，30字內"
}

# 規則
- 資訊不足時，分數傾向保守（不要因為看不懂就全給 3），並在 missingInfo 說明，同時降低 confidence。
- domain 只能從上述四個值擇一。
- 嚴禁輸出 JSON 以外的任何內容。`;

// ============================================================
// 主入口
// ============================================================

/**
 * HTTP POST 入口
 * Power Automate / webhook 觸發器打進來的請求都從這裡進
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    // ── Step 1：Token 驗證 ──────────────────────────────────
    // 確保只有持有正確 token 的呼叫端才能觸發，防止任意 POST
    const token = PropertiesService.getScriptProperties().getProperty("WEBHOOK_TOKEN");
    if (!token || body.token !== token) {
      return jsonResponse_({ status: "error", reason: "unauthorized" });
    }

    const messageContent = body.messageContent || "";

    // ── Step 2：確認訊息有 @tag 在白名單內 ──────────────────
    // Teams 訊息的 @mention 會包成 <at>tag名稱</at>，用 regex 全部抓出來比對
    const tags = [...messageContent.matchAll(/<at[^>]*>(.*?)<\/at>/g)].map((m) => m[1]);
    const hasAllowedTag = tags.some((tag) => ALLOWED_TAGS.includes(tag));
    if (!hasAllowedTag) {
      return jsonResponse_({ status: "skip", reason: "no matching tag" });
    }

    // ── Step 3：從訊息內容抓 Jira 單號 ──────────────────────
    // 格式：https://yourcompany.atlassian.net/browse/VIPOP-1234
    const jiraMatch = messageContent.match(
      /https:\/\/[^"'\s<>]*atlassian\.net\/browse\/([A-Z]+-\d+)/
    );
    if (!jiraMatch) {
      return jsonResponse_({ status: "skip", reason: "no jira issue found" });
    }

    const jiraUrl  = jiraMatch[0]; // 完整 URL（存入試算表 D 欄）
    const issueKey = jiraMatch[1]; // 單號，例如 VIPOP-1234（送 Jira API 用）

    // ── 找當年度試算表（DriveApp 爬資料夾，不寫死 ID）────────
    const ss = getSpreadsheet_();

    // 確保「線上問題」工作表有表頭（第一次使用時自動建立）
    const issueSheet = ensureIssueSheet_(ss);

    // 整理訊息 metadata
    const now       = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy/MM/dd HH:mm:ss");
    const sender    = body.sender     || "";
    const sentAt    = body.sentAt     || "";
    const messageUrl = body.messageUrl || "";
    const messageId  = body.messageId  || "";
    const teamId     = body.teamId     || "";
    const channelId  = body.channelId  || "";

    // 把 HTML tag 清掉，存純文字到試算表
    const plainText = messageContent
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();

    // ── Step 4：AI 分析 Jira 單 ──────────────────────────────
    // 呼叫 Jira API 取標題/描述/圖片 → 送 OpenAI → 拿回評分 JSON → 計算象限
    const aiResult = analyzeJiraIssue_(issueKey);

    // ── Step 5：依象限 + domain 挑派工人員 ────────────────────
    // allowedLevels 來自 QUADRANT_LEVEL，例如 Q1 → ["L5","L4"]
    // domain 來自 AI 判斷，例如 "frontend"
    const assignee = getAndUpdateAssignee_(ss, aiResult.quadrant.levels, aiResult.domain);

    // ── Step 6：整理人讀版摘要，寫入試算表 ───────────────────
    const analysisSummary = formatAnalysisSummary_(aiResult);

    issueSheet.appendRow([
      now,                          // A  收到時間
      sender,                       // B  發訊人
      sentAt,                       // C  訊息時間
      jiraUrl,                      // D  Jira 連結
      plainText,                    // E  訊息內容（純文字）
      messageUrl,                   // F  Teams 訊息連結
      assignee.name,                // G  負責人（本次派到的工程師）
      analysisSummary,              // H  AI 分析（人讀格式，含所有評分）
      "",                           // I  Teams 回覆備註（人工填寫）
      teamId,                       // J  Teams team ID（供後續回覆用）
      channelId,                    // K  Teams channel ID
      messageId,                    // L  Teams message ID
      aiResult.quadrant.quadrant,   // M  象限（Q1/Q2/Q3/Q4）
      aiResult.quadrant.difficulty, // N  難度軸分數（1.0～3.0，越高越難）
      aiResult.quadrant.priority,   // O  急迫軸分數（1.0～3.0，越高越急）
      aiResult.domain,              // P  前後端歸屬（frontend/backend/fullstack/unknown）
      aiResult.confidence,          // Q  AI 信心度（1=靠猜 / 2=部分推測 / 3=充足）
      aiResult.category,            // R  問題類型（UI顯示/API資料錯誤 等）
    ]);

    // 回傳給呼叫端（Power Automate 可以用這個結果發通知）
    return jsonResponse_({
      status: "ok",
      assignee:      assignee.name,
      assigneeEmail: assignee.email,
      quadrant:      aiResult.quadrant.quadrant,
      domain:        aiResult.domain,
      difficulty:    aiResult.quadrant.difficulty,
      priority:      aiResult.quadrant.priority,
      summary:       aiResult.summary,
    });

  } catch (err) {
    return jsonResponse_({ status: "error", message: err.message });
  }
}

// ============================================================
// 試算表定位（DriveApp 爬資料夾）
// ============================================================

/**
 * 依當下年份，從 Google Drive 資料夾結構找到正確的試算表
 *
 * 驗證規則（兩層）：
 *   1. 子資料夾名稱 === 當年年份字串（例如 "2026"）
 *   2. 試算表檔名包含 SPREADSHEET_FILENAME_KEYWORD（"線上問題"）
 *
 * 指令碼屬性 DRIVE_ROOT_FOLDER_ID 需設定為「線上問題」資料夾的 ID。
 *
 * @return {GoogleAppsScript.Spreadsheet.Spreadsheet}
 * @throws {Error} 找不到資料夾或試算表時拋出錯誤
 */
function getSpreadsheet_() {
  const props      = PropertiesService.getScriptProperties();
  const rootId     = CONFIG_DRIVE_ROOT_FOLDER_ID;
  if (!rootId) throw new Error("指令碼屬性 DRIVE_ROOT_FOLDER_ID 未設定");

  const year       = new Date().getFullYear().toString(); // 例如 "2026"
  const rootFolder = DriveApp.getFolderById(rootId);

  // ── 第一層驗證：找名稱等於當年年份的子資料夾 ────────────
  const yearFolders = rootFolder.getFoldersByName(year);
  if (!yearFolders.hasNext()) {
    throw new Error(`找不到年份資料夾：${year}（請在「線上問題」底下建立 "${year}" 資料夾）`);
  }
  const yearFolder = yearFolders.next();

  // ── 第二層驗證：找檔名包含「線上問題」的試算表 ──────────
  const files = yearFolder.getFilesByType(MimeType.GOOGLE_SHEETS);
  while (files.hasNext()) {
    const file = files.next();
    if (file.getName().includes(SPREADSHEET_FILENAME_KEYWORD)) {
      return SpreadsheetApp.openById(file.getId());
    }
  }

  throw new Error(`在 ${year} 資料夾中找不到包含「${SPREADSHEET_FILENAME_KEYWORD}」的試算表`);
}

// ============================================================
// 工作表管理
// ============================================================

/**
 * 確保「線上問題」工作表存在且有表頭
 *
 * 只有在工作表完全空白（getLastRow() === 0）時才補表頭，
 * 避免覆蓋既有資料。
 */
function ensureIssueSheet_(ss) {
  const sheet = ss.getSheetByName("線上問題");
  if (!sheet) throw new Error("找不到「線上問題」工作表");

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "收到時間", "發訊人", "訊息時間", "Jira 連結", "訊息內容",
      "Teams 連結", "負責人", "AI 分析", "Teams 回覆備註",
      "teamId", "channelId", "messageId",
      "象限", "難度分", "急迫分", "Domain", "AI信心度", "問題類型",
    ]);
  }
  return sheet;
}

// ============================================================
// 派工邏輯
// ============================================================

/**
 * 從「線上問題值星」工作表挑出最適合的工程師
 *
 * 挑選流程：
 *   1. 讀取值星表所有工程師（姓名/Email/水平/領域）
 *   2. 統計「線上問題」G 欄各人已分配的 bug 數量
 *   3. 依「象限水平」+ 「domain 相容性」篩選候選人
 *      - 若沒有符合 domain 的人 → 退到只用水平篩
 *      - 若還是沒人 → 全員都可以接（兜底，避免派工失敗）
 *   4. 在候選人中取分配數最少者；平手時隨機選一個
 *
 * 【試算表「線上問題值星」欄位規格（第 2 列起，第 1 列為表頭）】
 *   A 欄：姓名         例如  Agnes
 *   B 欄：Email        例如  agnes@104.com.tw
 *   C 欄：水平代號     填入  L1 / L2 / L3 / L4 / L5          （須與 QUADRANT_LEVEL 一致）
 *   D 欄：水平稱呼     填入  資淺 / 中階 / 中高階 / 資深 / TL  （人讀用，程式不讀此欄）
 *   D 欄：領域         填入  frontend / backend / fullstack
 *
 * ※ Ocean（工程主管）不放進這張表，他不參與自動派工輪替。
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string[]} allowedLevels 象限對應的可用水平，例如 ["TL","資深"]
 * @param {string}   domain        AI 判斷的 domain，例如 "frontend"
 * @return {{ name: string, email: string }}
 */
function getAndUpdateAssignee_(ss, allowedLevels, domain) {
  const rosterSheet = ss.getSheetByName("線上問題值星");
  if (!rosterSheet) throw new Error("找不到「線上問題值星」工作表");

  const lastRow = rosterSheet.getLastRow();
  if (lastRow < 2) throw new Error("「線上問題值星」沒有工程師資料");

  // 讀全部工程師資料：[name, email, level, levelName, memberDomain, countif, onDuty]
  // G 欄（index 6）= 值星中，只有 "Y" 才納入候選
  const roster = rosterSheet
    .getRange(2, 1, lastRow - 1, 7)
    .getValues()
    .filter((row) => row[0] && row[6] === "Y"); // 過濾空列 + 只取值星中的人

  // 統計「線上問題」G 欄（負責人欄）各人的分配數
  // → 用來讓工作量平均分配，不讓同一個人一直接單
  const issueSheet = ss.getSheetByName("線上問題");
  const countMap = {};
  roster.forEach((row) => { countMap[row[0]] = 0; });

  if (issueSheet && issueSheet.getLastRow() > 1) {
    issueSheet
      .getRange(2, 7, issueSheet.getLastRow() - 1, 1)
      .getValues()
      .flat()
      .forEach((name) => {
        if (name && countMap[name] !== undefined) countMap[name]++;
      });
  }

  // 篩選候選人：水平符合 AND domain 相容
  //
  // domain 相容規則：
  //   AI 判斷 "frontend"  → 只找 frontend 或 fullstack 的工程師
  //   AI 判斷 "backend"   → 只找 backend  或 fullstack 的工程師
  //   AI 判斷 "fullstack" 或 "unknown" → 不限 domain，全員皆可
  let candidates = roster.filter((row) => {
    const memberLevel  = row[2]; // C 欄：水平代號（L1～L5）
    const memberDomain = row[4]; // E 欄：領域（frontend/backend/fullstack）

    const levelOk = allowedLevels.includes(memberLevel);

    let domainOk = true; // 預設不限
    if (domain === "frontend") {
      domainOk = memberDomain === "frontend" || memberDomain === "fullstack";
    } else if (domain === "backend") {
      domainOk = memberDomain === "backend"  || memberDomain === "fullstack";
    }

    return levelOk && domainOk;
  });

  // 兜底 1：domain 篩完沒人 → 只用水平篩（可能是 domain 填得不齊全）
  if (candidates.length === 0) {
    candidates = roster.filter((row) => allowedLevels.includes(row[2]));
  }

  // 兜底 2：還是沒人 → 全體都可以接，避免派工失敗丟 exception
  if (candidates.length === 0) {
    candidates = roster;
  }

  // 在候選人中挑分配數最少者；若有多人並列則隨機選一個
  const minCount     = Math.min(...candidates.map((row) => countMap[row[0]] || 0));
  const minCandidates = candidates.filter((row) => (countMap[row[0]] || 0) === minCount);
  const picked       = minCandidates[Math.floor(Math.random() * minCandidates.length)];

  return { name: picked[0], email: picked[1] };
}

// ============================================================
// AI 分析與象限計算
// ============================================================

/**
 * 呼叫 Jira API 取得問題單內容，再送 OpenAI 分析，回傳結構化結果
 *
 * 流程：
 *   Jira API → 取 summary / description / 圖片附件
 *   → 組 OpenAI messages（system = AI_SKILL_PROMPT）
 *   → 解析回傳 JSON
 *   → calcQuadrant_() 算象限
 *
 * @param  {string} issueKey Jira 單號，例如 VIPOP-1234
 * @return {{
 *   summary:           string,    // 問題摘要（50字內）
 *   category:          string,    // 問題類型分類
 *   domain:            string,    // frontend / backend / fullstack / unknown
 *   scores: {
 *     repro:          number,    // 重現難度（1～3）
 *     fixComplexity:  number,    // 修復複雜度（1～3）
 *     risk:           number,    // 修復風險（1～3）
 *     impact:         number,    // 影響範圍（1～3）
 *     urgency:        number,    // 業務緊急度（1～3）
 *   },
 *   confidence:        number,    // AI 信心度（1～3）
 *   missingInfo:       string[],  // 缺少的資訊
 *   suggestedQuestions:string[],  // 建議回問開單者的問題
 *   reasoning:         string,    // 評分理由（30字內）
 *   quadrant: {
 *     difficulty: number,         // X 軸分數（難度加權分）
 *     priority:   number,         // Y 軸分數（急迫加權分）
 *     quadrant:   string,         // Q1 / Q2 / Q3 / Q4
 *     levels:     string[],       // 該象限對應可接單的工程師水平
 *   }
 * }}
 */
function analyzeJiraIssue_(issueKey) {
  const props     = PropertiesService.getScriptProperties();
  const jiraBase  = props.getProperty("JIRA_URL");
  const authHeader = "Basic " + Utilities.base64Encode(
    props.getProperty("JIRA_EMAIL") + ":" + props.getProperty("JIRA_TOKEN")
  );

  // ── 取 Jira 單詳細資訊 ────────────────────────────────────
  const issueRes = UrlFetchApp.fetch(
    `${jiraBase}/rest/api/3/issue/${issueKey}?fields=summary,description,attachment`,
    {
      headers: { Authorization: authHeader, Accept: "application/json" },
      muteHttpExceptions: true,
    }
  );
  const issue       = JSON.parse(issueRes.getContentText());
  const summary     = issue.fields?.summary || "";
  const description = extractAdfText_(issue.fields?.description); // ADF → 純文字
  const attachments = issue.fields?.attachment || [];

  // ── 下載圖片附件（最多 3 張，送給 AI 一起分析）────────────
  // Jira 附件通常是截圖，能讓 AI 更準確判斷問題類型
  const imageContents = [];
  for (const att of attachments) {
    if (!att.mimeType?.startsWith("image/")) continue; // 只取圖片
    if (imageContents.length >= CONFIG_MAX_IMAGES) break; // 最多張數從 config 讀取
    try {
      const blob   = UrlFetchApp.fetch(att.content, {
        headers: { Authorization: authHeader },
        muteHttpExceptions: true,
      }).getBlob();
      const base64 = Utilities.base64Encode(blob.getBytes());
      imageContents.push({ mimeType: att.mimeType, base64, filename: att.filename });
    } catch (_) {
      // 單張圖片下載失敗不中止整個流程，直接跳過
    }
  }

  // ── 組 OpenAI messages ───────────────────────────────────
  const messages = [
    {
      role: "system",
      content: AI_SKILL_PROMPT, // 評分規則 + 輸出格式都在這裡
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `請分析以下 Jira 問題單：\n\n標題：${summary}\n\n描述：${description}`,
        },
        // 圖片以 base64 data URL 傳入（gpt-4o-mini 支援 vision）
        ...imageContents.map((img) => ({
          type: "image_url",
          image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
        })),
      ],
    },
  ];

  // ── 呼叫 OpenAI API ──────────────────────────────────────
  const openaiRes = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${props.getProperty("OPENAI_API_KEY")}`,
    },
    payload: JSON.stringify({
      model: CONFIG_OPENAI_MODEL,
      messages,
      max_tokens: CONFIG_OPENAI_MAX_TOKENS,
      response_format: { type: "json_object" },    // 強制 JSON 輸出，減少 parse 失敗機率
    }),
    muteHttpExceptions: true,
  });

  const openaiData = JSON.parse(openaiRes.getContentText());
  const rawContent = openaiData.choices?.[0]?.message?.content || "{}";

  // parseAiJson_ 有防護機制，即使 AI 偶爾包了 markdown 也能處理
  const aiJson  = parseAiJson_(rawContent);

  // ── 由程式算象限（不交給 AI 決定，確保穩定可控）────────────
  const quadrant = calcQuadrant_(aiJson.scores || {});

  return {
    summary:            aiJson.summary            || "",
    category:           aiJson.category           || "不明確",
    domain:             aiJson.domain             || "unknown",
    scores:             aiJson.scores             || {},
    confidence:         aiJson.confidence         || 1,
    missingInfo:        aiJson.missingInfo        || [],
    suggestedQuestions: aiJson.suggestedQuestions || [],
    reasoning:          aiJson.reasoning          || "",
    quadrant,
  };
}

// ============================================================
// 象限計算
// ============================================================

/**
 * 根據 AI 五項評分計算兩軸分數，再對應到象限
 *
 * 計算方式：
 *   difficulty = repro×0.2 + fixComplexity×0.5 + risk×0.3   （X 軸，技術難度）
 *   priority   = impact×0.6 + urgency×0.4                    （Y 軸，業務急迫）
 *
 *   兩軸各自 >= AXIS_THRESHOLD → 視為「高」
 *
 * 象限對應：
 *   高難度 + 高急迫 → Q1（救火）
 *   高難度 + 低急迫 → Q2（排程深修）
 *   低難度 + 高急迫 → Q3（快速處理）
 *   低難度 + 低急迫 → Q4（日常練手）
 *
 * @param  {Object} scores AI 回傳的 scores 物件
 * @return {{ difficulty: number, priority: number, quadrant: string, levels: string[] }}
 */
function calcQuadrant_(scores) {
  const difficulty = weightedScore_(scores, WEIGHTS.difficulty);
  const priority   = weightedScore_(scores, WEIGHTS.priority);

  const isHard   = difficulty >= AXIS_THRESHOLD;
  const isUrgent = priority   >= AXIS_THRESHOLD;

  let quadrant;
  if      ( isHard &&  isUrgent) quadrant = "Q1"; // 高難度 + 高急迫
  else if ( isHard && !isUrgent) quadrant = "Q2"; // 高難度 + 低急迫
  else if (!isHard &&  isUrgent) quadrant = "Q3"; // 低難度 + 高急迫
  else                           quadrant = "Q4"; // 低難度 + 低急迫

  return {
    difficulty: Math.round(difficulty * 100) / 100, // 保留兩位小數，方便存入試算表
    priority:   Math.round(priority   * 100) / 100,
    quadrant,
    levels: QUADRANT_LEVEL[quadrant], // 該象限可接單的工程師水平陣列
  };
}

/**
 * 加權分計算
 *
 * 範例：
 *   scores    = { repro: 2, fixComplexity: 3, risk: 1 }
 *   weightMap = { repro: 0.2, fixComplexity: 0.5, risk: 0.3 }
 *   結果      = 2×0.2 + 3×0.5 + 1×0.3 = 0.4 + 1.5 + 0.3 = 2.2
 *
 * @param  {Object} scores     各指標分數
 * @param  {Object} weightMap  各指標對應權重
 * @return {number}
 */
function weightedScore_(scores, weightMap) {
  return Object.keys(weightMap).reduce(
    (sum, key) => sum + (scores[key] || 0) * weightMap[key],
    0
  );
}

// ============================================================
// 工具函式
// ============================================================

/**
 * 解析 AI 回傳的 JSON，容錯處理
 *
 * 雖然已加 response_format: json_object，AI 偶爾仍會多包 markdown 圍欄。
 * 先 strip 掉 ```json ... ``` 再 parse；
 * 若還是失敗，嘗試抓第一個 { 到最後一個 } 的子字串再 parse。
 *
 * @param  {string} rawContent OpenAI 回傳的原始字串
 * @return {Object}
 */
function parseAiJson_(rawContent) {
  const cleaned = rawContent
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // 退而求其次：抓 { ... } 範圍
    const start = cleaned.indexOf("{");
    const end   = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("AI 回傳非合法 JSON：" + rawContent.slice(0, 200));
  }
}

/**
 * 整理給人讀的 AI 分析摘要（存入試算表 H 欄）
 *
 * 把 AI 回傳的各項資訊排版成好讀的多行文字，
 * 讓看試算表的人不需要懂 JSON 也能快速掌握分析結果。
 *
 * @param  {Object} aiResult analyzeJiraIssue_() 的回傳值
 * @return {string}
 */
function formatAnalysisSummary_(aiResult) {
  const {
    summary, category, domain, scores,
    confidence, reasoning, missingInfo,
    suggestedQuestions, quadrant,
  } = aiResult;

  // 把五個指標分數拼成一行，方便掃視
  const scoreStr = scores
    ? `重現:${scores.repro} 複雜:${scores.fixComplexity} 風險:${scores.risk} 影響:${scores.impact} 急迫:${scores.urgency}`
    : "（無評分）";

  const missing   = missingInfo?.length        ? missingInfo.join(" / ")        : "（無）";
  const questions = suggestedQuestions?.length ? suggestedQuestions.join(" / ") : "（無）";

  return [
    `【摘要】${summary}`,
    `【類型】${category}　【Domain】${domain}　【信心度】${confidence}/3`,
    `【象限】${quadrant.quadrant}（難度:${quadrant.difficulty} 急迫:${quadrant.priority}）`,
    `【評分】${scoreStr}`,
    `【評分理由】${reasoning}`,
    `【缺少資訊】${missing}`,
    `【建議詢問】${questions}`,
  ].join("\n");
}

/**
 * 從 Atlassian Document Format（ADF）遞迴提取純文字
 *
 * Jira Cloud 的 description 欄位是 ADF 巢狀 JSON，不是純文字。
 * 這個函式遞迴走訪所有節點，把 type=text 的葉節點文字串接起來。
 *
 * @param  {Object} node ADF 節點（或 undefined）
 * @return {string}
 */
function extractAdfText_(node) {
  if (!node) return "";
  if (node.type === "text") return node.text || "";          // 葉節點：直接取文字
  if (node.content) return node.content.map(extractAdfText_).join(""); // 非葉節點：遞迴子節點
  return "";
}

/**
 * 統一 JSON 回應格式
 *
 * 所有 doPost 的 return 都透過這個函式，確保 Content-Type 一致。
 *
 * @param  {Object} payload 要回傳的物件
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}