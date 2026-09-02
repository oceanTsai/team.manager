/**
 * ============================================================
 * PublishTask.gs - 發布回顧表單(排程入口)
 * ============================================================
 * 📦 屬於 retrospective
 *
 * FormPublishTask 是「編排」角色,自己不含業務邏輯:
 *
 *   SprintFinder     找到最新 Sprint 與它的表單
 *   SprintForm       發布表單
 *   TriggerManager   排定提醒排程、清掉自己的排程
 *   ReminderNotifier 通知主管「已發布」
 *
 * 每個動作都能單獨呼叫 —— 見 手動操作.gs。
 * 失敗時只發通知,不做自動修復。
 *
 * 🔐 Script Properties:RETRO_CHAT_WEBHOOK_URL(個人頻道)
 *
 * ⚠️ publishTask() 由 prepareRetro 排定的一次性排程呼叫。
 *    手動想補發布請用 手動操作.gs 的 publishLatestForm()。
 * ============================================================
 */


class FormPublishTask {

  /**
   * @param {Object} options - SPRINT_OPTIONS
   */
  constructor(options) {
    const drive = Infra.createDriveClient();

    this._drive      = drive;
    this._formClient = Infra.createFormClient();
    this._finder     = new SprintFinder(drive, options.sprintRootFolderId);
    this._triggers   = new TriggerManager();
  }


  /**
   * 發布表單 → 排提醒 → 通知主管 → 清掉自己的排程
   *
   * @param {Object} [e] - 觸發器事件物件(手動執行時為 undefined)
   * @returns {Object} 表單資訊
   */
  run(e) {
    const latest = this._finder.findLatest();
    Logger.log(`🚀 publishTask 開始:${latest.name}`);

    // 1. 發布表單
    const form = new SprintForm(
      this._drive,
      this._formClient,
      this._finder.findForm(latest.folderId)
    );
    form.publish();

    // 2. 排定提醒排程(先清舊的,確保只有一個)
    const endDateStr = DateFormat.formatDate(latest.endDate);
    this._triggers.cancelReminders();
    this._triggers.scheduleReminder(endDateStr);

    // 3. 通知主管 —— 要在排定之後才發,才知道提醒時間
    const info = form.describe();
    new ReminderNotifier().notifyPublished({
      sprintName: latest.name,
      previewUrl: info.previewUrl,
      editUrl:    info.editUrl,
      reminderAt: DateFormat.formatDateTime(this._triggers.calcReminderDate(endDateStr)),
    });

    // 4. 清掉自己這個一次性排程
    this._triggers.cleanUpAfterRun(e, 'publishTask');

    Logger.log('🎉 publishTask 完成');
    return info;
  }
}


/* ========== 🎯 排程入口(全域函式,不可改名) ========== */

/**
 * 由 prepareRetro 排定的一次性排程呼叫
 *
 * GAS 的觸發器只能綁全域函式,所以這裡是一層薄包裝。
 *
 * @param {Object} e - 觸發器事件物件
 */
function publishTask(e) {
  try {
    new FormPublishTask(SPRINT_OPTIONS).run(e);
  } catch (error) {
    Logger.log(`❌ publishTask 錯誤:${error.message}`);
    notifyFailure('publishTask', '發布回顧表單', error);
    throw error;
  }
}
