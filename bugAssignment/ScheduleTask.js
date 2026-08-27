// ScheduleTask.gs
// B Team 線上問題助理 — 排程任務
//
// 【負責的事】
//   每年 1 月 1 日自動從 template 複製樣板，建立當年度試算表
//
// 【觸發器設定方式】
//   GAS 左側時鐘圖示（觸發條件）→ 新增觸發條件
//   函式：copyTemplateForNewYear
//   觸發類型：時間驅動 → 年計時器 → 1月 → 1號
//
// 【資料夾結構】
//   線上問題/
//     template/
//       線上問題樣板   ← 來源（檔名需包含「樣板」）
//     2026/
//       2026_線上問題  ← 已存在
//     2027/
//       2027_線上問題  ← 每年自動建立

// ============================================================
// 設定（與主程式共用 CONFIG_DRIVE_ROOT_FOLDER_ID）
// ============================================================

/**
 * template 資料夾名稱
 * 如果你的 template 資料夾改名了，這裡同步修改
 */
const SCHEDULE_TEMPLATE_FOLDER_NAME = "template";

/**
 * 樣板試算表的檔名關鍵字
 * 程式會在 template 資料夾中找檔名包含此字串的試算表
 * 對應你的檔案：線上問題樣板
 */
const SCHEDULE_TEMPLATE_FILE_KEYWORD = "樣板";

/**
 * 新試算表的命名規則
 * {year} 會被替換成當年年份，例如 2027_線上問題
 */
const SCHEDULE_NEW_FILE_NAME = (year) => `${year}_線上問題`;

// ============================================================
// 排程函式
// ============================================================

/**
 * 從 template 資料夾複製樣板，建立當年度試算表
 *
 * 執行結果：
 *   線上問題/2027/2027_線上問題（Google Sheet）
 *
 * 防呆：若當年資料夾已存在則跳過，不會重複建立
 *
 * 手動測試：在 GAS 選此函式按「執行」，確認能正確建立
 */
function copyTemplateForNewYear() {
  const year       = new Date().getFullYear().toString();
  const rootFolder = DriveApp.getFolderById(CONFIG_DRIVE_ROOT_FOLDER_ID);

  // ── 防呆：當年資料夾已存在則跳過 ───────────────────────
  const existingFolders = rootFolder.getFoldersByName(year);
  if (existingFolders.hasNext()) {
    Logger.log(`[ScheduleTask] ${year} 資料夾已存在，跳過不重複建立`);
    return;
  }

  // ── 找 template 資料夾 ──────────────────────────────────
  const templateFolders = rootFolder.getFoldersByName(SCHEDULE_TEMPLATE_FOLDER_NAME);
  if (!templateFolders.hasNext()) {
    throw new Error(`[ScheduleTask] 找不到「${SCHEDULE_TEMPLATE_FOLDER_NAME}」資料夾`);
  }
  const templateFolder = templateFolders.next();

  // ── 找樣板試算表（檔名包含「樣板」）───────────────────────
  const files = templateFolder.getFilesByType(MimeType.GOOGLE_SHEETS);
  let templateFile = null;
  while (files.hasNext()) {
    const file = files.next();
    if (file.getName().includes(SCHEDULE_TEMPLATE_FILE_KEYWORD)) {
      templateFile = file;
      break;
    }
  }
  if (!templateFile) {
    throw new Error(`[ScheduleTask] template 資料夾裡找不到包含「${SCHEDULE_TEMPLATE_FILE_KEYWORD}」的試算表`);
  }

  // ── 建立當年資料夾，複製樣板進去 ────────────────────────
  const newFolder = rootFolder.createFolder(year);
  const newFile   = templateFile.makeCopy(SCHEDULE_NEW_FILE_NAME(year), newFolder);

  Logger.log(`[ScheduleTask] 已建立：線上問題/${year}/${SCHEDULE_NEW_FILE_NAME(year)}（ID: ${newFile.getId()}）`);
}