// ==========================================================================
// JiraIdentityLib.gs - Jira 使用者身份 Library(動態 class,單例模式)
// --------------------------------------------------------------------------
// 集中管理 Jira 相關的環境變數(URL、admin 認證、各使用者 email/token),
// 讓呼叫端能選一個具名使用者的身份去操作 Jira。
//
// 環境變數命名規則(放在「使用此 Library 的主專案」的指令碼屬性):
//   JIRA_URL              → Jira 網域(全域共用)
//   JIRA_EMAIL            → Admin(部長)的 email
//   JIRA_TOKEN            → Admin(部長)的 token
//   JIRA_EMAIL_OCEAN      → AdminLead(課長)的 email
//   JIRA_TOKEN_OCEAN      → AdminLead(課長)的 token
//   JIRA_EMAIL_{KEY}      → 該位 user 的 email
//   JIRA_TOKEN_{KEY}      → 該位 user 的 token
//
// 外部使用範例(假設掛載識別名為 JiraIdentityLib):
//   const jira = JiraIdentityLib.jiraIdentityLib();
//
//   // 部長 admin
//   const admin = jira.getAdmin();
//   admin.email / admin.token / admin.authHeaders
//
//   // 課長 admin
//   const lead = jira.getAdminLead();
//   lead.email / lead.token / lead.authHeaders
//
//   // 一般查詢
//   const token = jira.getToken('BRIAN');
//   const email = jira.getEmail('BRIAN');
//
//   // 個人 getter
//   const brian = jira.getBrian();
//   brian.email / brian.token / brian.authHeaders
//
//   // 診斷
//   jira.printStatus();
// ==========================================================================


// ==========================================================================
// User Enum
// --------------------------------------------------------------------------
// 集中定義所有使用者識別碼,搭配環境變數命名規則:
//   JIRA_EMAIL_{value}  /  JIRA_TOKEN_{value}
// ==========================================================================
const User = Object.freeze({
  OCEAN:   'OCEAN',
  AGNES:   'AGNES',
  BRIAN:   'BRIAN',
  ENYA:    'ENYA',
  JUNE:    'JUNE',
  PEDRO:   'PEDRO',
  SAMURA:  'SAMURA',
  STEVEN:  'STEVEN',
  WILLIAM: 'WILLIAM'
});


// ==========================================================================
// JiraIdentityLib (動態 class)
// --------------------------------------------------------------------------
// 透過 new 建立 instance,所有方法都是 instance method。
// 使用單例模式管理:外部用 jiraIdentityLib() 取得唯一實例。
// ==========================================================================
class JiraIdentityLib {

  constructor() {
    // 預留:未來如果要做 eager load 或快取,可在此處初始化
  }

  // ------------------------------------------------------------------------
  // Jira 網域
  // ------------------------------------------------------------------------

  /**
   * 取得 Jira 網域(必填)
   * @return {string}
   */
  getJiraUrl() {
    return JiraIdentityLib._getRequired('JIRA_URL');
  }

  // ------------------------------------------------------------------------
  // Admin getter
  // ------------------------------------------------------------------------

  /**
   * 取得部長 admin 的完整認證資料
   * 對應環境變數 JIRA_EMAIL / JIRA_TOKEN
   * @return {{email:string, token:string, authHeaders:Object}}
   */
  getAdmin() {
    const email = JiraIdentityLib._getRequired('JIRA_EMAIL');
    const token = JiraIdentityLib._getRequired('JIRA_TOKEN');
    return {
      email: email,
      token: token,
      authHeaders: JiraIdentityLib._buildAuthHeaders(email, token)
    };
  }

  /**
   * 取得課長 admin 的完整認證資料
   * 對應環境變數 JIRA_EMAIL_OCEAN / JIRA_TOKEN_OCEAN
   * @return {{email:string, token:string, authHeaders:Object}}
   */
  getAdminLead() {
    const email = JiraIdentityLib._getRequired('JIRA_EMAIL_OCEAN');
    const token = JiraIdentityLib._getRequired('JIRA_TOKEN_OCEAN');
    return {
      email: email,
      token: token,
      authHeaders: JiraIdentityLib._buildAuthHeaders(email, token)
    };
  }

  // ------------------------------------------------------------------------
  // 通用 API:用 User key 查詢
  // ------------------------------------------------------------------------

  /**
   * 取得指定 user 的 email
   * @param {string} userKey - User enum 的值,例如 'BRIAN'
   * @return {string}
   */
  getEmail(userKey) {
    return JiraIdentityLib._getRequired(`JIRA_EMAIL_${userKey}`);
  }

