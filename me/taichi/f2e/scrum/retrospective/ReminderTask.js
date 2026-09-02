/**
 * ============================================================
 * ReminderTask.gs - 提醒團隊填寫問卷(排程入口)
 * ============================================================
 * 📦 屬於 retrospective
 *
 * TeamReminderTask 是「編排」角色,自己不含業務邏輯:
 *
 *   SprintFinder     找到最新 Sprint 與它的表單
 *   SprintForm       讀取填寫網址(唯讀 —— 提醒不該順手把表單發布掉)
 *   ReminderNotifier 通知團隊
 *   TriggerManager   清掉自己的排程
 *
 * 每個動作都能單獨呼叫 —— 見 手動操作.gs。
 * 失敗時只發通知,不做自動修復。
 *
 * 🔐 Script Properties:B_TEAM_RETRO_WEBHOOK(團隊頻道)
 *
 * ⚠️ reminderTask() 由 publishTask 排定的一次性排程呼叫。
 *    手動想補提醒請用 手動操作.gs 的 notifyTeamReminder()。
 * ============================================================
 */


class TeamReminderTask {

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
   * 通知團隊填寫 → 清掉自己的排程
   *
   * @param {Object} [e] - 觸發器事件物件(手動執行時為 undefined)
   */
  run(e) {
    const latest = this._finder.findLatest();
    Logger.log(`🚀 reminderTask 開始:${latest.name}`);

    // 1. 讀取填寫網址(唯讀,不會改變表單的發布狀態)
    const form = new SprintForm(
      this._drive,
      this._formClient,
      this._finder.findForm(latest.folderId)
    );
    const info = form.describe();

    if (!info.isPublished) {
      Logger.log('⚠️ 表單尚未發布,團隊點連結可能無法填寫');
    }

    // 2. 通知團隊
    new ReminderNotifier().notifyReminder({
      sprintName: latest.name,
      formUrl:    info.previewUrl,
    });

    // 3. 清掉自己這個一次性排程
    this._triggers.cleanUpAfterRun(e, 'reminderTask');

    Logger.log('🎉 reminderTask 完成');
  }
}


/* ========== 🎯 排程入口(全域函式,不可改名) ========== */

/**
 * 由 publishTask 排定的一次性排程呼叫
 *
 * GAS 的觸發器只能綁全域函式,所以這裡是一層薄包裝。
 *
 * @param {Object} e - 觸發器事件物件
 */
function reminderTask(e) {
  try {
    new TeamReminderTask(SPRINT_OPTIONS).run(e);
  } catch (error) {
    Logger.log(`❌ reminderTask 錯誤:${error.message}`);
    notifyFailure('reminderTask', '提醒團隊填寫問卷', error);
    throw error;
  }
}
