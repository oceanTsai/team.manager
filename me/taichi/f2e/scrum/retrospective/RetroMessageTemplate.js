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
 *   - sprintCreated(result)   Sprint 已建立
 *   - formPublished(info)     表單已發布
 *   - surveyReminder(info)    請填寫問卷
 * ============================================================
 */


class RetroMessageTemplate extends Notify.getMessageTemplateClass() {

  /**
   * Sprint 已建立的通知訊息
   * @param {Object} result - RetroService.create() 的回傳
   * @param {string} result.sprintName
   * @param {string} result.startDate
   * @param {string} result.endDate
   * @param {string} result.folderUrl
   * @param {string} result.formUrl
   * @param {string} result.slideUrl
   * @returns {Object} Message 結構
   */
  sprintCreated(result) {
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
   * 表單已發布的通知訊息
   * @param {Object} info
   * @param {string} info.sprintName
   * @param {string} info.formUrl
   * @returns {Object} Message 結構
   */
  formPublished(info) {
    return {
      title:    `🎉 Sprint ${info.sprintName} 問卷已發布`,
      subtitle: '表單已開放填寫，請盡快完成',
      fields: [
        { label: '📝 填寫表單', value: info.sprintName, link: info.formUrl },
      ],
      actions: [
        { text: '前往填寫', url: info.formUrl },
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
  surveyReminder(info) {
    return {
      title:    `📋 Sprint ${info.sprintName} 回顧問卷提醒`,
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
      case 'sprintCreated':   return this.sprintCreated(payload.data);
      case 'formPublished':   return this.formPublished(payload.data);
      case 'surveyReminder':  return this.surveyReminder(payload.data);
      default: throw new Error(`未知的訊息類型:${payload.type}`);
    }
  }
}