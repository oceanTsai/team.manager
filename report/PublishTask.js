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
    this.notifier = new RetroReminderNotifier();
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
    const formFile = this._findForm(sprintInfo.folderId);
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

    // 5. 排定提醒觸發器
    // 需要從 Sprint 名稱推算結束日，直接從 sprintInfo.name 解析
    const endDateStr = this._parseEndDate(sprintInfo.name);
    this.tm.scheduleReminder(endDateStr);

    // 6. 清除所有 publishTask 觸發器(包含排程中的和自己)
    this.tm.cancel();

    Logger.log('🎉 PublishTask 完成');
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

  /**
   * 從 Sprint 名稱(MMDD-MMDD)解析結束日
   * @private
   * @param {string} sprintName - 例如 "0608-0619"
   * @returns {string} 格式 "2026/06/19"
   */
  _parseEndDate(sprintName) {
    const parentFolder = this.drive.getFolder(SPRINT_OPTIONS.parentFolderId);
    const yearMatch = parentFolder.getName().match(/\d{4}/);
    const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();

    const match = sprintName.match(/^\d{4}-(\d{2})(\d{2})$/);
    if (!match) throw new Error(`無法從 Sprint 名稱解析結束日:${sprintName}`);

    const [, endM, endD] = match;
    return `${year}/${endM}/${endD}`;
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