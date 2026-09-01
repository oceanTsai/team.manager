/**
 * ============================================================
 * SprintFinder.gs - 共用的「找 Sprint 資料夾/表單」邏輯
 * ============================================================
 * 📦 屬於 SprintProject
 *
 * 背景:
 *   TriggerManager / prepareSprint / PublishTask / ReminderTask
 *   原本各自複製貼上一份「掃年份資料夾、比對 MMDD-MMDD、處理跨年」
 *   的邏輯,PublishTask / ReminderTask 也各自複製貼上一份「用 MIME
 *   類型找表單」的邏輯。這裡抽成共用函式,各處改成呼叫這裡。
 *
 * ⚠️ 跨年處理有「兩層」,不要混淆:
 *   1. 名稱跨年:資料夾叫 1228-0108(起月 12 > 迄月 01),
 *      代表結束日落在隔年 → parseSprintFolder() 處理
 *   2. 資料夾跨年:Sprint 依「開始日」的年份歸檔,所以 1228-0108 存在
 *      2026/ 底下,但它要到 2027/01/08 才結束。今天是 2027 年時,
 *      只看 2027/ 就會找不到它 → 因此要往前一年再找一次。
 *
 *   基準年一律取「Sprint 所在的年度資料夾年份」,不是今天的年份。
 *   用今天的年份當基準會讓 1228-0108 在 2027 年被算成 2028/01/08,錯一整年。
 *
 * 為什麼只找「今年 + 去年」而不是掃所有年度資料夾:
 *   Sprint 週期兩週,最新的一個只可能落在今年或去年(跨年那一個)。
 *   如果兩年都找不到,代表流程已經中斷超過一年,這時候「拋錯停下來」
 *   才是對的 —— 因為 _calcNextSprint() 是從「上一個結束日」往後推算,
 *   硬要撈出更舊的 Sprint 只會算出一個日期在過去的新 Sprint,
 *   把錯誤變成髒資料。
 *
 * 依賴外部 Library:
 *   - InfraLib(識別碼:Infra)
 * ============================================================
 */

/**
 * 解析單一 Sprint 資料夾名稱(MMDD-MMDD)。
 *
 * @param {GoogleAppsScript.Drive.Folder} folder - Sprint 資料夾
 * @param {number} baseYear - 基準年,必須是「這個資料夾所在的年度資料夾」的年份
 * @returns {{folder, name: string, folderId: string, startDate: Date, endDate: Date}|null}
 *          名稱不符合 MMDD-MMDD 格式時回傳 null
 */
function parseSprintFolder(folder, baseYear) {
  const name  = folder.getName();
  const match = name.match(/^(\d{2})(\d{2})-(\d{2})(\d{2})$/);
  let sprint  = null;

  if (match) {
    const [, startM, startD, endM, endD] = match.map(Number);
    const startDate = new Date(baseYear, startM - 1, startD);
    const endDate   = new Date(baseYear, endM - 1, endD);

    // 名稱跨年:起月 > 迄月(例如 1228-0108)代表結束日在隔年
    if (startM > endM) {
      endDate.setFullYear(baseYear + 1);
    }

    sprint = { folder, name, folderId: folder.getId(), startDate, endDate };
  }

  return sprint;
}

/**
 * 列出「單一年度資料夾」裡的所有 Sprint。
 *
 * @param {Object} drive - Infra.createDriveClient() 建立的 client
 * @param {string} sprintRootFolderId - scrum 根資料夾 ID
 * @param {number} year - 年度資料夾名稱,同時也是解析日期用的基準年
 * @returns {Array<{folder, name: string, folderId: string, startDate: Date, endDate: Date}>}
 *          年度資料夾不存在、或裡面沒有 Sprint,都回傳空陣列(不拋錯)
 */
function listSprintFoldersOfYear(drive, sprintRootFolderId, year) {
  const yearFolder = drive.findFolderByName(sprintRootFolderId, String(year));
  const sprints    = [];

  if (yearFolder) {
    drive.listFolders(yearFolder.getId()).forEach((folder) => {
      const sprint = parseSprintFolder(folder, year);
      if (sprint) {
        sprints.push(sprint);
      }
    });
  }

  return sprints;
}

/**
 * 列出「今年 + 去年」的所有 Sprint,依結束日由新到舊排序。
 *
 * 之所以要含去年:跨年 Sprint(例如 1228-0108)依開始日歸檔在去年的
 * 資料夾,但它要到今年 1 月才結束,這段期間它仍是最新的 Sprint。
 *
 * @param {Object} drive - Infra.createDriveClient() 建立的 client
 * @param {string} sprintRootFolderId - scrum 根資料夾 ID
 * @returns {Array<{folder, name: string, folderId: string, startDate: Date, endDate: Date}>}
 */
function listRecentSprintFolders(drive, sprintRootFolderId) {
  const thisYear = new Date().getFullYear();

  return [
    ...listSprintFoldersOfYear(drive, sprintRootFolderId, thisYear),
    ...listSprintFoldersOfYear(drive, sprintRootFolderId, thisYear - 1),
  ].sort((a, b) => b.endDate - a.endDate);
}

/**
 * 找出結束日最晚的 Sprint 資料夾。
 *
 * @param {Object} drive - Infra.createDriveClient() 建立的 client
 * @param {string} sprintRootFolderId - scrum 根資料夾 ID
 * @returns {{folder, name: string, folderId: string, startDate: Date, endDate: Date}}
 * @throws {Error} 今年與去年都找不到 Sprint(代表流程已中斷超過一年,應停下來人工確認)
 */
function findLatestSprintFolder(drive, sprintRootFolderId) {
  const recent = listRecentSprintFolders(drive, sprintRootFolderId);

  if (recent.length === 0) {
    const thisYear = new Date().getFullYear();
    throw new Error(
      `在 ${thisYear} 與 ${thisYear - 1} 年度資料夾都找不到符合 MMDD-MMDD 格式的 Sprint。\n` +
      '正常運作下不該發生,請確認資料夾結構,或手動建立第一個 Sprint 資料夾。'
    );
  }

  return recent[0];
}

/**
 * 在指定資料夾內找唯一的 Google Form(依 MIME 類型)。
 *
 * @param {Object} drive - Infra.createDriveClient() 建立的 client
 * @param {string} folderId - 要搜尋的資料夾 ID(通常是 Sprint 資料夾)
 * @returns {GoogleAppsScript.Drive.File}
 * @throws {Error} 找不到表單,或找到超過一個表單
 */
function findSprintForm(drive, folderId) {
  const files = drive.findFilesByMimeType(folderId, Infra.DriveMime.FORM);

  if (files.length === 0) {
    throw new Error('Sprint 資料夾內找不到 Google Form');
  }
  if (files.length > 1) {
    throw new Error('Sprint 資料夾內有多個 Google Form，請只保留一個');
  }

  return files[0];
}
