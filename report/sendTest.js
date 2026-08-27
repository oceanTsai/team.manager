// /**
//  * ============================================================
//  * Chat Card 測試範例
//  * ============================================================
//  * 用 Webhook 發送 Card v2 訊息到 Google Chat 空間
//  *
//  * 🔐 安全設計:
//  *   Webhook URL 為機密憑證,絕不寫死在程式碼。
//  *   改用 Script Properties(類似環境變數)儲存。
//  *
//  * ⚠️ 限制:
//  *   Webhook 只能單向發送,按鈕點擊沒人接收。
//  *   先看 Card 呈現,實際互動需要部署 Chat App。
//  *
//  * 📋 使用方式:
//  *   1. 取得 Webhook URL(進聊天室 → 應用程式與整合 → 新增 Webhook)
//  *   2. 在 Apps Script 編輯器設定 Script Property:
//  *      - 左側齒輪 ⚙️「專案設定」
//  *      - 滾到底,「指令碼屬性」→ 新增屬性
//  *      - 屬性:RETRO_CHAT_WEBHOOK_URL
//  *      - 值:你的 Webhook URL
//  *      - 點「儲存指令碼屬性」
//  *   3. 編輯器選 testSimpleCard 或 testSprintCard → 執行
//  *   4. 到聊天室看訊息
//  * ============================================================
//  */


// /* ========== 🔐 從 Script Properties 讀取設定 ========== */

// /**
//  * 從 Script Properties 取得 Webhook URL
//  * 沒設定就拋錯,提示如何設定
//  */
// function _getWebhookUrl() {
//   const url = PropertiesService.getScriptProperties().getProperty('RETRO_CHAT_WEBHOOK_URL');
//   if (!url) {
//     throw new Error(
//       '❌ 尚未設定 RETRO_CHAT_WEBHOOK_URL\n' +
//       '請到「專案設定 → 指令碼屬性」新增屬性 RETRO_CHAT_WEBHOOK_URL'
//     );
//   }
//   return url;
// }


// /* ========== 🧪 測試 1:最簡單的 Card ========== */

// function testSimpleCard() {
//   const card = {
//     cardsV2: [{
//       cardId: 'simple-card',
//       card: {
//         header: {
//           title: '📋 測試卡片',
//           subtitle: '這是一個簡單範例',
//         },
//         sections: [{
//           widgets: [
//             { textParagraph: { text: '這是內容區塊,可以放任何文字。' } },
//             { buttonList: {
//               buttons: [
//                 { text: '🚀 主要按鈕', onClick: { openLink: { url: 'https://google.com' } } },
//                 { text: '取消', onClick: { openLink: { url: 'https://google.com' } } },
//               ]
//             }}
//           ]
//         }]
//       }
//     }]
//   };

//   _sendCard(card);
// }


// /* ========== 🧪 測試 2:Sprint 風格的 Card ========== */

// function testSprintCard() {
//   const card = {
//     cardsV2: [{
//       cardId: 'sprint-card',
//       card: {
//         header: {
//           title: '✅ Sprint 0427-0508 已建立',
//           subtitle: '請確認表單內容後發布',
//           imageUrl: 'https://fonts.gstatic.com/s/i/googlematerialicons/event_note/v6/24px.svg',
//           imageType: 'CIRCLE',
//         },
//         sections: [
//           {
//             header: '📦 已建立的資源',
//             widgets: [
//               {
//                 decoratedText: {
//                   icon: { knownIcon: 'BOOKMARK' },
//                   topLabel: '資料夾',
//                   text: '0427-0508',
//                   button: {
//                     text: '開啟',
//                     onClick: { openLink: { url: 'https://drive.google.com/' } },
//                   },
//                 }
//               },
//               {
//                 decoratedText: {
//                   icon: { knownIcon: 'DESCRIPTION' },
//                   topLabel: '表單',
//                   text: 'Sprint 回顧問卷',
//                   button: {
//                     text: '調整',
//                     onClick: { openLink: { url: 'https://docs.google.com/forms/' } },
//                   },
//                 }
//               },
//               {
//                 decoratedText: {
//                   icon: { knownIcon: 'STAR' },
//                   topLabel: '投影片',
//                   text: '0427-0508回顧',
//                   button: {
//                     text: '檢視',
//                     onClick: { openLink: { url: 'https://docs.google.com/presentation/' } },
//                   },
//                 }
//               },
//             ]
//           },
//           {
//             header: '🚀 操作',
//             widgets: [
//               { textParagraph: { text: '確認表單內容無誤後,點下方發布:' } },
//               {
//                 buttonList: {
//                   buttons: [
//                     {
//                       text: '✅ 發布表單',
//                       color: { red: 0.13, green: 0.67, blue: 0.27 },
//                       onClick: { openLink: { url: 'https://google.com' } },
//                     },
//                     {
//                       text: '查看詳情',
//                       onClick: { openLink: { url: 'https://google.com' } },
//                     },
//                   ]
//                 }
//               }
//             ]
//           }
//         ]
//       }
//     }]
//   };

//   _sendCard(card);
// }


// /* ========== 🔧 內部:發送 Card 到 Webhook ========== */

// function _sendCard(cardPayload) {
//   try {
//     const webhookUrl = _getWebhookUrl();

//     const response = UrlFetchApp.fetch(webhookUrl, {
//       method: 'POST',
//       contentType: 'application/json',
//       payload: JSON.stringify(cardPayload),
//       muteHttpExceptions: true,
//     });

//     const code = response.getResponseCode();
//     if (code === 200) {
//       Logger.log('✅ 訊息發送成功');
//     } else {
//       Logger.log(`❌ 發送失敗 (HTTP ${code}):${response.getContentText()}`);
//     }
//   } catch (e) {
//     Logger.log(`❌ 錯誤:${e.message}`);
//   }
// }