  /**
   * 取得指定 user 的 token
   * @param {string} userKey
   * @return {string}
   */
  getToken(userKey) {
    return JiraIdentityLib._getRequired(`JIRA_TOKEN_${userKey}`);
  }

  /**
   * 取得指定 user 的完整認證資料(email、token、authHeaders)
   * @param {string} userKey
   * @return {{email:string, token:string, authHeaders:Object}}
   */
  getUser(userKey) {
    const email = this.getEmail(userKey);
    const token = this.getToken(userKey);
    return {
      email: email,
      token: token,
      authHeaders: JiraIdentityLib._buildAuthHeaders(email, token)
    };
  }

  // ------------------------------------------------------------------------
  // 個人 getter(語法糖)
  // ------------------------------------------------------------------------

  getOcean()   { return this.getUser(User.OCEAN); }
  getAgnes()   { return this.getUser(User.AGNES); }
  getBrian()   { return this.getUser(User.BRIAN); }
  getEnya()    { return this.getUser(User.ENYA); }
  getJune()    { return this.getUser(User.JUNE); }
  getPedro()   { return this.getUser(User.PEDRO); }
  getSamura()  { return this.getUser(User.SAMURA); }
  getSteven()  { return this.getUser(User.STEVEN); }
  getWilliam() { return this.getUser(User.WILLIAM); }

  // ------------------------------------------------------------------------
  // 工具方法
  // ------------------------------------------------------------------------

  /**
   * 取得所有環境變數的設定狀態(用於診斷)
   * @return {Array<{key:string, hasValue:boolean}>}
   */
  status() {
    const props = PropertiesService.getScriptProperties();
    const keys = [
      'JIRA_URL',
      'JIRA_EMAIL', 'JIRA_TOKEN'
    ];
    Object.values(User).forEach(u => {
      keys.push(`JIRA_EMAIL_${u}`);
      keys.push(`JIRA_TOKEN_${u}`);
    });
    return keys.map(k => ({
      key: k,
      hasValue: !!props.getProperty(k)
    }));
  }

  /**
   * 列印環境變數設定狀態到 Logger
   */
  printStatus() {
    Logger.log('========== JiraIdentityLib 環境變數設定狀態 ==========');
    this.status().forEach(s => {
      const symbol = s.hasValue ? '✓' : '✗';
      Logger.log(`${symbol} ${s.key}`);
    });
    Logger.log('----------------------------------------------');
    Logger.log('符號:✓ 已設定  ✗ 尚未設定');
  }

  // ------------------------------------------------------------------------
  // 私有靜態方法
  // ------------------------------------------------------------------------

  /**
   * 取得必填環境變數,沒設就拋錯
   * @private
   */
  static _getRequired(key) {
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
   * 建立 Basic Auth headers
   * @private
   */
  static _buildAuthHeaders(email, token) {
    const auth = 'Basic ' + Utilities.base64Encode(`${email}:${token}`);
    return {
      'Authorization': auth,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
  }
}


// ==========================================================================
// 單例存放區
// ==========================================================================
let _jiraIdentityLibInstance = null;


// ==========================================================================
// 對外暴露的頂層 API
// ==========================================================================

function jiraIdentityLib() {
  if (!_jiraIdentityLibInstance) {
    _jiraIdentityLibInstance = new JiraIdentityLib();
  }
  return _jiraIdentityLibInstance;
}

function getJiraUrl()       { return jiraIdentityLib().getJiraUrl(); }
function getAdmin()         { return jiraIdentityLib().getAdmin(); }
function getAdminLead()     { return jiraIdentityLib().getAdminLead(); }
function getEmail(userKey)  { return jiraIdentityLib().getEmail(userKey); }
function getToken(userKey)  { return jiraIdentityLib().getToken(userKey); }
function getUser(userKey)   { return jiraIdentityLib().getUser(userKey); }

function getOcean()   { return jiraIdentityLib().getOcean(); }
function getAgnes()   { return jiraIdentityLib().getAgnes(); }
function getBrian()   { return jiraIdentityLib().getBrian(); }
function getEnya()    { return jiraIdentityLib().getEnya(); }
function getJune()    { return jiraIdentityLib().getJune(); }
function getPedro()   { return jiraIdentityLib().getPedro(); }
function getSamura()  { return jiraIdentityLib().getSamura(); }
function getSteven()  { return jiraIdentityLib().getSteven(); }
function getWilliam() { return jiraIdentityLib().getWilliam(); }

function status()      { return jiraIdentityLib().status(); }
function printStatus() { jiraIdentityLib().printStatus(); }
