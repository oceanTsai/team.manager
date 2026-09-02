/**
 * ============================================================
 * SprintFolderBuilder.gs - 建立 Sprint 資料夾與複製檔案
 * ============================================================
 * 📦 屬於 retrospective
 *
 * 職責:
 *   給名稱和年份,就把資料夾建好、樣板複製進去。
 *
 * ⚠️ 不做這些事:
 *   不推算日期(SprintPlanner)、不排程、不發通知。
 *   呼叫端說要建什麼就建什麼,不會自己決定「其實你應該建別的」。
 *
 * ♻️ 可重複執行:
 *   每一步都先檢查存不存在,已存在就沿用/跳過,不會拋「已存在」的錯。
 *   所以上次建到一半失敗,再跑一次就會把缺的補齊,不用去 Drive 手動刪。
 * ============================================================
 */


class SprintFolderBuilder {

  /**
   * @param {Object} drive - Infra.createDriveClient() 建立的 client
   * @param {Object} formClient - Infra.createFormClient() 建立的 client
   * @param {string} sprintRootFolderId - scrum 根資料夾 ID
   * @param {string} templateFolderId - 樣板資料夾 ID
   */
  constructor(drive, formClient, sprintRootFolderId, templateFolderId) {
    this._drive      = drive;
    this._form       = formClient;
    this._rootId     = sprintRootFolderId;
    this._templateId = templateFolderId;
  }


  /* ========== 🏗️ 公開方法 ========== */

  /**
   * 建立(或補齊)一個 Sprint 回顧資料夾
   *
   * @param {number} year - 年度資料夾,例如 2026
   * @param {string} sprintName - Sprint 名稱,例如 '0622-0703'
   * @returns {{sprintName: string, folderId: string, folderUrl: string,
   *            formId: string, formUrl: string, slideUrl: string,
   *            created: {folder: boolean, form: boolean, slide: boolean}}}
   *          created 標示這次「真的建立」了哪些,false 代表本來就存在
   */
  build(year, sprintName) {
    const yearFolderId = this._resolveYearFolder(year);
    const templates    = this._loadTemplates();

    const folder = this._ensureFolder(yearFolderId, sprintName);
    const form   = this._ensureForm(folder.item.getId(), sprintName, templates.form);
    const slide  = this._ensureSlide(folder.item.getId(), sprintName, templates.slide);

    return {
      sprintName: sprintName,
      folderId:   folder.item.getId(),
      folderUrl:  folder.item.getUrl(),
      formId:     form.item.getId(),
      formUrl:    form.item.getUrl(),
      slideUrl:   slide.item.getUrl(),
      created: {
        folder: folder.created,
        form:   form.created,
        slide:  slide.created,
      },
    };
  }

  /**
   * 檢查根資料夾與樣板設定是否正確(唯讀,不會建立任何東西)
   *
   * @returns {boolean} 全部通過才回傳 true
   */
  validateSetup() {
    let passed = true;

    Logger.log('🔍 檢查建立設定...');

    try {
      Logger.log(`✅ scrum 根資料夾:${this._drive.getFolder(this._rootId).getName()}`);
    } catch (error) {
      Logger.log(`❌ 根資料夾錯誤:${error.message}`);
      passed = false;
    }

    try {
      Logger.log(`✅ 樣板資料夾:${this._drive.getFolder(this._templateId).getName()}`);
      const templates = this._loadTemplates();
      Logger.log(`   ✅ 表單範本:${templates.form.getName()}`);
      Logger.log(`   ✅ 投影片範本:${templates.slide.getName()}`);
    } catch (error) {
      Logger.log(`❌ 樣板資料夾錯誤:${error.message}`);
      passed = false;
    }

    Logger.log(passed ? '✅ 設定檢查通過' : '❌ 設定檢查失敗');
    return passed;
  }


  /* ========== 🔒 私有 ========== */

  /**
   * 找年度資料夾,不存在就建立
   * @private
   * @returns {string} 年度資料夾 ID
   */
  _resolveYearFolder(year) {
    const yearStr = String(year);
    let   folder  = this._drive.findFolderByName(this._rootId, yearStr);

    if (!folder) {
      Logger.log(`📁 ${yearStr} 年度資料夾不存在,自動建立`);
      folder = this._drive.createFolder(this._rootId, yearStr);
    }

    return folder.getId();
  }

  /**
   * Sprint 資料夾:已存在就沿用
   * @private
   * @returns {{item: GoogleAppsScript.Drive.Folder, created: boolean}}
   */
  _ensureFolder(yearFolderId, sprintName) {
    let folder  = this._drive.findFolderByName(yearFolderId, sprintName);
    let created = false;

    if (folder) {
      Logger.log(`📁 資料夾已存在,沿用:${sprintName}`);
    } else {
      folder  = this._drive.createFolder(yearFolderId, sprintName);
      created = true;
      Logger.log(`📁 已建立資料夾:${folder.getUrl()}`);
    }

    return { item: folder, created: created };
  }

  /**
   * 表單:已存在就跳過,新複製的要同步改內部標題
   * @private
   * @returns {{item: GoogleAppsScript.Drive.File, created: boolean}}
   */
  _ensureForm(folderId, sprintName, template) {
    let file    = this._drive.findFileByName(folderId, sprintName);
    let created = false;

    if (file) {
      Logger.log(`📝 表單已存在,跳過複製:${file.getName()}`);
    } else {
      file = this._drive.copyFile(template.getId(), sprintName, folderId);
      this._form.setTitle(file.getId(), sprintName);
      created = true;
      Logger.log(`📝 已複製表單並更新標題:${file.getUrl()}`);
    }

    return { item: file, created: created };
  }

  /**
   * 投影片:已存在就跳過
   * @private
   * @returns {{item: GoogleAppsScript.Drive.File, created: boolean}}
   */
  _ensureSlide(folderId, sprintName, template) {
    const slideName = `${sprintName}回顧`;
    let   file      = this._drive.findFileByName(folderId, slideName);
    let   created   = false;

    if (file) {
      Logger.log(`📊 投影片已存在,跳過複製:${file.getName()}`);
    } else {
      file    = this._drive.copyFile(template.getId(), slideName, folderId);
      created = true;
      Logger.log(`📊 已複製投影片:${file.getUrl()}`);
    }

    return { item: file, created: created };
  }

  /**
   * 從樣板資料夾載入表單與投影片範本
   * @private
   * @throws {Error} 找不到、或找到多份時
   */
  _loadTemplates() {
    const mime  = Infra.DriveMime;
    const files = this._drive.listFiles(this._templateId);
    let   form  = null;
    let   slide = null;

    files.forEach((file) => {
      const type = file.getMimeType();

      if (type === mime.FORM) {
        if (form) {
          throw new Error('樣板資料夾內有多個表單,請只保留一個');
        }
        form = file;
      } else if (type === mime.PRESENTATION || type === mime.PPTX) {
        if (slide) {
          throw new Error('樣板資料夾內有多個投影片,請只保留一個');
        }
        slide = file;
      }
    });

    if (!form) {
      throw new Error('樣板資料夾內找不到 Google 表單範本');
    }
    if (!slide) {
      throw new Error('樣板資料夾內找不到投影片範本(.pptx 或 Google 簡報)');
    }

    return { form, slide };
  }
}
