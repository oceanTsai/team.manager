# bug-triage — B Team 線上問題助理

> 部署形式：**Web App**（`doPost` 入口）
> 不依賴本專案的其他 Library（設定與邏輯都在自己的檔案裡）

Teams 頻道有人 @tag 並貼上 Jira 連結時，自動用 AI 分析問題單的難度與急迫度，算出象限，再依象限與前後端領域挑一位工程師派工，最後把結果寫進 Google 試算表。

## 流程

```
Teams 訊息 @掛單水流_前端 + Jira 連結
        │
        ▼  Power Automate（或任何 webhook 觸發器）
   doPost(e)
        │
        ├─ 1. token 驗證 ────────────── 不符 → { status: "error", reason: "unauthorized" }
        ├─ 2. 比對 @tag 白名單 ───────── 不符 → { status: "skip", reason: "no matching tag" }
        ├─ 3. 抓 Jira 單號（regex）───── 沒有 → { status: "skip", reason: "no jira issue found" }
        ├─ 4. getSpreadsheet_()          依當年年份爬 Drive 找到試算表
        ├─ 5. analyzeJiraIssue_()        Jira API 取標題/描述/截圖 → OpenAI 評分
        ├─ 6. calcQuadrant_()            五項評分加權 → 兩軸分數 → Q1~Q4
        ├─ 7. getAndUpdateAssignee_()    依象限水平 + domain 從值星表挑人
        └─ 8. appendRow()                寫入「線上問題」工作表 → 回傳 JSON
```

## 檔案

| 檔案 | 功能 |
|---|---|
| `config.js` | 集中設定檔（Drive ID、白名單、加權、OpenAI 參數） |
| `BugTriageAssignment.js` | 主程式（webhook 入口、AI 分析、象限計算、派工、寫入） |
| `ScheduleTask.js` | 排程：每年 1/1 從樣板複製出當年度試算表 |
| `Test.js` | 測試函式：`testDoPost`、`testCopyTemplateForNewYear` |

## 指令碼屬性

| 屬性名 | 說明 |
|---|---|
| `WEBHOOK_TOKEN` | 驗證來源用的 token，防止任意 POST |
| `JIRA_EMAIL` | Jira 帳號 email |
| `JIRA_TOKEN` | Jira API token（不是密碼） |
| `JIRA_URL` | Jira 站台 URL，例如 `https://104corp.atlassian.net` |
| `OPENAI_API_KEY` | OpenAI API 金鑰 |

## 設定常數（在 `BugTriageAssignment.js` 檔案開頭）

| 常數 | 預設值 | 說明 |
|---|---|---|
| `CONFIG_DRIVE_ROOT_FOLDER_ID` | `19LoNnay...` | 「線上問題」根資料夾 ID |
| `CONFIG_SPREADSHEET_FILENAME_KEYWORD` | `線上問題` | 在年份資料夾裡用這個關鍵字找試算表 |
| `CONFIG_ALLOWED_TAGS` | `["掛單水流_前端", "掛單水流_All"]` | Teams @tag 白名單 |
| `CONFIG_WEIGHTS` | 見下 | 兩軸的加權設定 |
| `CONFIG_AXIS_THRESHOLD` | `2` | 軸分 ≥ 此值視為「高」 |
| `CONFIG_QUADRANT_LEVEL` | 見下 | 各象限可接單的工程師水平 |
| `CONFIG_OPENAI_MODEL` | `gpt-4o-mini` | 分析品質不夠可換 `gpt-4o` |
| `CONFIG_OPENAI_MAX_TOKENS` | `800` | 評分 JSON 約 300–500 token |
| `CONFIG_MAX_IMAGES` | `3` | 最多下載幾張 Jira 截圖給 AI 看 |

## 量化派工邏輯

AI 對五個指標各給 1–3 分，程式再加權成兩軸（**象限由程式算，不交給 AI 決定**，確保穩定可控）：

```
difficulty（X 軸．技術難度）= fixComplexity×0.5 + risk×0.3 + repro×0.2
priority  （Y 軸．業務急迫）= impact×0.6 + urgency×0.4
```

兩軸各自 ≥ `CONFIG_AXIS_THRESHOLD`（預設 2.0）就算「高」：

|  | 低急迫 | 高急迫 |
|---|---|---|
| **高難度** | **Q2** 排程深修 → L5/L4/L3 | **Q1** 立刻救火 → L5/L4 |
| **低難度** | **Q4** 日常練手 → L2/L1 | **Q3** 快速處理 → L3/L2/L1 |

職級代號：`L1` 資淺、`L2` 中階、`L3` 中高階、`L4` 資深、`L5` TL。

> 覺得 Q1/Q2 太多 → 把 `CONFIG_AXIS_THRESHOLD` 調高（例如 2.3）；太少 → 調低（例如 1.8）。
> 覺得**評分本身不準**，優先改 `AI_SKILL_PROMPT` 裡的評分指標描述，而不是動權重或門檻。

## 挑人規則

