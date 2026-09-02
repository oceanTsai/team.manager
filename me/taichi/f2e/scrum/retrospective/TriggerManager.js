/**
 * ============================================================
 * TriggerManager.gs - 一次性排程的建立、查詢與刪除
 * ============================================================
 * 📦 屬於 retrospective
 *
 * 職責:
 *   只管排程。算時間、建排程、查排程、刪排程。
 *
 * ⚠️ 不做這些事:
 *   不找 Sprint、不發通知、不建資料夾。呼叫端把結束日給它就好。
 *
 * 排程時間規則:
 *   發布 = Sprint 結束日 - 2 天,05:00
 *   提醒 = Sprint 結束日 - 1 天,10:00
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
   * 排程物件查不到「這是一次性還是週期性」,只能用函式名稱分辨。
   * 不在這份名單裡的(例如你在 GAS 介面手動設定、每週執行 prepareRetro
   * 的那個固定排程)一律視為固定排程,不會被清除。
   */
  static get DYNAMIC_HANDLERS() { return ['publishTask', 'reminderTask']; }


  /* ========== ⏱️ 時間計算(不建立任何東西) ========== */

  /**
   * 算出發布的觸發時間
   * @param {string} endDateStr - Sprint 結束日,格式 "2026/05/08"
   * @returns {Date}
   */
  calcPublishDate(endDateStr) {
    return this._calcDate(
      endDateStr,
      TriggerManager.PUBLISH_DAYS_BEFORE,
      TriggerManager.PUBLISH_HOUR
    );
  }

  /**
   * 算出提醒的觸發時間
   * @param {string} endDateStr - Sprint 結束日,格式 "2026/05/08"
   * @returns {Date}
   */
  calcReminderDate(endDateStr) {
    return this._calcDate(
      endDateStr,
      TriggerManager.REMINDER_DAYS_BEFORE,
      TriggerManager.REMINDER_HOUR
    );
  }


  /* ========== 📌 建立排程 ========== */

  /**
   * 排定發布排程
   * @param {string} endDateStr - Sprint 結束日,格式 "2026/05/08"
   * @returns {string} 排程 ID
   */
  schedulePublish(endDateStr) {
    const at      = this.calcPublishDate(endDateStr);
    const trigger = ScriptApp.newTrigger('publishTask').timeBased().at(at).create();

    Logger.log(`⏰ 發布排程已排定:${DateFormat.formatDateTime(at)}`);
    return trigger.getUniqueId();
  }

  /**
   * 排定提醒排程
   * @param {string} endDateStr - Sprint 結束日,格式 "2026/05/08"
   * @returns {string} 排程 ID
   */
  scheduleReminder(endDateStr) {
    const at      = this.calcReminderDate(endDateStr);
    const trigger = ScriptApp.newTrigger('reminderTask').timeBased().at(at).create();

    Logger.log(`⏰ 提醒排程已排定:${DateFormat.formatDateTime(at)}`);
    return trigger.getUniqueId();
  }


  /* ========== 🔍 查詢 ========== */

  /**
   * 列出指定 handler 的排程
   * @param {string} handlerName
   * @returns {GoogleAppsScript.Script.Trigger[]}
   */
  listByHandler(handlerName) {
    return ScriptApp.getProjectTriggers()
      .filter((t) => t.getHandlerFunction() === handlerName);
  }

  /**
   * 列出所有「待處理的動態排程」(publishTask + reminderTask)
   *
   * 一個 Sprint 從建立到提醒完成的期間,至少會有其中一種存在。
   * 回傳空陣列代表上一個 Sprint 流程已經走完。
   *
   * @returns {GoogleAppsScript.Script.Trigger[]}
   */
  listPending() {
    return ScriptApp.getProjectTriggers()
      .filter((t) => TriggerManager.DYNAMIC_HANDLERS.includes(t.getHandlerFunction()));
  }


  /* ========== 🗑️ 刪除 ========== */

  /**
   * 刪除指定 handler 的所有排程
   * @param {string} handlerName
   * @returns {number} 刪除的數量
   */
  cancelByHandler(handlerName) {
    const triggers = this.listByHandler(handlerName);

    triggers.forEach((t) => ScriptApp.deleteTrigger(t));
    Logger.log(`🗑️ 已刪除 ${triggers.length} 個 ${handlerName} 排程`);
    return triggers.length;
  }

  /**
   * 刪除所有提醒排程
   *
   * 用途:排定新的提醒之前先清掉舊的,確保同一時間只有一個。
   * 沒有這一步的話,重複執行 publishTask 會累積出多個提醒排程,
   * 團隊就會收到多張提醒卡。
   *
   * @returns {number} 刪除的數量
   */
  cancelReminders() {
    return this.cancelByHandler('reminderTask');
  }

  /**
   * 清掉「這次執行」對應的一次性排程
   *
   * 排程觸發:有 e.triggerUid,精確刪自己。
   * 手動執行:沒有 e,也就沒有「自己」可刪。但剛才已經代替那個待處理的排程
   *          把事情做完了,若不清掉,它之後真的觸發時會再跑一次整個流程
   *          (團隊收到重複的卡片),而且會擋住下一次 prepareRetro。
   *
   * @param {Object} e - 觸發器事件物件(手動執行時為 undefined)
   * @param {string} handlerName - 'publishTask' 或 'reminderTask'
   */
  cleanUpAfterRun(e, handlerName) {
    if (e && e.triggerUid) {
      this.deleteByUid(e.triggerUid);
    } else {
      Logger.log(`⚠️ 手動執行:改為清除所有待處理的 ${handlerName} 排程`);
      this.cancelByHandler(handlerName);
    }
  }

  /**
   * 依 ID 刪除單一排程
   * @param {string} uid
   */
  deleteByUid(uid) {
    const targets = ScriptApp.getProjectTriggers()
      .filter((t) => t.getUniqueId() === uid);

    if (targets.length > 0) {
      ScriptApp.deleteTrigger(targets[0]);
      Logger.log(`🗑️ 已刪除排程:${uid}`);
    } else {
      Logger.log(`⚠️ 找不到對應排程:${uid}`);
    }
  }


  /* ========== 🔒 私有 ========== */

  /**
   * 從 Sprint 結束日往前推算觸發時間
   * @private
   * @param {string} endDateStr - 格式 "2026/05/08"
   * @param {number} daysBefore - 結束日前幾天
   * @param {number} hour - 幾點觸發
   * @returns {Date}
   */
  _calcDate(endDateStr, daysBefore, hour) {
    const parts   = endDateStr.split('/').map(Number);
    const endDate = new Date(parts[0], parts[1] - 1, parts[2]);

    const triggerDate = new Date(endDate);
    triggerDate.setDate(triggerDate.getDate() - daysBefore);
    triggerDate.setHours(hour, 0, 0, 0);

    return triggerDate;
  }
}
