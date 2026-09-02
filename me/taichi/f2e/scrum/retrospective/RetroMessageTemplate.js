/**
 * ============================================================
 * RetroMessageTemplate.gs - Sprint 回顧訊息樣板
 * ============================================================
 * 📦 屬於 retrospective
 *
 * 職責:
 *   定義 Sprint 回顧相關的通知訊息格式。
 *   繼承 NotifyLib 的 MessageTemplate 抽象基底(透過 Notify.getMessageTemplateClass()
 *   取得)。本類別刻意不叫 MessageTemplate,避免與那個基底同名造成混淆。
 *
 * 提供三種訊息格式:
 *   - renderSprintCreated(result)   Sprint 已建立
 *   - renderFormPublished(info)     表單已發布
 *   - renderSurveyReminder(info)    請填寫問卷
 * ============================================================
 */


class RetroMessageTemplate extends Notify.getMessageTemplateClass() {

  /**
   * Sprint 已建立的通知訊息
   * @param {Object} result - 建立結果(sprintName / startDate / endDate / folderUrl / formUrl / slideUrl)
   * @param {string} result.sprintName
   * @param {string} result.startDate
   * @param {string} result.endDate
   * @param {string} result.folderUrl
   * @param {string} result.formUrl
   * @param {string} result.slideUrl
   * @returns {Object} Message 結構
   */
  renderSprintCreated(result) {
    return {
      title:    `✅ Sprint ${result.sprintName} 已建立`,
      subtitle: `${result.startDate} ~ ${result.endDate}`,
      fields: [
        { label: '📁 資料夾',  value: result.sprintName,           link: result.folderUrl },
        { label: '📝 表單',    value: result.sprintName,           link: result.formUrl   },
        { label: '📊 投影片',  value: `${result.sprintName}回顧`, link: result.slideUrl  },
      ],
      actions: [
        { text: '開啟資料夾', url: result.folderUrl },
        { text: '調整表單',   url: result.formUrl   },
      ],
    };
  }

  /**
   * 表單已發布的通知訊息(給主管確認用,不是給填寫者)
   *
   * 這張卡片發到個人頻道,用途是讓表單建立者在團隊收到提醒之前,
   * 先確認發布狀態、看看還有沒有要調整。所以:
   *   - 副標寫的是「團隊什麼時候會收到通知」,讓人知道還剩多少時間
   *   - 按鈕給兩個視角:預覽(團隊會看到的樣子) + 調整(編輯畫面)
   * 不要寫成「請盡快完成」那種對填寫者說的話 —— 讀者不是填寫者。
   *
   * @param {Object} info
   * @param {string} info.sprintName - Sprint 名稱,例如 '0608-0619'
   * @param {string} info.previewUrl - 填寫網址(團隊視角預覽用)
   * @param {string} info.editUrl    - 編輯網址(要調整時用)
   * @param {string} info.reminderAt - 團隊收到提醒的時間,例如 '2026/06/18 10:00'
   * @returns {Object} Message 結構
   */
  renderFormPublished(info) {
    return {
      title:    `🎉 Sprint ${info.sprintName} 問卷已發布`,
      subtitle: `團隊將於 ${info.reminderAt} 收到填寫提醒`,
      fields: [
        { label: '📝 表單',         value: info.sprintName, link: info.previewUrl },
        { label: '⏰ 團隊提醒時間', value: info.reminderAt                        },
      ],
      actions: [
        { text: '預覽填寫畫面', url: info.previewUrl },
        { text: '調整表單',     url: info.editUrl    },
      ],
    };
  }

  /**
   * 提醒填寫問卷的通知訊息
   * @param {Object} info
   * @param {string} info.sprintName
   * @param {string} info.formUrl
   * @returns {Object} Message 結構
   */
  renderSurveyReminder(info) {
    return {
      title:    `📋 Sprint ${info.sprintName} 回顧問卷填寫提醒`,
      subtitle: '請記得填寫回顧問卷',
      fields: [
        { label: '📝 填寫表單', value: info.sprintName, link: info.formUrl },
      ],
      actions: [
        { text: '前往填寫', url: info.formUrl },
      ],
    };
  }

  /**
   * render() 實作(MessageTemplate 抽象要求)
   * 透過 type 決定要 render 哪種訊息
   * @param {{ type: string, data: Object }} payload
   * @returns {Object} Message 結構
   */
  render(payload) {
    switch (payload.type) {
      case 'sprintCreated':   return this.renderSprintCreated(payload.data);
      case 'formPublished':   return this.renderFormPublished(payload.data);
      case 'surveyReminder':  return this.renderSurveyReminder(payload.data);
      default: throw new Error(`未知的訊息類型:${payload.type}`);
    }
  }
}