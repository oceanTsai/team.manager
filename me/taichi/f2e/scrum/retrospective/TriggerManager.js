/**
 * ============================================================
 * TriggerManager.gs - Time Trigger 管理工具
 * ============================================================
 * 📦 屬於 SprintProject
 *
 * 職責:
 *   - 計算發布/提醒時間
 *   - 建立 / 刪除 / 列出觸發器
 *
 * 使用方式:
 *   const tm = new TriggerManager();
 *   tm.schedulePublish('2026/05/08');
 *   tm.scheduleReminder('2026/05/08');
 *   tm.cancel();
 *   tm.list();
 * ============================================================
 */


class TriggerManager {

  /* ========== ⚙️ 時間設定 ========== */

  /** Sprint 結束日前幾天發布 */
  static get PUBLISH_DAYS_BEFORE() { return 2; }

  /** 發布時間(小時,24 小時制) */
  static get PUBLISH_HOUR() { return 5; }

  /** Sprint 結束日前幾天提醒 */
  static get REMINDER_DAYS_BEFORE() { return 1; }

  /** 提醒時間(小時,24 小時制) */
  static get REMINDER_HOUR() { return 10; }


  /* ========== 🏷️ 動態排程名單 ========== */

  /**
   * 程式動態建立的一次性排程,對應的 handler 函式名稱。
   *
   * 觸發器物件查不到「這是一次性還是週期性」,只能用函式名稱分辨。
   * 不在這份名單裡的(例如你在 GAS 介面手動設定、每週執行 prepareSprint
   * 的那個固定排程)一律視為固定排程,不會被自動流程清除。
   */
  static get DYNAMIC_HANDLERS() { return ['publishTask', 'reminderTask']; }


  /* ========== 🏭 公開方法 ========== */

  /**
   * 排定發布觸發器
   * 發布時間 = Sprint 結束日 - PUBLISH_DAYS_BEFORE 天,PUBLISH_HOUR 時
   * @param {string} endDateStr - Sprint 結束日,格式 "2026/05/08"
   * @returns {string} 觸發器 ID
   */
  schedulePublish(endDateStr) {
    const publishDate = this._calcDate(
      endDateStr,
      TriggerManager.PUBLISH_DAYS_BEFORE,
      TriggerManager.PUBLISH_HOUR
    );

    const trigger = ScriptApp.newTrigger('publishTask')
      .timeBased()
      .at(publishDate)
      .create();

    Logger.log(`⏰ 發布觸發器已排定:${publishDate.toLocaleString('zh-TW')}`);
    return trigger.getUniqueId();
  }

  /**
   * 排定提醒觸發器
   * 提醒時間 = Sprint 結束日 - REMINDER_DAYS_BEFORE 天,REMINDER_HOUR 時
   * @param {string} endDateStr - Sprint 結束日,格式 "2026/05/08"
   * @returns {string} 觸發器 ID
   */
  scheduleReminder(endDateStr) {
    const reminderDate = this._calcDate(
      endDateStr,
      TriggerManager.REMINDER_DAYS_BEFORE,
      TriggerManager.REMINDER_HOUR
    );

    const trigger = ScriptApp.newTrigger('reminderTask')
      .timeBased()
      .at(reminderDate)
      .create();

    Logger.log(`⏰ 提醒觸發器已排定:${reminderDate.toLocaleString('zh-TW')}`);
    return trigger.getUniqueId();
  }

  /**
   * 取消所有 publishTask 觸發器
   * @returns {number} 刪除的數量
   */
  cancel() {
    const triggers = ScriptApp.getProjectTriggers()
      .filter((t) => t.getHandlerFunction() === 'publishTask');

    triggers.forEach((t) => ScriptApp.deleteTrigger(t));
    Logger.log(`🗑️ 已刪除 ${triggers.length} 個發布觸發器`);
    return triggers.length;
  }

