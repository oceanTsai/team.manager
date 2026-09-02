/**
 * ============================================================
 * SprintFinder.gs - 在 Drive 上定位 Sprint 資料夾與表單
 * ============================================================
 * 📦 屬於 retrospective
 *
 * 職責:
 *   把 Drive 的資料夾結構翻譯成 Sprint 資料。只讀不寫。
 *
 * ⚠️ 不做這些事:
 *   不推算日期(SprintPlanner)、不建立任何東西(SprintFolderBuilder)。
 *
 * ⚠️ 跨年處理有「兩層」,不要混淆:
 *   1. 名稱跨年:資料夾叫 1228-0108(起月 12 > 迄月 01),
 *      代表結束日落在隔年 → parseFolder() 處理
 *   2. 資料夾跨年:Sprint 依「開始日」的年份歸檔,所以 1228-0108 存在
 *      2026/ 底下,但它要到 2027/01/08 才結束。今天是 2027 年時,
 *      只看 2027/ 就會找不到它 → 所以 listRecent() 同時掃今年與去年。
 *
 *   基準年一律取「Sprint 所在的年度資料夾年份」,不是今天的年份。
 *   用今天的年份當基準會讓 1228-0108 在 2027 年被算成 2028/01/08,錯一整年。
 *
 * 為什麼只找「今年 + 去年」而不是掃所有年度資料夾:
 *   Sprint 週期兩週,最新的一個只可能落在這兩年。兩年都找不到代表流程已經
 *   中斷超過一年,這時「拋錯停下來」才是對的 —— SprintPlanner 是從「上一個
 *   結束日」往後推算,硬撈出更舊的 Sprint 只會算出一個日期在過去的新 Sprint。
 * ============================================================
 */


class SprintFinder {

  /**
   * @param {Object} drive - Infra.createDriveClient() 建立的 client
   * @param {string} sprintRootFolderId - scrum 根資料夾 ID
   */
  constructor(drive, sprintRootFolderId) {
    this._drive  = drive;
    this._rootId = sprintRootFolderId;
  }


  /* ========== 🔍 公開方法 ========== */

  /**
   * 找出結束日最晚的 Sprint
   *
   * @returns {{folder, name: string, folderId: string, startDate: Date, endDate: Date}}
   * @throws {Error} 今年與去年都找不到時
   */
  findLatest() {
    const recent = this.listRecent();

    if (recent.length === 0) {
      const thisYear = new Date().getFullYear();
      throw new Error(
        `在 ${thisYear} 與 ${thisYear - 1} 年度資料夾都找不到符合 MMDD-MMDD 格式的 Sprint。\n` +
        '正常運作下不該發生。若是第一次啟用,請執行 createSprintFolder() 建立第一個。'
      );
    }

    return recent[0];
  }

  /**
   * 列出今年與去年的所有 Sprint,依結束日由新到舊
   *
   * 含去年是為了涵蓋跨年 Sprint —— 它依開始日歸檔在去年的資料夾,
   * 但要到今年 1 月才結束,這段期間它仍是最新的 Sprint。
   *
   * @returns {Array<{folder, name, folderId, startDate, endDate}>}
   */
  listRecent() {
    const thisYear = new Date().getFullYear();

    return [
      ...this.listByYear(thisYear),
      ...this.listByYear(thisYear - 1),
    ].sort((a, b) => b.endDate - a.endDate);
  }

  /**
   * 列出單一年度資料夾裡的所有 Sprint
   *
   * @param {number} year - 年度資料夾名稱,同時也是解析日期的基準年
   * @returns {Array<{folder, name, folderId, startDate, endDate}>}
   *          年度資料夾不存在、或裡面沒有 Sprint,都回傳空陣列(不拋錯)
   */
  listByYear(year) {
    const yearFolder = this._drive.findFolderByName(this._rootId, String(year));
    const sprints    = [];

    if (yearFolder) {
      this._drive.listFolders(yearFolder.getId()).forEach((folder) => {
        const sprint = SprintFinder.parseFolder(folder, year);
        if (sprint) {
          sprints.push(sprint);
        }
      });
    }

    return sprints;
  }

  /**
   * 在指定資料夾內找唯一的 Google 表單
   *
   * @param {string} folderId - 通常是 Sprint 資料夾
   * @returns {GoogleAppsScript.Drive.File}
   * @throws {Error} 找不到表單,或找到超過一個
   */
  findForm(folderId) {
    const files = this._drive.findFilesByMimeType(folderId, Infra.DriveMime.FORM);

    if (files.length === 0) {
      throw new Error('Sprint 資料夾內找不到 Google 表單');
    }
    if (files.length > 1) {
      throw new Error('Sprint 資料夾內有多個 Google 表單,請只保留一個');
    }

    return files[0];
  }


  /* ========== 🧮 靜態:純解析,不碰 Drive ========== */

  /**
   * 解析 Sprint 資料夾名稱(MMDD-MMDD)
   *
   * @param {GoogleAppsScript.Drive.Folder} folder
   * @param {number} baseYear - 必須是「這個資料夾所在的年度資料夾」的年份
   * @returns {{folder, name, folderId, startDate, endDate}|null}
   *          名稱不符格式時回傳 null
   */
  static parseFolder(folder, baseYear) {
    const name   = folder.getName();
    const match  = name.match(/^(\d{2})(\d{2})-(\d{2})(\d{2})$/);
    let   sprint = null;

    if (match) {
      const [, startMonth, startDay, endMonth, endDay] = match.map(Number);
      const startDate = new Date(baseYear, startMonth - 1, startDay);
      const endDate   = new Date(baseYear, endMonth - 1, endDay);

      // 名稱跨年:起月 > 迄月(例如 1228-0108)代表結束日在隔年
      if (startMonth > endMonth) {
        endDate.setFullYear(baseYear + 1);
      }

      sprint = { folder, name, folderId: folder.getId(), startDate, endDate };
    }

    return sprint;
  }
}
