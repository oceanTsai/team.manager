/**
 * ============================================================
 * Notifier.gs - 通知器抽象基底類別
 * ============================================================
 * 📦 屬於 NotifyLib 函式庫
 *
 * 設計目的:
 *   定義跨平台通知的共通介面,業務層只依賴此抽象,
 *   不關心實際發送平台(Chat / Slack / Teams)。
 *
 * 子類必須實作:
 *   - send(text)         發送純文字訊息
 *   - sendCard(message)  發送結構化訊息
 *
 * 統一 Message 結構(sendCard 的參數):
 *   {
 *     title:    string,            // 標題
 *     subtitle: string,            // 副標題(可選)
 *     fields: [                    // 結構化欄位
 *       { label: string, value: string, link: string(可選) }
 *     ],
 *     actions: [                   // 按鈕(開連結用)
 *       { text: string, url: string }
 *     ],
 *   }
 *
 *   各平台 Notifier 負責把此結構轉成自家格式。
 * ============================================================
 */


/* ========== 🏗️ 內部 Class 定義 ========== */

class Notifier {

  /**
   * @param {string} webhookUrl - 通知端點 URL
   */
  constructor(webhookUrl) {
    if (!webhookUrl) {
      throw new Error('Notifier 需要 webhookUrl');
    }

    /** @protected @type {string} */
    this._webhookUrl = webhookUrl;
  }

  /**
   * 發送純文字訊息
   * @param {string} text
   * @abstract 子類必須實作
   */
  send(text) {
    throw new Error('send() 必須由子類實作');
  }

  /**
   * 發送結構化訊息(Card)
   * @param {Object} message - 統一 Message 結構
   * @abstract 子類必須實作
   */
  sendCard(message) {
    throw new Error('sendCard() 必須由子類實作');
  }

  /**
   * 共用 HTTP POST 邏輯(子類使用)
   * @protected
   * @param {Object} payload - 平台特定的 payload
   * @returns {boolean} 是否成功
   */
  _post(payload) {
    try {
      const response = UrlFetchApp.fetch(this._webhookUrl, {
        method: 'POST',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });

      const code = response.getResponseCode();
      if (code >= 200 && code < 300) {
        return true;
      }

      Logger.log(`⚠️ 通知發送失敗 (HTTP ${code}):${response.getContentText()}`);
      return false;
    } catch (e) {
      Logger.log(`⚠️ 通知發送錯誤:${e.message}`);
      return false;
    }
  }
}