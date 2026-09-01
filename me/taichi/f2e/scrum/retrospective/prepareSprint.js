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
      // 0. 確認上一個 Sprint 流程已走完(不允許兩個 Sprint 並存)
      _assertNoPendingSprint();

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
 * 確認沒有未完成的 Sprint 流程,有的話中止建立
 *
 * 一個 Sprint 從建立到提醒發送完畢的期間,系統裡會有 publishTask 或
 * reminderTask 排程待處理。這段期間若再建立一個新的 Sprint,
 * PublishTask / ReminderTask 會因為是「重新推導最新 Sprint」
 * (一次性觸發器無法攜帶參數,只能現場去 Drive 找結束日最晚的那個)
 * 而處理到新建立的那一個,造成:
 *   - 舊 Sprint 的表單沒發布、團隊沒收到提醒
 *   - 新 Sprint 的表單提早兩週被發布
 *
 * 與其讓程式有能力處理這種混亂狀態,不如直接擋掉 —— 實務上不會有
 * 同時進行兩個 Sprint 回顧的需求。
 *
 * 排程觸發也一樣擋:正常情況下這時不該有待處理排程,若有代表上一輪
 * 出錯留下殘留,這時停下來報錯比繼續把狀況搞亂好。
 *
 * @private
 * @throws {Error} 還有待處理的動態排程時
 */
function _assertNoPendingSprint() {
  const pending = new TriggerManager().listPending();

  if (pending.length > 0) {
    const names = pending.map((t) => t.getHandlerFunction()).join('、');
    throw new Error(
      `上一個 Sprint 流程尚未完成(待處理排程:${names})。\n` +
      '同時進行兩個 Sprint 會讓發布與提醒指向錯誤的 Sprint,因此中止。\n' +
      '請等流程跑完,或確認狀況後清除動態排程再重試。'
    );
  }
}

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
