/**
 * ============================================================
 * RetroSprintService.gs - Sprint 回顧自動化業務邏輯
 * ============================================================
 * Sprint 業務規則 + 主流程編排
 *
 * 依賴外部 Library:
 *   - InfraLib(識別碼:Infra)
 *     ► createDriveClient()
 *     ► createFormClient()
 *     ► DriveMime(常數)
 *
 * 業務規則:
 *   1. Sprint 資料夾命名格式:MMDD-MMDD
 *   2. Sprint 週期:週一開始,第二週週五結束(共 11 天差)
 *   3. 年份資料夾自動建立(跨年時自動處理)
 *   4. 範本檔案放在獨立的樣板資料夾,依 MIME 自動辨識
 *
 * 對外方法:
 *   - create()   🚀 建立下一個 Sprint
 *   - preview()  🧪 預覽下一個 Sprint 名稱
 *   - listAll()  📋 列出所有 Sprint 資料夾
 *   - validate() 🔍 驗證設定
 * ============================================================
 */

class RetroSprintService {

  /**
   * @param {Object} options
   * @param {string} options.templateFolderId  - 樣板資料夾 ID
   * @param {string} options.sprintRootFolderId - scrum 根資料夾 ID
   * @param {number} [options.sprintDays=11]   - Sprint 起訖日相差天數
   */
  constructor(options) {
    if (!options.templateFolderId)   throw new Error('❌ 請設定 templateFolderId');
    if (!options.sprintRootFolderId) throw new Error('❌ 請設定 sprintRootFolderId');

    this.templateFolderId   = options.templateFolderId;
    this.sprintRootFolderId = options.sprintRootFolderId;
    this.sprintDays         = options.sprintDays || 11;

    this.drive = Infra.createDriveClient();
    this.form  = Infra.createFormClient();

    // 今年的年份資料夾(自動找或建立)
    this.year         = new Date().getFullYear();
    this.parentFolderId = this._resolveYearFolder(this.year);
  }


  /* ========== 🚀 對外方法 ========== */

  /**
   * 建立下一個 Sprint
   * @returns {Object}
   */
  create() {
    Logger.log(`📅 年份:${this.year}`);

    // 1. 找最新 Sprint
    const latest = this._findLatestSprint();
    if (!latest) throw new Error('找不到符合 MMDD-MMDD 格式的資料夾,請先手動建立第一個');
    Logger.log(`📌 最新 Sprint:${latest.name}(結束於 ${this._formatDate(latest.endDate)})`);

    // 2. 計算下一個 Sprint
    const { start, end } = this._calcNextSprint(latest.endDate);
    const newName = `${this._formatMMDD(start)}-${this._formatMMDD(end)}`;
    Logger.log(`📆 下一個 Sprint:${newName}`);
    Logger.log(`   起始日:${this._formatDate(start)}(${this._formatWeekday(start)})`);
    Logger.log(`   結束日:${this._formatDate(end)}(${this._formatWeekday(end)})`);

    // 3. 如果 Sprint 跨年，切換到下一年度資料夾
    const targetFolderId = this._resolveYearFolder(start.getFullYear());
    if (targetFolderId !== this.parentFolderId) {
      Logger.log(`⚠️ 此 Sprint 跨年，切換到 ${start.getFullYear()} 年度資料夾`);
    }

    // 4. 載入範本
    const templates = this._loadTemplates();
    Logger.log(`📦 已載入範本:表單「${templates.form.getName()}」、投影片「${templates.slide.getName()}」`);

    // 5. 建立資料夾
    const newFolder = this.drive.createFolder(targetFolderId, newName);
    Logger.log(`📁 已建立資料夾:${newFolder.getUrl()}`);

    // 6. 複製表單(同步改內部標題)
    const copiedForm = this.drive.copyFile(templates.form.getId(), newName, newFolder.getId());
    this.form.setTitle(copiedForm.getId(), newName);
    Logger.log(`📝 已複製表單並更新標題:${copiedForm.getUrl()}`);

    // 7. 複製投影片
    const slideName = `${newName}回顧`;
    const copiedSlide = this.drive.copyFile(templates.slide.getId(), slideName, newFolder.getId());
    Logger.log(`📊 已複製投影片:${copiedSlide.getUrl()}`);

    // 8. 回傳結果
    const result = {
      sprintName: newName,
      startDate:  this._formatDate(start),
      endDate:    this._formatDate(end),
      folderUrl:  newFolder.getUrl(),
      formUrl:    copiedForm.getUrl(),
      slideUrl:   copiedSlide.getUrl(),
    };
    Logger.log('✅ 完成!');
    Logger.log(JSON.stringify(result, null, 2));
    return result;
  }

  /**
   * 預覽下一個 Sprint 名稱(不實際建立)
   * @returns {string|null}
   */
  preview() {
    const latest = this._findLatestSprint();
    if (!latest) {
      Logger.log('⚠️ 找不到任何符合格式的 Sprint 資料夾');
      return null;
    }

    Logger.log(`📌 最新 Sprint:${latest.name}`);
    Logger.log(`   起始日:${this._formatDate(latest.startDate)}(${this._formatWeekday(latest.startDate)})`);
    Logger.log(`   結束日:${this._formatDate(latest.endDate)}(${this._formatWeekday(latest.endDate)})`);

    const { start, end } = this._calcNextSprint(latest.endDate);
    const newName = `${this._formatMMDD(start)}-${this._formatMMDD(end)}`;
    Logger.log(`\n📆 下一個 Sprint:${newName}`);
    Logger.log(`   起始日:${this._formatDate(start)}(${this._formatWeekday(start)})`);
    Logger.log(`   結束日:${this._formatDate(end)}(${this._formatWeekday(end)})`);
    return newName;
  }

