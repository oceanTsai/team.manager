/**
 * ============================================================
 * PublishTask.gs - Sprint 表單發布工作(觸發器執行)
 * ============================================================
 * 📦 屬於 SprintProject
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

    // 4. 發 Chat 通知
    this.notifier.notifyPublished({
      sprintName: sprintInfo.name,
      formUrl:    formFile.getUrl(),
    });

    // 5. 排定提醒觸發器(結束日直接來自 findLatestSprintFolder,不用另外反推)
    const endDateStr = this._formatDate(sprintInfo.endDate);
    this.tm.scheduleReminder(endDateStr);

    // 6. 清除所有 publishTask 觸發器(包含排程中的和自己)
    this.tm.cancel();

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
    throw error;
  }
}
