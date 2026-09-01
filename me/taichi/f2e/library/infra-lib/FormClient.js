/**
 * ============================================================
 * FormClient.gs - Google Form API 客戶端
 * ============================================================
 * 📦 屬於 WorkspaceLib 函式庫
 *
 * 設計模式:Factory Function Pattern
 *   - Class 定義在內部
 *   - 對外暴露 createFormClient() 工廠函式
 *
 * 對外能力:
 *   📝 取得:open / getTitle / getDescription / getEditUrl / getPublishedUrl
 *   ✏️ 編輯:setTitle / setDescription
 *   🌐 發布:publish / unpublish / isPublished
 *   ⚙️ 控制:setAcceptingResponses / isAcceptingResponses
 *   🔗 連結:linkToSheet / unlinkSheet / getLinkedSheetId
 *   📊 回應:getResponses / getResponseCount / deleteAllResponses
 * ============================================================
 */


/* ========== 🏗️ 內部 Class 定義(不直接對外) ========== */

class FormClient {

  constructor() {
    /** @private @type {Object<string, GoogleAppsScript.Forms.Form>} */
    this._formCache = {};
  }


  /* ========== 📝 取得表單 ========== */

  /**
   * 依 ID 開啟表單(有快取)
   * @param {string} formId
   * @returns {GoogleAppsScript.Forms.Form}
   */
  open(formId) {
    if (!this._formCache[formId]) {
      this._formCache[formId] = FormApp.openById(formId);
    }
    return this._formCache[formId];
  }

  /**
   * 取得表單標題
   * @param {string} formId
   * @returns {string}
   */
  getTitle(formId) {
    return this.open(formId).getTitle();
  }

  /**
   * 取得表單說明
   * @param {string} formId
   * @returns {string}
   */
  getDescription(formId) {
    return this.open(formId).getDescription();
  }

  /**
   * 取得編輯網址
   * @param {string} formId
   * @returns {string}
   */
  getEditUrl(formId) {
    return this.open(formId).getEditUrl();
  }

  /**
   * 取得發布網址
   * @param {string} formId
   * @returns {string}
   */
  getPublishedUrl(formId) {
    return this.open(formId).getPublishedUrl();
  }


  /* ========== ✏️ 編輯表單 ========== */

  /**
   * 設定表單標題
   * @param {string} formId
   * @param {string} title
   * @returns {GoogleAppsScript.Forms.Form}
   */
  setTitle(formId, title) {
    const form = this.open(formId);
    form.setTitle(title);
    return form;
  }

  /**
   * 設定表單說明
   * @param {string} formId
   * @param {string} description
   * @returns {GoogleAppsScript.Forms.Form}
   */
  setDescription(formId, description) {
    const form = this.open(formId);
    form.setDescription(description);
    return form;
  }


  /* ========== 🌐 發布控制 ========== */

  /**
   * 發布表單(允許使用者填寫)
   * 對應 Google Form UI 上的「發布」按鈕
   * @param {string} formId
   * @returns {GoogleAppsScript.Forms.Form}
   */
  publish(formId) {
    const form = this.open(formId);
    form.setPublished(true);
    return form;
  }

  /**
   * 取消發布表單(停止接受填寫)
   * @param {string} formId
   * @returns {GoogleAppsScript.Forms.Form}
   */
  unpublish(formId) {
    const form = this.open(formId);
    form.setPublished(false);
    return form;
  }

  /**
   * 是否已發布
   * @param {string} formId
   * @returns {boolean}
   */
  isPublished(formId) {
    return this.open(formId).isPublished();
  }


  /* ========== ⚙️ 控制接收狀態 ========== */

  /**
   * 設定表單是否接受回應
   * @param {string} formId
   * @param {boolean} accepting
   * @returns {GoogleAppsScript.Forms.Form}
   */
  setAcceptingResponses(formId, accepting) {
    const form = this.open(formId);
    form.setAcceptingResponses(accepting);
    return form;
  }

  /**
   * 是否正在接受回應
   * @param {string} formId
   * @returns {boolean}
   */
  isAcceptingResponses(formId) {
    return this.open(formId).isAcceptingResponses();
  }


  /* ========== 🔗 連結試算表 ========== */

  /**
   * 將表單回應連結到指定試算表
   * @param {string} formId
   * @param {string} spreadsheetId
   * @returns {GoogleAppsScript.Forms.Form}
   */
  linkToSheet(formId, spreadsheetId) {
    const form = this.open(formId);
    form.setDestination(FormApp.DestinationType.SPREADSHEET, spreadsheetId);
    return form;
  }

  /**
   * 解除與試算表的連結
   * @param {string} formId
   * @returns {GoogleAppsScript.Forms.Form}
   */
  unlinkSheet(formId) {
    const form = this.open(formId);
    form.removeDestination();
    return form;
  }

  /**
   * 取得連結的試算表 ID
   * @param {string} formId
   * @returns {string|null}
   */
  getLinkedSheetId(formId) {
    try {
      return this.open(formId).getDestinationId();
    } catch (e) {
      return null;
    }
  }


  /* ========== 📊 回應資料 ========== */

  /**
   * 取得所有回應
   * @param {string} formId
   * @returns {GoogleAppsScript.Forms.FormResponse[]}
   */
  getResponses(formId) {
    return this.open(formId).getResponses();
  }

  /**
   * 取得回應數量
   * @param {string} formId
   * @returns {number}
   */
  getResponseCount(formId) {
    return this.getResponses(formId).length;
  }

  /**
   * 清空所有回應(慎用)
   * @param {string} formId
   */
  deleteAllResponses(formId) {
    this.open(formId).deleteAllResponses();
  }
}


/* ========== 🏭 工廠函式(對外暴露給 Library 引用方) ========== */

/**
 * 建立 FormClient 實例
 *
 * @example
 *   const form = Workspace.createFormClient();
 *   form.setTitle(formId, '新標題');
 *
 * @returns {FormClient}
 */
function createFormClient() {
  return new FormClient();
}