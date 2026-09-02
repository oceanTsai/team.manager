/**
 * ============================================================
 * ReminderNotifier.gs - Sprint 回顧通知器
 * ============================================================
 * 📦 屬於 retrospective
 *
 * 職責:
 *   集中管理所有 Sprint 回顧相關的通知發送。
 *   組合 RetroMessageTemplate(訊息內容) +
 *        ChatNotifier(發送管道)
 *
 * 提供三種通知:
 *   - notifyCreated(result)   Sprint 已建立  → 個人頻道
 *   - notifyPublished(info)   表單已發布     → 個人頻道
 *   - notifyReminder(info)    提醒填寫問卷   → 團隊頻道
 *
 * 🔐 Script Properties:
 *   - RETRO_CHAT_WEBHOOK_URL  個人 Google Chat Webhook URL
 *   - B_TEAM_RETRO_WEBHOOK    團隊 Google Chat Webhook URL
 * ============================================================
 */


class ReminderNotifier {

  constructor() {
    const props = PropertiesService.getScriptProperties();

    const personalUrl = props.getProperty('RETRO_CHAT_WEBHOOK_URL');
    const teamUrl     = props.getProperty('B_TEAM_RETRO_WEBHOOK');

    if (!personalUrl) {
      throw new Error('未設定 RETRO_CHAT_WEBHOOK_URL，請到「專案設定 → 指令碼屬性」新增');
    }
    if (!teamUrl) {
      throw new Error('未設定 B_TEAM_RETRO_WEBHOOK，請到「專案設定 → 指令碼屬性」新增');
    }

    this._personalNotifier = Notify.createChatNotifier(personalUrl);
    this._teamNotifier     = Notify.createChatNotifier(teamUrl);
    this._template         = new RetroMessageTemplate();
  }


  /* ========== 🔔 公開通知方法 ========== */

  /**
   * 發送「Sprint 已建立」通知 → 個人頻道
   * @param {Object} result - RetroService.create() 的回傳
   */
  notifyCreated(result) {
    const message = this._template.sprintCreated(result);
    const ok = this._personalNotifier.sendCard(message);
    this._log('notifyCreated', result.sprintName, ok);
  }

  /**
   * 發送「表單已發布」通知 → 個人頻道
   * @param {{ sprintName: string, formUrl: string }} info
   */
  notifyPublished(info) {
    const message = this._template.formPublished(info);
    const ok = this._personalNotifier.sendCard(message);
    this._log('notifyPublished', info.sprintName, ok);
  }

  /**
   * 發送「提醒填寫問卷」通知 → 團隊頻道
   * @param {{ sprintName: string, formUrl: string }} info
   */
  notifyReminder(info) {
    const message = this._template.surveyReminder(info);
    const ok = this._teamNotifier.sendCard(message);
    this._log('notifyReminder', info.sprintName, ok);
  }


  /* ========== 🔒 私有方法 ========== */

  /** @private */
  _log(method, sprintName, ok) {
    const status = ok ? '✅ 成功' : '⚠️ 失敗';
    Logger.log(`${status} ${method}(${sprintName})`);
  }
}


/* ========== 🧪 測試函式 ========== */

function testReminderNotifier() {
  const notifier = new ReminderNotifier();

  // 測試個人頻道:已建立
  notifier.notifyCreated({
    sprintName: '0608-0619',
    startDate:  '2026/06/08',
    endDate:    '2026/06/19',
    folderUrl:  'https://drive.google.com/',
    formUrl:    'https://docs.google.com/forms/',
    slideUrl:   'https://docs.google.com/presentation/',
  });

  // 測試個人頻道:已發布
  notifier.notifyPublished({
    sprintName: '0608-0619',
    previewUrl: 'https://docs.google.com/forms/d/e/FAKE/viewform',
    editUrl:    'https://docs.google.com/forms/d/FAKE/edit',
    reminderAt: '2026/06/18 10:00',
  });

  // 測試團隊頻道:提醒填寫
  notifier.notifyReminder({
    sprintName: '0608-0619',
    formUrl:    'https://docs.google.com/forms/',
  });
}