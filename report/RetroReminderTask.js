/**
 * ============================================================
 * RetroReminderTask.gs - 回顧問卷提醒工作(觸發器執行)
 * ============================================================
 * 📦 屬於 SprintProject
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


class RetroReminderTaskRunner {

  constructor() {
    this.drive    = Infra.createDriveClient();
    this.form     = Infra.createFormClient();
    this.tm       = new TriggerManager();
    this.notifier = new RetroReminderNotifier();
  }


  /* ========== 🚀 公開方法 ========== */

  /**
   * 執行提醒流程
   * @param {Object} e - 觸發器事件物件
   */
  run(e) {
    Logger.log('🚀 RetroReminderTask 開始執行');

    // 1. 找最新 Sprint
    const sprintInfo = this._findLatestSprint();
    Logger.log(`📌 找到最新 Sprint:${sprintInfo.name}`);

    // 2. 找表單
    const formFile = this._findForm(sprintInfo.folderId);
    Logger.log(`📝 找到表單:${formFile.getName()}`);

    // 3. 發提醒通知給團隊(用填寫者網址)
    this.notifier.notifyReminder({
      sprintName: sprintInfo.name,
      formUrl:    this.form.getPublishedUrl(formFile.getId()),
    });

    // 4. 自我刪除觸發器
    if (e && e.triggerUid) {
      this.tm.deleteByUid(e.triggerUid);
    }

    Logger.log('🎉 RetroReminderTask 完成');
  }


  /* ========== 🔒 私有方法 ========== */

  /** @private */
  _findLatestSprint() {
    const year = new Date().getFullYear();

    const yearFolder = this.drive.findFolderByName(SPRINT_OPTIONS.sprintRootFolderId, String(year));
    if (!yearFolder) {
      throw new Error(`找不到 ${year} 年度資料夾`);
    }

    const folders = this.drive.listFolders(yearFolder.getId());
    let latest = null;
    let latestEndDate = null;

    folders.forEach((folder) => {
      const match = folder.getName().match(/^(\d{2})(\d{2})-(\d{2})(\d{2})$/);
      if (!match) return;

      const [, startM, , endM, endD] = match.map(Number);
      const endDate = new Date(year, endM - 1, endD);
      if (startM > endM) endDate.setFullYear(year + 1);

      if (!latestEndDate || endDate > latestEndDate) {
        latestEndDate = endDate;
        latest = { name: folder.getName(), folderId: folder.getId() };
      }
    });

    if (!latest) {
      throw new Error('找不到符合 MMDD-MMDD 格式的 Sprint 資料夾');
    }

    return latest;
  }

  /** @private */
  _findForm(folderId) {
    const files = this.drive.findFilesByMimeType(folderId, Infra.DriveMime.FORM);

    if (files.length === 0) {
      throw new Error('Sprint 資料夾內找不到 Google Form');
    }
    if (files.length > 1) {
      throw new Error('Sprint 資料夾內有多個 Google Form，請只保留一個');
    }

    return files[0];
  }
}


/* ========== 🎯 觸發器入口(全域函式,不可改名) ========== */

function reminderTask(e) {
  try {
    new RetroReminderTaskRunner().run(e);
  } catch (error) {
    Logger.log(`❌ reminderTask 錯誤:${error.message}`);
    throw error;
  }
}