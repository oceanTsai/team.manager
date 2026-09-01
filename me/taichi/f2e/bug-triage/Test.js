// Test.gs
// B Team 線上問題助理 — 測試函式
//
// 【使用方式】
//   在 GAS 編輯器上方下拉選單選擇要測試的函式，按「執行」
//   結果在下方「執行記錄」查看
//
// 【注意事項】
//   - 測試函式會真實呼叫 Jira API、OpenAI、寫入試算表
//   - 測試完記得去試算表把測試資料列刪掉
//   - testCopyTemplateForNewYear 會真實在 Drive 建立資料夾

// ============================================================
// testDoPost — 測試主流程
// ============================================================
//
// 模擬 Power Automate 打進來的 webhook 請求，測試完整流程：
//   token 驗證 → 找試算表 → Jira API → OpenAI 分析 → 派工 → 寫入試算表
//
// 【測試前確認】
//   1. 指令碼屬性已設定：WEBHOOK_TOKEN / JIRA_EMAIL / JIRA_TOKEN / JIRA_URL / OPENAI_API_KEY
//   2. Drive 線上問題/2026/ 資料夾有 Google Sheet 格式的試算表
//   3. 試算表「線上問題值星」工作表有工程師資料且至少一人值星中 = Y
//
// 【預期成功回傳】
//   {
//     "status": "ok",
//     "assignee": "Agnes Kao 高慈謙",
//     "assigneeEmail": "agnes@104.com.tw",
//     "quadrant": "Q3",
//     "domain": "frontend",
//     "difficulty": 1.6,
//     "priority": 2.2,
//     "summary": "..."
//   }
//
// 【常見錯誤對照】
//   unauthorized          → WEBHOOK_TOKEN 指令碼屬性沒設定或值不對
//   no matching tag       → messageContent 裡的 tag 不在白名單
//   no jira issue found   → messageContent 裡沒有 Jira URL
//   找不到年份資料夾       → Drive 裡沒有 2026 資料夾
//   找不到試算表           → 試算表不是 Google Sheet 格式，或檔名不含「線上問題」
//   找不到「線上問題值星」  → 工作表名稱不對

function testDoPost() {
  const WEBHOOK_TOKEN = PropertiesService.getScriptProperties().getProperty("WEBHOOK_TOKEN");
  const fakeEvent = {
    postData: {
      contents: JSON.stringify({
        token: WEBHOOK_TOKEN,
        sender: "測試人員 Ocean",
        sentAt: new Date().toISOString(),
        messageContent: "<at>掛單水流_前端</at> 請協助 https://104corp.atlassian.net/browse/VIPOP-44844",
        messageUrl: "https://teams.microsoft.com/test",
        messageId: "test-001",
        teamId: "test-team",
        channelId: "test-channel",
      })
    }
  };
  const result = doPost(fakeEvent);
  Logger.log(result.getContent());
}

// ============================================================
// testCopyTemplateForNewYear — 測試年度試算表自動建立
// ============================================================
//
// 實際執行 copyTemplateForNewYear()，測試能否從 template 複製樣板
//
// 【測試前確認】
//   1. Drive 線上問題/template/ 資料夾有 Google Sheet，檔名包含「樣板」
//   2. Drive 線上問題/ 底下「沒有」今年（2026）的資料夾
//      → 若已存在會因防呆跳過，執行記錄會顯示「已存在，跳過」
//
// 【若想強制測試又不想動真實資料】
//   把 ScheduleTask.gs 裡的年份暫時改成假年份測試：
//   const year = "9999";   // 測試用
//   測試完把 Drive 裡的 9999 資料夾刪掉，再改回原本的寫法
//
// 【預期成功結果】
//   執行記錄顯示：已建立：線上問題/2026/2026_線上問題（ID: ...）
//   Drive 線上問題/2026/ 資料夾出現 Google Sheet「2026_線上問題」

function testCopyTemplateForNewYear() {
  copyTemplateForNewYear();
  Logger.log("執行完成，請去 Drive 確認是否產生新資料夾和試算表");
}