  /**
   * 列出所有 Sprint 資料夾
   * @returns {Array}
   */
  listAll() {
    const sprints = this._listAllSprints();
    Logger.log(`📋 在「${this.year}」中找到 ${sprints.length} 個 Sprint:`);
    sprints.forEach((s, i) => {
      const marker = i === 0 ? '⭐' : '  ';
      Logger.log(`${marker} ${s.name}(結束於 ${this._formatDate(s.endDate)})`);
    });
    return sprints;
  }

  /**
   * 驗證設定
   * @returns {boolean}
   */
  validate() {
    Logger.log('🔍 開始驗證設定...');
    let allPassed = true;

    try {
      const folder = this.drive.getFolder(this.templateFolderId);
      Logger.log(`✅ 樣板資料夾:${folder.getName()}`);
      try {
        const t = this._loadTemplates();
        Logger.log(`   ✅ 表單範本:${t.form.getName()}`);
        Logger.log(`   ✅ 投影片範本:${t.slide.getName()}`);
      } catch (e) {
        Logger.log(`   ❌ ${e.message}`);
        allPassed = false;
      }
    } catch (e) {
      Logger.log(`❌ 樣板資料夾錯誤:${e.message}`);
      allPassed = false;
    }

    try {
      const root = this.drive.getFolder(this.sprintRootFolderId);
      Logger.log(`✅ scrum 根資料夾:${root.getName()}`);
      Logger.log(`✅ 年份資料夾:${this.year}(ID: ${this.parentFolderId})`);
    } catch (e) {
      Logger.log(`❌ 根資料夾錯誤:${e.message}`);
      allPassed = false;
    }

    Logger.log(allPassed ? '✅ 全部驗證通過' : '❌ 驗證失敗');
    return allPassed;
  }


  /* ========== 🔒 業務規則(私有) ========== */

  /**
   * 找或建立指定年份的資料夾
   * @private
   * @param {number} year
   * @returns {string} 年份資料夾 ID
   */
  _resolveYearFolder(year) {
    const yearStr = String(year);
    let folder = this.drive.findFolderByName(this.sprintRootFolderId, yearStr);
    if (!folder) {
      Logger.log(`📁 ${yearStr} 年度資料夾不存在，自動建立`);
      folder = this.drive.createFolder(this.sprintRootFolderId, yearStr);
    }
    return folder.getId();
  }

  /** @private */
  _listAllSprints() {
    const folders = this.drive.listFolders(this.parentFolderId);
    const sprints = [];

    folders.forEach((folder) => {
      const sprint = this._parseSprintFolder(folder);
      if (sprint) sprints.push(sprint);
    });

    sprints.sort((a, b) => b.endDate - a.endDate);
    return sprints;
  }

  /** @private */
  _findLatestSprint() {
    const all = this._listAllSprints();
    return all.length > 0 ? all[0] : null;
  }

  /** @private */
  _parseSprintFolder(folder) {
    const name = folder.getName();
    const match = name.match(/^(\d{2})(\d{2})-(\d{2})(\d{2})$/);
    if (!match) return null;

    const [, startM, startD, endM, endD] = match.map(Number);
    const startDate = new Date(this.year, startM - 1, startD);
    const endDate   = new Date(this.year, endM - 1, endD);

    if (startM > endM) endDate.setFullYear(this.year + 1);

    return { folder, name, startDate, endDate };
  }

  /** @private */
  _calcNextSprint(lastEndDate) {
    const start = this._getNextMonday(lastEndDate);
    const end   = this._addDays(start, this.sprintDays);
    return { start, end };
  }

  /** @private */
  _getNextMonday(date) {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    while (next.getDay() !== 1) next.setDate(next.getDate() + 1);
    return next;
  }

  /** @private */
  _addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /** @private */
  _loadTemplates() {
    const M     = Infra.DriveMime;
    const files = this.drive.listFiles(this.templateFolderId);

    let form  = null;
    let slide = null;

    files.forEach((file) => {
      const mime = file.getMimeType();
      if (mime === M.FORM) {
        if (form) throw new Error('樣板資料夾內有多個表單,請只保留一個');
        form = file;
      } else if (mime === M.PRESENTATION || mime === M.PPTX) {
        if (slide) throw new Error('樣板資料夾內有多個投影片,請只保留一個');
        slide = file;
      }
    });

    if (!form)  throw new Error('樣板資料夾內找不到 Google 表單範本');
    if (!slide) throw new Error('樣板資料夾內找不到投影片範本(.pptx 或 Google 簡報)');

    return { form, slide };
  }


  /* ========== 🛠️ 格式化工具(私有) ========== */

  /** @private */
  _formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}/${m}/${d}`;
  }

  /** @private */
  _formatMMDD(date) {
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${m}${d}`;
  }

  /** @private */
  _formatWeekday(date) {
    const names = ['日', '一', '二', '三', '四', '五', '六'];
    return `週${names[date.getDay()]}`;
  }
}