  /**
   * 列出現有 publishTask 觸發器(debug 用)
   * @returns {GoogleAppsScript.Script.Trigger[]}
   */
  list() {
    const triggers = ScriptApp.getProjectTriggers()
      .filter((t) => t.getHandlerFunction() === 'publishTask');

    Logger.log(`📋 共有 ${triggers.length} 個 publishTask 觸發器`);
    triggers.forEach((t, i) => {
      Logger.log(`  ${i + 1}. ID: ${t.getUniqueId()}`);
    });

    return triggers;
  }

  /**
   * 列出所有「待處理的動態排程」(publishTask + reminderTask)
   *
   * 一個 Sprint 從建立到提醒完成的期間,至少會有其中一種排程存在。
   * 回傳空陣列代表上一個 Sprint 流程已經走完。
   *
   * @returns {GoogleAppsScript.Script.Trigger[]}
   */
  listPending() {
    return ScriptApp.getProjectTriggers()
      .filter((t) => TriggerManager.DYNAMIC_HANDLERS.includes(t.getHandlerFunction()));
  }

  /**
   * 依 UID 刪除特定觸發器
   * @param {string} uid
   */
  deleteByUid(uid) {
    const targets = ScriptApp.getProjectTriggers()
      .filter((t) => t.getUniqueId() === uid);

    if (targets.length > 0) {
      ScriptApp.deleteTrigger(targets[0]);
      Logger.log(`🗑️ 已刪除觸發器:${uid}`);
    } else {
      Logger.log(`⚠️ 找不到對應觸發器:${uid}`);
    }
  }


  /* ========== 🔒 私有方法 ========== */

  /**
   * 計算觸發時間
   * @private
   * @param {string} endDateStr - 格式 "2026/05/08"
   * @param {number} daysBefore - 結束日前幾天
   * @param {number} hour - 幾點觸發
   * @returns {Date}
   */
  _calcDate(endDateStr, daysBefore, hour) {
    const parts = endDateStr.split('/').map(Number);
    const endDate = new Date(parts[0], parts[1] - 1, parts[2]);

    const triggerDate = new Date(endDate);
    triggerDate.setDate(triggerDate.getDate() - daysBefore);
    triggerDate.setHours(hour, 0, 0, 0);

    return triggerDate;
  }
}


/* ========== 🏭 工廠函式 ========== */

function createTriggerManager() {
  return new TriggerManager();
}


/* ========== 🎯 全域入口函式 ========== */

function cancelPublish() {
  new TriggerManager().cancel();
}

function listPublishTriggers() {
  new TriggerManager().list();
}

function debugPublishDate() {
  const endDateStr = _getLatestSprintEndDate_();
  const tm = new TriggerManager();
  const date = tm._calcDate(endDateStr, TriggerManager.PUBLISH_DAYS_BEFORE, TriggerManager.PUBLISH_HOUR);
  Logger.log(`最新 Sprint 結束日:${endDateStr}`);
  Logger.log('計算出的發布時間:' + date.toLocaleString('zh-TW'));
}

function debugReminderDate() {
  const endDateStr = _getLatestSprintEndDate_();
  const tm = new TriggerManager();
  const date = tm._calcDate(endDateStr, TriggerManager.REMINDER_DAYS_BEFORE, TriggerManager.REMINDER_HOUR);
  Logger.log(`最新 Sprint 結束日:${endDateStr}`);
  Logger.log('計算出的提醒時間:' + date.toLocaleString('zh-TW'));
}

/**
 * 動態取得最新 Sprint 結束日
 * @private
 * @returns {string} 格式 "2026/07/03"
 */
function _getLatestSprintEndDate_() {
  const drive = Infra.createDriveClient();
  const latest = findLatestSprintFolder(drive, SPRINT_OPTIONS.sprintRootFolderId);
  const endDate = latest.endDate;

  const y = endDate.getFullYear();
  const m = String(endDate.getMonth() + 1).padStart(2, '0');
  const d = String(endDate.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}
