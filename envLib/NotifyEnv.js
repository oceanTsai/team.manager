// ==========================================================================
// NotifyEnv.gs - 通知相關環境變數 Library(動態 class,單例模式)
// --------------------------------------------------------------------------
// 集中管理所有「通知管道」相關的環境變數。
// 目前包含 Google Chat 的 Webhook URL,未來可擴充其他管道
// (Slack、Email、Teams 等)。
//
// 環境變數命名規則(放在「使用此 Library 的主專案」的指令碼屬性):
//   JIRA_MESSAGE_WEBHOOK_URL  → Google Chat incoming webhook URL
//
// 外部使用範例(假設掛載識別名為 Env):
//   const notify = Env.notifyEnv();      // 取得單例
//   const url = notify.getJiraMessageWebhookUrl();
//   notify.printStatus();
// ==========================================================================


// ==========================================================================
// NotifyEnv (動態 class)
// --------------------------------------------------------------------------
// 透過 new 建立 instance,所有方法都是 instance method。
// 使用單例模式管理:外部用 notifyEnv() 取得唯一實例。
// ==========================================================================
class NotifyEnv {

  /**
   * 建構子:不接受參數,所有環境變數從 PropertiesService 讀取
   */
  constructor() {
    /**
     * 環境變數清單(集中管理,加新通知管道時在這裡登記)
     * required = true → 沒設會拋錯
     * required = false → 沒設回傳 null
     */
    this.envKeys = [
      {
        key: 'JIRA_MESSAGE_WEBHOOK_URL',
        required: false,
        description: 'Google Chat Webhook URL (Jira 相關通知)'
      }
      // 未來新增的通知管道在這裡加,例如:
      // { key: 'SLACK_WEBHOOK_URL', required: false, description: 'Slack Webhook URL' },
      // { key: 'NOTIFY_EMAIL_TO',  required: false, description: 'Email 通知收件人' }
    ];
  }

  // ------------------------------------------------------------------------
  // 公開 API
  // ------------------------------------------------------------------------

  /**
   * 取得 Jira 相關通知的 Google Chat Webhook URL
   * @return {string|null} 沒設定回傳 null
   */
  getJiraMessageWebhookUrl() {
    return this._getOptional('JIRA_MESSAGE_WEBHOOK_URL');
  }

  // ------------------------------------------------------------------------
  // 工具方法
  // ------------------------------------------------------------------------

  /**
   * 取得所有環境變數的設定狀態
   * @return {Array<{key:string, hasValue:boolean, required:boolean, description:string}>}
   */
  status() {
    const props = PropertiesService.getScriptProperties();
    return this.envKeys.map(item => ({
      key: item.key,
      hasValue: !!props.getProperty(item.key),
      required: item.required,
      description: item.description
    }));
  }

  /**
   * 列印環境變數設定狀態到 Logger
   */
  printStatus() {
    Logger.log('========== NotifyEnv 環境變數設定狀態 ==========');
    this.status().forEach(s => {
      const symbol = s.hasValue ? '✓' : (s.required ? '✗' : '○');
      const reqText = s.required ? '[必填]' : '[選填]';
      Logger.log(`${symbol} ${reqText} ${s.key.padEnd(28)} - ${s.description}`);
    });
    Logger.log('------------------------------------------------');
    Logger.log('符號:✓ 已設定  ✗ 必填但未設定  ○ 選填未設定');
  }

  // ------------------------------------------------------------------------
  // 私有方法
  // ------------------------------------------------------------------------

  /**
   * 取得必填環境變數,沒設就拋錯
   * @private
   */
  _getRequired(key) {
    const value = PropertiesService.getScriptProperties().getProperty(key);
    if (!value) {
      throw new Error(
        `必要的指令碼屬性「${key}」尚未設定。\n` +
        `請到「專案設定 → 指令碼屬性」新增 ${key}`
      );
    }
    return value;
  }

  /**
   * 取得選填環境變數,沒設回傳 null
   * @private
   */
  _getOptional(key) {
    return PropertiesService.getScriptProperties().getProperty(key);
  }
}


// ==========================================================================
// 單例存放區
// ==========================================================================
let _notifyEnvInstance = null;


// ==========================================================================
// 對外暴露的頂層 API
// ==========================================================================

/**
 * 取得 NotifyEnv 單例 instance
 * @return {NotifyEnv}
 */
function notifyEnv() {
  if (!_notifyEnvInstance) {
    _notifyEnvInstance = new NotifyEnv();
  }
  return _notifyEnvInstance;
}

function testNotifyEnv(){
  notifyEnv().printStatus()
}