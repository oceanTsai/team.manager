/**
 * ============================================================
 * PublishTask.gs - Sprint 表單發布工作(觸發器執行)
 * ============================================================
 * 📦 屬於 retrospective
 *
 * 職責:
 *   觸發器到時間後自動執行:找表單 → 發布 → 通知 → 自我刪除
 *
 * 📦 依賴:
 *   - InfraLib(識別碼:Infra)
 *   - NotifyLib(識別碼:Notify)
 *
 * 🔐 Script Properties:
 *   - RETRO_CHAT_WEBHOOK_URL  Google Chat Webhook URL
 *
 * ⚠️ publishTask() 是全域函式,供觸發器呼叫
 *    不應直接手動執行(除非測試)
 * ============================================================
 */


class PublishTaskRunner {

  constructor() {
    this.drive    = Infra.createDriveClient();
    this.form     = Infra.createFormClient();
    this.tm       = new TriggerManager();
    this.notifier = new ReminderNotifier();
  }


  /* ========== 🚀 公開方法 ========== */

  /**
   * 執行發布流程
   * @param {Object} e - 觸發器事件物件
   */
  run(e) {
    Logger.log('🚀 PublishTask 開始執行');

    // 1. 找最新 Sprint
    const sprintInfo = this._findLatestSprint();
    Logger.log(`📌 找到最新 Sprint:${sprintInfo.name}`);

    // 2. 找表單
    const formFile = findSprintForm(this.drive, sprintInfo.folderId);
    Logger.log(`📝 找到表單:${formFile.getName()}`);

    // 3. 發布表單(防呆:已發布就跳過，但後續流程繼續)
    if (this.form.isPublished(formFile.getId())) {
      Logger.log('⚠️ 表單已發布，跳過重複發布');
    } else {
      this.form.publish(formFile.getId());
      Logger.log('✅ 表單已發布');
    }

    // 4. 排定提醒觸發器(結束日直接來自 findLatestSprintFolder,不用另外反推)
    //    先清掉既有的提醒排程,確保這次執行完剛好只有一個 ——
    //    重複執行 publishTask 時才不會累積出多張提醒卡
    const endDateStr = this._formatDate(sprintInfo.endDate);
    this.tm.cancelReminders();
    this.tm.scheduleReminder(endDateStr);

    // 5. 發 Chat 通知給主管(個人頻道)
    //    這張卡是給主管確認用的,不是給填寫者:告訴他團隊什麼時候會收到提醒、
    //    在那之前可以用「預覽」看團隊視角、用「調整」進編輯畫面。
    //    所以要在排定提醒之後才發,才知道提醒時間。
    this.notifier.notifyPublished({
      sprintName: sprintInfo.name,
      previewUrl: this.form.getPublishedUrl(formFile.getId()),
      editUrl:    formFile.getUrl(),
      reminderAt: this._formatDateTime(this.tm.reminderDateFor(endDateStr)),
    });

    // 6. 清掉這次發布對應的 publishTask 觸發器
    //    (一次性觸發器執行完不會自動消失,不清會累積)
    //
    //    排程觸發:精確刪自己就好。
    //    手動執行:沒有 e,也就沒有「自己」可刪。但剛才已經代替那個待處理的
    //             觸發器把事情做完了,若不清掉,它之後真的觸發時會再跑一次
    //             整個流程、再排一次提醒(團隊收到兩張卡),而且會擋住
    //             下一次 prepareRetro。
    //             此時 cancel() 全刪是安全的 —— prepareRetro 的
    //             _assertNoPendingSprint() 保證同時只會有一個 Sprint 在進行,
    //             所以待處理的 publishTask 觸發器一定就是這個 Sprint 的。
    if (e && e.triggerUid) {
      this.tm.deleteByUid(e.triggerUid);
    } else {
      Logger.log('⚠️ 手動執行:改為清除所有待處理的 publishTask 觸發器');
      this.tm.cancel();
    }

    Logger.log('🎉 PublishTask 完成');
  }


  /* ========== 🔒 私有方法 ========== */

  /** @private */
  _findLatestSprint() {
    return findLatestSprintFolder(this.drive, SPRINT_OPTIONS.sprintRootFolderId);
  }

  /** @private */
  _formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}/${m}/${d}`;
  }

  /**
   * 格式化成「2026/06/18 10:00」,給通知卡片顯示提醒時間用
   * @private
   */
  _formatDateTime(date) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${this._formatDate(date)} ${hh}:${mm}`;
  }
}


/* ========== 🎯 觸發器入口(全域函式,不可改名) ========== */

/**
 * 觸發器呼叫的全域函式
 * @param {Object} e - 觸發器事件物件
 */
function publishTask(e) {
  try {
    new PublishTaskRunner().run(e);
  } catch (error) {
    Logger.log(`❌ publishTask 錯誤:${error.message}`);
    notifyFailure('publishTask', '發布回顧表單', error);
    throw error;
  }
}
