/**
 * ============================================================
 * FailureNotifier.gs - 流程失敗時的錯誤通知
 * ============================================================
 * 📦 屬於 retrospective
 *
 * 職責:
 *   把「哪一步失敗、為什麼、接下來該去哪裡做什麼」發到個人 Chat 頻道。
 *   通知裡附上兩個按鈕(Apps Script 專案、scrum 資料夾),
 *   讓人不用自己找連結就能直接去處理。
 *
 * ⚠️ 為什麼不透過 ReminderNotifier:
 *   ReminderNotifier 的建構子要求兩個 webhook 屬性都設定,任一沒設就拋錯。
 *   萬一流程失敗的原因正好是「webhook 沒設定」,拿它來回報錯誤會再爆一次。
 *   這個類別只讀個人頻道那一個屬性,依賴最少。
 *
 * ⚠️ notify() 絕對不能拋錯:
 *   它是在 catch 區塊裡被呼叫的。如果它自己拋錯,會蓋掉原本要回報的
 *   那個錯誤,讓問題更難查。所以全程包 try/catch,失敗只寫 log。
 * ============================================================
 */


class FailureNotifier {

  /**
   * @param {string} webhookUrl - 個人 Google Chat Webhook URL
   * @param {string} scriptUrl - Apps Script 專案編輯畫面網址
   * @param {string} driveUrl - scrum 根資料夾網址
   */
  constructor(webhookUrl, scriptUrl, driveUrl) {
    this._webhookUrl = webhookUrl;
    this._scriptUrl  = scriptUrl;
    this._driveUrl   = driveUrl;
  }


  /* ========== 📩 公開方法 ========== */

  /**
   * 發送流程失敗通知
   *
   * @param {string} functionName - 失敗的函式名稱,同時也是修好後要重跑的那一個
   * @param {string} description - 這一步在做什麼(給人讀的),例如 '發布回顧表單'
   * @param {Error} error - 捕捉到的例外
   * @returns {boolean} 是否成功送出
   */
  notify(functionName, description, error) {
    let sent = false;

    if (this._webhookUrl) {
      Notify.createChatNotifier(this._webhookUrl).sendCard({
        title:    `❌ 回顧流程失敗:${description}`,
        subtitle: error.message,
        fields: [
          { label: '📍 失敗的函式', value: functionName },
          { label: '❗ 錯誤訊息',   value: error.message },
          { label: '🔧 怎麼處理',   value: this._buildSteps(functionName) },
        ],
        actions: this._buildActions(),
      });
      sent = true;
      Logger.log(`📩 已發送失敗通知:${functionName}`);
    } else {
      Logger.log('⚠️ 未設定 RETRO_CHAT_WEBHOOK_URL,無法發送失敗通知');
    }

    return sent;
  }


  /* ========== 🔒 私有 ========== */

  /**
   * 組出「接下來該做什麼」的逐步指引
   * @private
   */
  _buildSteps(functionName) {
    return [
      '① 先看上面的錯誤訊息,多數原因出在 Drive(例如表單重複、資料夾缺漏)',
      '② 修正原因後,點下方按鈕開啟 Apps Script 專案',
      `③ 在上方函式選單選「${functionName}」→ 按「執行」重跑這一步`,
      '④ 若出現「排程還沒收乾淨」,先執行 listAllTriggers() 查看,',
      '   確認無誤再執行 clearDynamicTriggers() 清除後重試',
    ].join('\n');
  }

  /**
   * 組出通知卡片的按鈕:直接連到要去處理的兩個地方
   * @private
   */
  _buildActions() {
    const actions = [];

    if (this._scriptUrl) {
      actions.push({ text: '開啟 Apps Script 專案', url: this._scriptUrl });
    }
    if (this._driveUrl) {
      actions.push({ text: '開啟 scrum 資料夾', url: this._driveUrl });
    }

    return actions;
  }
}


/* ========== 🎯 全域入口(給 catch 區塊呼叫) ========== */

/**
 * 發送流程失敗通知,絕不拋錯
 *
 * 組裝依賴與發送都包在 try/catch 裡 —— 取不到 scriptId、webhook 沒設定、
 * 甚至 Chat 服務掛掉,都只會寫 log,不會蓋掉原本要回報的那個錯誤。
 *
 * @param {string} functionName - 失敗的函式名稱
 * @param {string} description - 這一步在做什麼
 * @param {Error} error - 捕捉到的例外
 */
function notifyFailure(functionName, description, error) {
  try {
    const webhookUrl = PropertiesService.getScriptProperties()
      .getProperty('RETRO_CHAT_WEBHOOK_URL');

    new FailureNotifier(
      webhookUrl,
      _scriptProjectUrl(),
      _scrumFolderUrl()
    ).notify(functionName, description, error);
  } catch (notifyError) {
    Logger.log(`⚠️ 失敗通知本身也失敗了:${notifyError.message}`);
  }
}

/**
 * Apps Script 專案編輯畫面網址,取不到就回傳空字串(少一顆按鈕而已)
 * @private
 */
function _scriptProjectUrl() {
  let url = '';

  try {
    url = `https://script.google.com/home/projects/${ScriptApp.getScriptId()}/edit`;
  } catch (error) {
    Logger.log(`⚠️ 取得 Apps Script 專案連結失敗:${error.message}`);
  }

  return url;
}

/**
 * scrum 根資料夾網址,取不到就回傳空字串
 * @private
 */
function _scrumFolderUrl() {
  let url = '';

  try {
    url = `https://drive.google.com/drive/folders/${SPRINT_OPTIONS.sprintRootFolderId}`;
  } catch (error) {
    Logger.log(`⚠️ 取得 Drive 資料夾連結失敗:${error.message}`);
  }

  return url;
}
