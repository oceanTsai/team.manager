// ==========================================================================
// MainTicketCreator.gs - 季度會議單建立 - 執行用主程式
// --------------------------------------------------------------------------
// 真正的邏輯在 QuarterlyTicketCreator class,這份只負責「執行什麼」。
//
// 可執行的函式(會出現在「選擇要執行的函式」下拉選單):
//   getMyAccountId                  → 查看自己的 accountId 與帳號資訊
//   manualCreateQuarterTickets      → 手動建立「現在這一季」的單
//   manualCreateSpecificQuarter     → 手動建立「指定某一季」的單
//                                     ↳ 執行前先改下方 SPECIFIC_QUARTER 常數
//   quarterlyMeetingTicketCreator   → 給排程觸發器用(每月 1 號自動跑)
//
// ⚠️ 需要掛載 Library:
//   - JiraIdentityLib (識別碼設為 JiraIdentityLib)  ← Jira 身份/認證
//   - NotifyEnvLib    (識別碼設為 NotifyEnvLib)     ← 通知管道設定(webhook URL)
//   - Notify          (識別碼設為 Notify)           ← 通知器
// ==========================================================================


// ==========================================================================
// 👇 想開哪一季就改這裡 👇
// --------------------------------------------------------------------------
// 給 manualCreateSpecificQuarter 用,格式:Y{兩位數年份}Q{季度}
// 範例:'Y26Q1'、'Y26Q2'、'Y25Q4'、'Y27Q1'
// ==========================================================================
const SPECIFIC_QUARTER = 'Y26Q1';
// ==========================================================================


// ==========================================================================
// 👇 會議單設定 👇
// ==========================================================================
const QUARTERLY_CONFIG = {
  parentEpic: 'VIPOP-110',
  projectKey: 'VIPOP',
  issueType: 'Task',
  titles: [
    '[日常] F2E- 內部會議',
    '[日常] F2E-Sprint 相關會議'
  ]
};


// ==========================================================================
// 【可執行】查看自己的 accountId 與帳號資訊
// ==========================================================================
function getMyAccountId() {
  const creator = _createInstance();
  const data = creator.fetchMyself();
  Logger.log(`displayName : ${data.displayName}`);
  Logger.log(`emailAddress: ${data.emailAddress}`);
  Logger.log(`accountId   : ${data.accountId}`);
}


// ==========================================================================
// 【可執行 / 排程入口】每月 1 號觸發器使用
// ==========================================================================
function quarterlyMeetingTicketCreator() {
  const creator = _createInstance();
  const now = new Date();

  if (!creator.isQuarterStartMonth()) {
    Logger.log(`[排程模式] 今天是 ${now.getFullYear()}/${now.getMonth() + 1},不是季初月份,跳過`);
    return;
  }
  Logger.log(`[排程模式] 今天是季初 ${now.getFullYear()}/${now.getMonth() + 1}`);

  const quarterTag = creator.getCurrentQuarterTag();
  Logger.log(`========== 開始建立 ${quarterTag} 會議單 ==========`);
  creator.createForQuarter(quarterTag, 'scheduled');
}


// ==========================================================================
// 【可執行 / 手動】建立「現在這一季」的會議單
// ==========================================================================
function manualCreateQuarterTickets() {
  const creator = _createInstance();
  Logger.log(`[手動模式] 不檢查月份,直接建立目前所屬季度的會議單`);

  const quarterTag = creator.getCurrentQuarterTag();
  Logger.log(`========== 開始建立 ${quarterTag} 會議單 ==========`);
  creator.createForQuarter(quarterTag, 'manual');
}


// ==========================================================================
// 【可執行 / 手動】建立「指定某一季」的會議單
// ==========================================================================
function manualCreateSpecificQuarter() {
  const quarterTag = SPECIFIC_QUARTER.trim().toUpperCase();

  if (!/^Y\d{2}Q[1-4]$/.test(quarterTag)) {
    Logger.log(`✗ SPECIFIC_QUARTER 格式錯誤:「${SPECIFIC_QUARTER}」`);
    Logger.log('  正確格式範例:Y26Q1、Y26Q2、Y25Q4');
    return;
  }

  Logger.log(`========== 手動建立指定季度: ${quarterTag} ==========`);
  const creator = _createInstance();
  creator.createForQuarter(quarterTag, 'manual-specific');
}


// ==========================================================================
// 【私有】建立 QuarterlyTicketCreator 實例
// --------------------------------------------------------------------------
// 集中組裝相依物件:
//   - jiraEnv  從 JiraIdentityLib 拿
//   - notifier 從 Notify 用 webhook URL 建立(沒設 webhook 就傳 null)
//   - template 在主專案 new 出來
// ==========================================================================
function _createInstance() {
  const jiraEnv = JiraIdentityLib.jiraIdentityLib();

  const webhookUrl = NotifyEnvLib.notifyEnvLib().getJiraMessageWebhookUrl();
  const notifier = webhookUrl ? Notify.createChatNotifier(webhookUrl) : null;
  const template = webhookUrl ? new TicketCreationTemplate() : null;

  return new QuarterlyTicketCreator({
    jiraEnv: jiraEnv,
    config: QUARTERLY_CONFIG,
    notifier: notifier,
    template: template,
    headers: jiraEnv.getAdminLead().authHeaders  // 用課長(Ocean)的帳號開單
  });
}
