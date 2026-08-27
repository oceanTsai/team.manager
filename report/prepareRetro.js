/**
 * ============================================================
 * prepareRetro.gs - Sprint 回顧準備:執行入口
 * ============================================================
 * 唯一執行函式:prepareRetro(e)
 *
 * 📦 本專案依賴外部 Library:
 *   - InfraLib(識別碼:Infra)
 *   - NotifyLib(識別碼:Notify)
 *
 * 🔐 Script Properties:
 *   - RETRO_CHAT_WEBHOOK_URL  Google Chat Webhook URL
 *
 * 🔁 執行邏輯:
 *   - 排程觸發(有 e 參數):程式判斷今天該不該執行
 *   - 手動執行(無 e 參數):永遠執行,不走判斷
 * ============================================================
 */


/* ========== ⚙️ 設定區 ========== */

const SPRINT_OPTIONS = {
  templateFolderId:  '13KzUPSk_wBR73f2feBFbv3qwa2b4NWlP',  // scrum/template 資料夾
  sprintRootFolderId: '16cZbBannmdoUifDlOU7T0VRTp6AH2H6t', // scrum 根資料夾
  sprintDays:         11,
};


/* ========== 🚀 主入口 ========== */

/**
 * 建立下一個 Sprint:資料夾 + 表單 + 投影片,並發送 Chat 通知
 * @param {Object} [e] - Apps Script 觸發器傳入的事件物件
 *                       有值=排程觸發,無值=手動執行
 * @returns {Object|null} 建立結果摘要,或 null(跳過)
 */
function prepareRetro(e) {
  try {
    const isScheduled = !!(e && e.triggerUid);

    // 排程觸發 → 判斷該不該執行
    if (isScheduled && !_shouldRunToday()) {
      Logger.log('⏸️ 本週不執行(尚未到下一個 Sprint 預定開始日)');
      return null;
    }

    // 1. 建立 Sprint
    const result = new RetroSprintService(SPRINT_OPTIONS).create();
    Logger.log('📦 RetroSprintService 回傳:' + JSON.stringify(result));

    if (!result || !result.sprintName) {
      throw new Error('RetroSprintService.create() 回傳結果不正確,請檢查 RetroSprintService.gs');
    }

    // 2. 發送 Chat 通知「已建立」
    new RetroReminderNotifier().notifyCreated(result);

    // 3. 排定發布觸發器(時間細節由 TriggerManager 決定)
    new TriggerManager().schedulePublish(result.endDate);

    return result;
  } catch (error) {
    Logger.log(`❌ 錯誤:${error.message}`);
    throw error;
  }
}


/* ========== 🔍 判斷邏輯 ========== */

/**
 * 判斷今天是否該執行(用於排程觸發時)
 * 規則:今天 >= 最新 Sprint 結束日 + 3 天(下週一)→ 該執行
 * @private
 * @returns {boolean}
 */
function _shouldRunToday() {
  const drive = Infra.createDriveClient();
  const year = new Date().getFullYear();

  // 找當年度資料夾
  const yearFolder = drive.findFolderByName(SPRINT_OPTIONS.sprintRootFolderId, String(year));
  if (!yearFolder) {
    throw new Error(`找不到 ${year} 年度資料夾`);
  }

  const folders = drive.listFolders(yearFolder.getId());
  let latestEndDate = null;

  folders.forEach((folder) => {
    const match = folder.getName().match(/^(\d{2})(\d{2})-(\d{2})(\d{2})$/);
    if (!match) return;

    const [, startM, , endM, endD] = match.map(Number);
    const endDate = new Date(year, endM - 1, endD);
    if (startM > endM) endDate.setFullYear(year + 1);

    if (!latestEndDate || endDate > latestEndDate) {
      latestEndDate = endDate;
    }
  });

  if (!latestEndDate) {
    throw new Error('找不到符合 MMDD-MMDD 格式的 Sprint 資料夾');
  }

  const expectedStart = new Date(latestEndDate);
  expectedStart.setDate(expectedStart.getDate() + 3);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expectedStart.setHours(0, 0, 0, 0);

  Logger.log(`📌 最新 Sprint 結束日:${_formatDate(latestEndDate)}`);
  Logger.log(`📆 預定開始日:${_formatDate(expectedStart)}`);
  Logger.log(`📅 今天:${_formatDate(today)}`);

  return today >= expectedStart;
}


/* ========== 🛠️ 工具 ========== */

/** @private */
function _formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}


/* ========== 🧪 測試函式 ========== */

function testScheduledRun() {
  prepareRetro({ triggerUid: 'test-trigger' });
}


function testValidate() {
  new RetroSprintService(SPRINT_OPTIONS).validate();
}
