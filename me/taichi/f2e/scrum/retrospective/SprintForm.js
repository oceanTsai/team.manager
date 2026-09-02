/**
 * ============================================================
 * SprintForm.gs - 某個 Sprint 的回顧表單
 * ============================================================
 * 📦 屬於 retrospective
 *
 * 職責:
 *   代表「某個 Sprint 資料夾裡的那份表單」,提供發布與讀取網址。
 *
 * ⚠️ 不做這些事:
 *   不排程、不發通知、不建立表單。那些是編排層與其他類別的事。
 *
 * ⚠️ 兩個網址不能混用:
 *   editUrl    = Drive 檔案網址 → 開啟的是「編輯」畫面
 *   previewUrl = 表單發布網址   → 開啟的是「填寫」畫面(團隊看到的)
 * ============================================================
 */


class SprintForm {

  /**
   * @param {Object} drive - Infra.createDriveClient() 建立的 client
   * @param {Object} formClient - Infra.createFormClient() 建立的 client
   * @param {GoogleAppsScript.Drive.File} formFile - 表單檔案(由 SprintFinder.findForm 取得)
   */
  constructor(drive, formClient, formFile) {
    this._drive = drive;
    this._form  = formClient;
    this._file  = formFile;
  }


  /* ========== 📝 公開方法 ========== */

  /**
   * 把表單設為已發布
   *
   * 已經是發布狀態就跳過,不拋錯 —— 所以重複執行是安全的。
   *
   * @returns {boolean} true 代表這次真的發布了,false 代表原本就已發布
   */
  publish() {
    let published = false;

    if (this.isPublished()) {
      Logger.log(`⚠️ 表單已發布,跳過:${this._file.getName()}`);
    } else {
      this._form.publish(this._file.getId());
      published = true;
      Logger.log(`✅ 表單已發布:${this._file.getName()}`);
    }

    return published;
  }

  /**
   * 表單目前是否為已發布狀態
   * @returns {boolean}
   */
  isPublished() {
    return this._form.isPublished(this._file.getId());
  }

  /**
   * 取得表單的識別資訊與兩個網址
   *
   * @returns {{formId: string, formName: string, previewUrl: string,
   *            editUrl: string, isPublished: boolean}}
   */
  describe() {
    const formId = this._file.getId();

    return {
      formId:      formId,
      formName:    this._file.getName(),
      previewUrl:  this._form.getPublishedUrl(formId),
      editUrl:     this._file.getUrl(),
      isPublished: this._form.isPublished(formId),
    };
  }
}