1. 從「線上問題值星」讀出所有 **G 欄 = `Y`**（值星中）的工程師。
2. 統計「線上問題」G 欄各人已分配的筆數。
3. 篩選：**水平符合象限** AND **domain 相容**
   - AI 判 `frontend` → 只找 frontend / fullstack
   - AI 判 `backend` → 只找 backend / fullstack
   - AI 判 `fullstack` / `unknown` → 不限
4. 兜底：domain 篩完沒人 → 只用水平篩；還是沒人 → 全員都可接（避免派工失敗）。
5. 在候選人中取**已分配數最少者**；平手隨機挑一個。

## 試算表規格

Drive 結構（`CONFIG_DRIVE_ROOT_FOLDER_ID` 指向「線上問題」）：

```
線上問題/
  template/
    線上問題樣板        ← 檔名需含「樣板」，給年度排程複製用
  2026/
    2026_線上問題       ← 檔名需含「線上問題」，且必須是 Google Sheet 格式
  2027/
    2027_線上問題
```

### 工作表「線上問題」（自動建立表頭）

| 欄 | 內容 | 欄 | 內容 |
|---|---|---|---|
| A | 收到時間 | J | teamId |
| B | 發訊人 | K | channelId |
| C | 訊息時間 | L | messageId |
| D | Jira 連結 | M | 象限（Q1–Q4） |
| E | 訊息內容（純文字） | N | 難度分（1.0–3.0） |
| F | Teams 連結 | O | 急迫分（1.0–3.0） |
| G | **負責人**（派工結果，也是統計來源） | P | Domain |
| H | AI 分析（人讀格式多行文字） | Q | AI 信心度（1–3） |
| I | Teams 回覆備註（人工填） | R | 問題類型 |

### 工作表「線上問題值星」（需人工維護，第 2 列起）

| 欄 | 內容 | 範例 |
|---|---|---|
| A | 姓名 | `Agnes Kao 高慈謙` |
| B | Email | `agnes@104.com.tw` |
| C | **水平代號** | `L1`～`L5`（程式只讀這欄） |
| D | 水平稱呼 | `資深`（人讀用，程式不讀） |
| E | 領域 | `frontend` / `backend` / `fullstack` |
| F | （統計欄） | |
| G | **值星中** | 填 `Y` 才會被納入候選 |

> A 欄姓名必須跟寫入「線上問題」G 欄的字串完全一致，統計才對得起來。
> Ocean（工程主管）不放進這張表，不參與自動派工輪替。

## 部署與測試

### 發布 Web App

1. GAS 編輯器右上 **Deploy → Manage deployments**
2. 點鉛筆 → Version 選「New version」→ Deploy
3. Execute as：**Me**；Who has access：Power Automate 需要匿名存取的話選 **Anyone**
4. 複製 URL：`https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec`

> 每次改完程式都要重新發布（選 New version），URL 不會變。
> 目前 `appsscript.json` 的 `webapp.access` 是 `DOMAIN`，若外部服務打不進來需要改成 `ANYONE_ANONYMOUS` 並重新部署。

### 用 curl 測試

```bash
curl -X POST "YOUR_WEB_APP_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_WEBHOOK_TOKEN",
    "sender": "測試人員",
    "sentAt": "2026-01-01T00:00:00.000Z",
    "messageContent": "<at>掛單水流_前端</at> 請協助 https://104corp.atlassian.net/browse/VIPOP-XXXXX",
    "messageUrl": "https://teams.microsoft.com/test",
    "messageId": "test-001",
    "teamId": "test-team",
    "channelId": "test-channel"
  }'
```

成功回傳：

```json
{
  "status": "ok",
  "assignee": "Agnes Kao 高慈謙",
  "assigneeEmail": "agnes@104.com.tw",
  "quadrant": "Q3",
  "domain": "frontend",
  "difficulty": 1.6,
  "priority": 2.2,
  "summary": "..."
}
```

### 在 GAS 裡測試

選 `testDoPost` 執行即可，不需要 Power Automate。⚠️ 測試會**真實**呼叫 Jira / OpenAI 並寫入試算表，測完記得把測試列刪掉。

## 年度排程

`copyTemplateForNewYear()` 會從 `線上問題/template/` 找檔名含「樣板」的試算表，複製成 `線上問題/{年}/{年}_線上問題`。

觸發器設定：GAS 左側時鐘圖示 → 新增觸發條件 → 函式 `copyTemplateForNewYear` → 時間驅動 → 年計時器 → 1 月 → 1 號。

已存在當年資料夾就跳過，不會重複建立。

## 常見錯誤

| 訊息 | 原因 |
|---|---|
| `unauthorized` | `WEBHOOK_TOKEN` 沒設或值不對 |
| `no matching tag` | 訊息裡的 tag 不在 `CONFIG_ALLOWED_TAGS` |
| `no jira issue found` | 訊息裡沒有 `.../browse/XXX-123` 格式的 Jira URL |
| `找不到年份資料夾` | Drive 裡還沒建當年資料夾 |
| `找不到試算表` | 檔名不含「線上問題」，或檔案不是 Google Sheet 格式 |
| `找不到「線上問題值星」` | 工作表名稱打錯或尚未建立 |
