/**
 * ============================================================
 * MessageTemplate.gs - 訊息樣板抽象基底類別
 * ============================================================
 * 📦 屬於 NotifyLib 函式庫
 *
 * 設計目的:
 *   策略模式 - 把「訊息要長怎樣」抽離出來,跟「怎麼送出去」解耦。
 *
 *   業務層繼承此基底,各自實作 render() 把業務資料變成
 *   Notifier.sendCard() 認得的通用 Message 結構。
 *
 *   - MessageTemplate 不知道平台(Chat / Slack / Teams)
 *   - Notifier 不知道業務內容
 *   - 兩者透過「通用 Message 結構」溝通,雙向解耦
 *
 * 子類必須實作:
 *   - render(data) → Message 結構
 *
 * Message 結構規範(跟 Notifier.sendCard 接收的格式一致):
 *   {
 *     title:    string,            // 標題(必填)
 *     subtitle: string,            // 副標題(選填)
 *     fields: [                    // 結構化欄位
 *       { label: string, value: string, link: string(可選) }
 *     ],
 *     actions: [                   // 按鈕(開連結用)
 *       { text: string, url: string }
 *     ]
 *   }
 *
 * 使用範例:
 *   class MyTemplate extends MessageTemplate {
 *     render(data) {
 *       return {
 *         title: `處理結果`,
 *         fields: data.items.map(i => ({ label: i.name, value: i.status })),
 *         actions: [{ text: '查看', url: data.url }]
 *       };
 *     }
 *   }
 *
 *   const message = new MyTemplate().render(myData);
 *   const notifier = createChatNotifier(webhookUrl);
 *   notifier.sendCard(message);
 * ============================================================
 */


/* ========== 🏗️ 抽象基底 ========== */

class MessageTemplate {

  /**
   * 把業務資料渲染成通用 Message 結構
   * @param {Object} data - 業務資料,由各子類自行定義格式
   * @returns {Object} Message 結構 { title, subtitle?, fields?, actions? }
   * @abstract 子類必須實作
   */
  render(data) {
    throw new Error('render() 必須由子類實作');
  }
}

/**
 * 取得 MessageTemplate 基底 class,供外部專案繼承用
 * @returns {typeof MessageTemplate}
 */
function getMessageTemplateClass() {
  return MessageTemplate;
}