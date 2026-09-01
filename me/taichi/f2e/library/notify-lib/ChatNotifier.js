/**
 * ============================================================
 * ChatNotifier.gs - Google Chat 通知器
 * ============================================================
 * 📦 屬於 NotifyLib 函式庫
 *
 * 職責:
 *   把通用 Message 結構轉成 Google Chat 格式,透過 Webhook 發送。
 *   不包含任何業務邏輯,只負責「格式轉換」和「發送」。
 *
 * Message 結構(由 MessageTemplate.render() 產出):
 *   {
 *     title:    string,            // 標題(必填)
 *     subtitle: string,            // 副標題(選填)
 *     fields: [                    // 結構化欄位(選填)
 *       { label: string, value: string, link?: string }
 *     ],
 *     actions: [                   // 按鈕(選填)
 *       { text: string, url: string }
 *     ]
 *   }
 *
 * 對外取得實例:
 *   const notifier = NotifyLib.createChatNotifier(webhookUrl);
 *
 * 使用範例:
 *   notifier.send('Hello');
 *   notifier.sendCard({
 *     title: '✅ 處理完成',
 *     subtitle: '共 3 筆',
 *     fields: [{ label: '狀態', value: '成功', link: 'https://...' }],
 *     actions: [{ text: '開啟', url: 'https://...' }]
 *   });
 * ============================================================
 */


class ChatNotifier extends Notifier {

  // ------------------------------------------------------------------------
  // 公開 API
  // ------------------------------------------------------------------------

  /**
   * 發送純文字訊息
   * @param {string} text
   * @returns {boolean} 是否成功
   */
  send(text) {
    return this._post({ text });
  }

  /**
   * 發送結構化訊息(Card v2)
   * @param {Object} message - 通用 Message 結構
   * @returns {boolean} 是否成功
   */
  sendCard(message) {
    const payload = this._buildCardV2Payload(message);
    return this._post(payload);
  }

  // ------------------------------------------------------------------------
  // 私有方法:Card v2 格式轉換
  // ------------------------------------------------------------------------

  /**
   * 將通用 Message 結構轉為 Google Chat Card v2 payload
   * @private
   */
  _buildCardV2Payload(message) {
    return {
      cardsV2: [
        {
          cardId: `card-${Date.now()}`,
          card: this._buildCard(message)
        }
      ]
    };
  }

  /**
   * 組裝 Card 主體
   * @private
   */
  _buildCard(message) {
    const card = {
      header: this._buildHeader(message),
      sections: this._buildSections(message)
    };
    return card;
  }

  /**
   * 組裝 header(title + subtitle)
   * @private
   */
  _buildHeader(message) {
    const header = { title: message.title || '' };
    if (message.subtitle) {
      header.subtitle = message.subtitle;
    }
    return header;
  }

  /**
   * 組裝 sections:fields 一個 section、actions 一個 section
   * @private
   */
  _buildSections(message) {
    const sections = [];

    if (message.fields && message.fields.length > 0) {
      sections.push({
        widgets: message.fields.map(f => this._buildFieldWidget(f))
      });
    }

    if (message.actions && message.actions.length > 0) {
      sections.push({
        widgets: [this._buildButtonListWidget(message.actions)]
      });
    }

    return sections;
  }

  /**
   * 將單一 field 轉為 decoratedText widget
   * @private
   */
  _buildFieldWidget(field) {
    const widget = {
      decoratedText: {
        topLabel: field.label,
        text: field.value
      }
    };

    if (field.link) {
      widget.decoratedText.button = {
        text: '開啟',
        onClick: { openLink: { url: field.link } }
      };
    }

    return widget;
  }

  /**
   * 將 actions 轉為 buttonList widget
   * @private
   */
  _buildButtonListWidget(actions) {
    return {
      buttonList: {
        buttons: actions.map(a => ({
          text: a.text,
          onClick: { openLink: { url: a.url } }
        }))
      }
    };
  }
}


/* ========== 🏭 工廠函式(對外暴露) ========== */

/**
 * 建立 Google Chat Notifier 實例
 * @param {string} webhookUrl - Google Chat Webhook URL
 * @returns {ChatNotifier}
 */
function createChatNotifier(webhookUrl) {
  return new ChatNotifier(webhookUrl);
}