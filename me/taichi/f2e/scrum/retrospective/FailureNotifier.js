/**
 * ============================================================
 * FailureNotifier.gs - 流程失敗時的錯誤通知
 * ============================================================
 * 📦 屬於 retrospective
 *
 * 職責:
 *   三個入口(prepareRetro / publishTask / reminderTask)發生例外時,
 *   把「哪一步失敗、為什麼、接下來該去哪裡做什麼」發到個人 Chat 頻道。
 *
 *   通知裡會附上兩個按鈕(Apps Script 專案、scrum 資料夾),
 *   讓人不用自己找連結就能直接去處理。
 *
 * 🔐 Script Properties:
 *   - RETRO_CHAT_WEBHOOK_URL  個人 Google Chat Webhook URL
 *
 * ⚠️ 為什麼不透過 ReminderNotifier:
 *   ReminderNotifier 的建構子要求 RETRO_CHAT_WEBHOOK_URL 和
 *   B_TEAM_RETRO_WEBHOOK 兩個屬性都要設定,任一沒設就拋錯。
 *   萬一流程失敗的原因正好是「webhook 沒設定」,拿它來回報錯誤會再爆一次。
 *   這支只讀個人頻道那一個屬性,依賴最少。
 *
 * ⚠️ 這支函式絕對不能拋錯:
 *   它是在 catch 區塊裡被呼叫的。如果它自己拋錯,會蓋掉原本要回報的
 *   那個錯誤,讓問題更難查。所以全程包 try/catch,失敗只寫 log。
 * ============================================================
 */


/**
 * 發送流程失敗通知到個人頻道
 *
 * @param {string} functionName - 失敗的函式名稱,同時也是修好後要重跑的那一個,
 *                                例如 'publishTask'
 * @param {string} description  - 這一步在做什麼(給人讀的),例如 '發布回顧表單'
 * @param {Error}  error        - 捕捉到的例外
 */
function notifyFailure(functionName, description, error) {
  try {
    const url = PropertiesService.getScriptProperties()
      .getProperty('RETRO_CHAT_WEBHOOK_URL');

    if (url) {
      Notify.createChatNotifier(url).sendCard({
        title:    `❌ 回顧流程失敗:${description}`,
        subtitle: error.message,
        fields: [
          { label: '📍 失敗的函式', value: functionName },
          { label: '❗ 錯誤訊息',   value: error.message },
          { label: '🔧 怎麼處理',   value: _buildRecoverySteps(functionName) },
        ],
        actions: _buildRecoveryActions(),
      });
      Logger.log(`📩 已發送失敗通知:${functionName}`);
    } else {
      Logger.log('⚠️ 未設定 RETRO_CHAT_WEBHOOK_URL,無法發送失敗通知');
    }
  } catch (notifyError) {
    // 通知失敗只記 log —— 不能讓它蓋掉原本要回報的錯誤
    Logger.log(`⚠️ 失敗通知本身也失敗了:${notifyError.message}`);
  }
}


/* ========== 🔒 私有 ========== */

/**
 * 組出「接下來該做什麼」的逐步指引
 * @private
 */
function _buildRecoverySteps(functionName) {
  return [
    '① 先看上面的錯誤訊息,多數原因出在 Drive(例如表單重複、資料夾缺漏)',
    '② 修正原因後,點下方按鈕開啟 Apps Script 專案',
    `③ 在上方函式選單選「${functionName}」→ 按「執行」重跑這一步`,
    '④ 若出現「上一個 Sprint 流程尚未完成」,先執行 listAllTriggers() 查看,',
    '   確認無誤再執行 clearDynamicTriggers() 清除後重試',
  ].join('\n');
}

/**
 * 組出通知卡片的按鈕:直接連到要去處理的兩個地方
 *
 * 取連結時任何一步失敗都不影響通知本身,所以個別包 try/catch。
 * @private
 */
function _buildRecoveryActions() {
  const actions = [];

  try {
    actions.push({
      text: '開啟 Apps Script 專案',
      url:  `https://script.google.com/home/projects/${ScriptApp.getScriptId()}/edit`,
    });
  } catch (e) {
    Logger.log(`⚠️ 取得 Apps Script 專案連結失敗:${e.message}`);
  }

  try {
    actions.push({
      text: '開啟 scrum 資料夾',
      url:  `https://drive.google.com/drive/folders/${SPRINT_OPTIONS.sprintRootFolderId}`,
    });
  } catch (e) {
    Logger.log(`⚠️ 取得 Drive 資料夾連結失敗:${e.message}`);
  }

  return actions;
}
