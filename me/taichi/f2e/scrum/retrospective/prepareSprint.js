/**
 * ============================================================
 * prepareSprint.gs - Sprint 回顧準備:執行入口
 * ============================================================
 * 唯一執行函式:prepareSprint(e)
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
function prepareSprint(e) {
  try {
    const isScheduled = !!(e && e.triggerUid);
    let result = null;

    // 排程觸發 → 判斷該不該執行
    if (isScheduled && !_shouldRunToday()) {
      Logger.log('⏸️ 本週不執行(尚未到下一個 Sprint 預定開始日)');
    } else {
      // 1. 建立 Sprint
      result = new SprintService(SPRINT_OPTIONS).create();
      Logger.log('📦 SprintService 回傳:' + JSON.stringify(result));

      if (!result || !result.sprintName) {
        throw new Error('SprintService.create() 回傳結果不正確,請檢查 SprintService.gs');
      }

      // 2. 發送 Chat 通知「已建立」
      new ReminderNotifier().notifyCreated(result);

      // 3. 排定發布觸發器(時間細節由 TriggerManager 決定)
      new TriggerManager().schedulePublish(result.endDate);
    }

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
  const latest = findLatestSprintFolder(drive, SPRINT_OPTIONS.sprintRootFolderId);
  const latestEndDate = latest.endDate;

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
  prepareSprint({ triggerUid: 'test-trigger' });
}


function testValidate() {
  new SprintService(SPRINT_OPTIONS).validate();
}
