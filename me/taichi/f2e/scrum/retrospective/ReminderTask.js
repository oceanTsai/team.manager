/**
 * ============================================================
 * ReminderTask.gs - 回顧問卷提醒工作(觸發器執行)
 * ============================================================
 * 📦 屬於 retrospective
 *
 * 職責:
 *   觸發器到時間後自動執行:找表單 → 通知團隊填寫 → 自我刪除
 *
 * 📦 依賴:
 *   - InfraLib(識別碼:Infra)
 *   - NotifyLib(識別碼:Notify)
 *
 * 🔐 Script Properties:
 *   - B_TEAM_RETRO_WEBHOOK  團隊 Google Chat Webhook URL
 *
 * ⚠️ reminderTask() 是全域函式,供觸發器呼叫
 *    不應直接手動執行(除非測試)
 * ============================================================
 */


class ReminderTaskRunner {

  constructor() {
    this.drive    = Infra.createDriveClient();
    this.form     = Infra.createFormClient();
    this.tm       = new TriggerManager();
    this.notifier = new ReminderNotifier();
  }


  /* ========== 🚀 公開方法 ========== */

  /**
   * 執行提醒流程
   * @param {Object} e - 觸發器事件物件
   */
  run(e) {
    Logger.log('🚀 ReminderTask 開始執行');

    // 1. 找最新 Sprint
    const sprintInfo = this._findLatestSprint();
    Logger.log(`📌 找到最新 Sprint:${sprintInfo.name}`);

    // 2. 找表單
    const formFile = findSprintForm(this.drive, sprintInfo.folderId);
    Logger.log(`📝 找到表單:${formFile.getName()}`);

    // 3. 發提醒通知給團隊(用填寫者網址)
    this.notifier.notifyReminder({
      sprintName: sprintInfo.name,
      formUrl:    this.form.getPublishedUrl(formFile.getId()),
    });

    // 4. 清掉這次提醒對應的 reminderTask 觸發器
    //    (一次性觸發器執行完不會自動消失,不清會累積)
    //
    //    排程觸發:精確刪自己就好。
    //    手動執行:沒有 e,也就沒有「自己」可刪。但剛才已經代替那個待處理的
    //             觸發器把提醒發出去了,若不清掉,它之後真的觸發時會再發一次,
    //             而且會擋住下一次 prepareRetro。
    //             做法與 PublishTask 對稱,讓手動補跑就能自己收乾淨。
    if (e && e.triggerUid) {
      this.tm.deleteByUid(e.triggerUid);
    } else {
      Logger.log('⚠️ 手動執行:改為清除所有待處理的 reminderTask 觸發器');
      this.tm.cancelReminders();
    }

    Logger.log('🎉 ReminderTask 完成');
  }


  /* ========== 🔒 私有方法 ========== */

  /** @private */
  _findLatestSprint() {
    return findLatestSprintFolder(this.drive, SPRINT_OPTIONS.sprintRootFolderId);
  }
}


/* ========== 🎯 觸發器入口(全域函式,不可改名) ========== */

function reminderTask(e) {
  try {
    new ReminderTaskRunner().run(e);
  } catch (error) {
    Logger.log(`❌ reminderTask 錯誤:${error.message}`);
    notifyFailure('reminderTask', '提醒團隊填寫問卷', error);
    throw error;
  }
}
