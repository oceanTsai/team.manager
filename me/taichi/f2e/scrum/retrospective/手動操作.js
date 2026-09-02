/**
 * ============================================================
 * 手動操作.gs - 每個動作的手動入口
 * ============================================================
 * 📦 屬於 retrospective
 *
 * 這個檔案沒有類別,只有全域函式 —— 因為 GAS 的「選擇要執行的函式」選單
 * 只列得出全域函式。每一支都是薄包裝,邏輯都在對應的類別裡。
 *
 * 流程失敗時你會收到錯誤通知,告訴你是哪一步掛了。
 * 這裡把每一步都拆成可以單獨執行的函式,你自己判斷缺哪一步就跑哪一個。
 * 程式不做任何自動修復。
 *
 * ── 出事時的建議順序 ────────────────────────────────────────
 *   1. showRetroStatus()      先看現在缺什麼
 *   2. 依缺的部分,執行下面對應的函式補上
 *
 * ── 流程的四個步驟 ──────────────────────────────────────────
 *   createSprintFolder()      建資料夾 + 複製表單/投影片
 *   publishLatestForm()       把表單設為已發布
 *   schedulePublishTask()     排定表單發布的時間
 *   scheduleReminderTask()    排定團隊提醒的時間
 *
 * ── 補發通知 ────────────────────────────────────────────────
 *   notifyOwnerCreated()      補發「已建立」卡片(個人頻道)
 *   notifyOwnerPublished()    補發「已發布」卡片(個人頻道)
 *   notifyTeamReminder()      補發填寫提醒(團隊頻道)
 *
 * ── 查詢與檢查(唯讀)────────────────────────────────────────
 *   showRetroStatus()         目前流程狀態
 *   showNextSprint()          預覽下一個 Sprint 會是什麼
 *   showRecentSprints()       列出今年與去年的 Sprint
 *   checkRetroSetup()         檢查根資料夾與樣板設定
 *
 * ── 排程維運 ────────────────────────────────────────────────
 *   listAllTriggers()         查看目前排程
 *   clearDynamicTriggers()    清除動態排程
 *
 * ⚠️ 除了 createSprintFolder() 是用下方常數指定要建哪一個之外,
 *    其餘函式都以「最新的 Sprint」(結束日最晚的那一個)為對象。
 * ============================================================
 */


/* ==========================================================
 * 👇 手動建立資料夾時,改這裡指定要建哪一個 Sprint
 * ----------------------------------------------------------
 * GAS 的函式選單無法傳參數,所以用常數指定。
 * 留 null 代表「自動推算下一個」。
 *
 * 範例:
 *   const MANUAL_SPRINT = null;                                       ← 自動推算
 *   const MANUAL_SPRINT = { year: 2026, start: '0622', end: '0703' }; ← 指定
 * ========================================================== */
const MANUAL_SPRINT = null;


/* ========== 📁 步驟 1:建立資料夾 ========== */

/**
 * 【可執行】建立 Sprint 資料夾,並從樣板複製表單與投影片
 *
 * 只建立檔案,不排程也不發通知 —— 那些請另外呼叫 schedulePublishTask()
 * 與 notifyOwnerCreated()。
 *
 * 要建哪一個由 MANUAL_SPRINT 常數決定:
 *   有填 → 建立指定的那一個
 *   留 null → 自動接續最新 Sprint 往後推算
 *   連可接續的都沒有 → 從本週一推算第一個,並在 log 警示
 *
 * 已存在的東西會沿用/跳過,所以重複執行是安全的,
 * 可以用來補齊上次建到一半的 Sprint。
 *
 * @returns {{sprintName: string, folderId: string, folderUrl: string,
 *            formId: string, formUrl: string, slideUrl: string,
 *            created: {folder: boolean, form: boolean, slide: boolean}}}
 */
function createSprintFolder() {
  const drive   = Infra.createDriveClient();
  const finder  = new SprintFinder(drive, SPRINT_OPTIONS.sprintRootFolderId);
  const planner = new SprintPlanner(SPRINT_OPTIONS.sprintDays);
  const builder = new SprintFolderBuilder(
    drive,
    Infra.createFormClient(),
    SPRINT_OPTIONS.sprintRootFolderId,
    SPRINT_OPTIONS.templateFolderId
  );

  const spec = _resolveSprintSpec(finder, planner);
  Logger.log(`📆 準備建立:${spec.name}(${spec.year} 年度資料夾)`);

  const built = builder.build(spec.year, spec.name);

  Logger.log('------------------------------------------------');
  Logger.log(`✅ 完成:${built.folderUrl}`);
  Logger.log('接下來若要讓流程跑起來,還需要:');
  Logger.log('  schedulePublishTask()  排定表單發布時間');
  Logger.log('  notifyOwnerCreated()   補發「已建立」通知(選用)');

  return built;
}


/* ========== 📝 步驟 2:發布表單 ========== */

/**
 * 【可執行】把最新 Sprint 的表單設為已發布
 *
 * 只發布,不排提醒也不發通知。已經是發布狀態的話會跳過,不會出錯。
 *
 * @returns {{formId: string, formName: string, previewUrl: string,
 *            editUrl: string, isPublished: boolean}}
 */
function publishLatestForm() {
  const latest = _findLatestSprint();
  const form   = _openSprintForm(latest.folderId);

  form.publish();
  const info = form.describe();

  Logger.log('------------------------------------------------');
  Logger.log(`Sprint:${latest.name}`);
  Logger.log(`填寫網址:${info.previewUrl}`);
  Logger.log(`編輯網址:${info.editUrl}`);
  Logger.log('接下來若要讓流程跑起來,還需要:');
  Logger.log('  scheduleReminderTask()   排定團隊提醒時間');
  Logger.log('  notifyOwnerPublished()   補發「已發布」通知(選用)');

  return info;
}


/* ========== ⏰ 步驟 3:排定排程 ========== */

/**
 * 【可執行】依最新 Sprint 的結束日,排定「發布表單」的排程
 *
 * 觸發時間 = Sprint 結束日 - 2 天,05:00。
 * 若算出來的時間已經過去,會在 log 警示 —— 那代表你應該直接執行
 * publishLatestForm() 而不是排程。
 *
 * @returns {string} 排程 ID
 */
function schedulePublishTask() {
  const latest     = _findLatestSprint();
  const triggers   = new TriggerManager();
  const endDateStr = DateFormat.formatDate(latest.endDate);

  _warnIfPast(triggers.calcPublishDate(endDateStr), '發布', 'publishLatestForm()');

  const uid = triggers.schedulePublish(endDateStr);
  Logger.log(`✅ 已排定 ${latest.name} 的發布排程`);
  return uid;
}

/**
 * 【可執行】依最新 Sprint 的結束日,排定「提醒團隊」的排程
 *
 * 觸發時間 = Sprint 結束日 - 1 天,10:00。
 * 會先清掉既有的提醒排程,確保同一時間只有一個,團隊才不會收到重複的卡片。
 *
 * @returns {string} 排程 ID
 */
function scheduleReminderTask() {
  const latest     = _findLatestSprint();
  const triggers   = new TriggerManager();
  const endDateStr = DateFormat.formatDate(latest.endDate);

  _warnIfPast(triggers.calcReminderDate(endDateStr), '提醒', 'notifyTeamReminder()');

  triggers.cancelReminders();
  const uid = triggers.scheduleReminder(endDateStr);
  Logger.log(`✅ 已排定 ${latest.name} 的提醒排程`);
  return uid;
}


/* ========== 🔔 補發通知 ========== */

/**
 * 【可執行】補發「Sprint 已建立」卡片到個人頻道
 *
 * 用途:prepareRetro 建好了資料夾但發通知那一步失敗時,用這個補發。
 */
function notifyOwnerCreated() {
  const drive  = Infra.createDriveClient();
  const latest = _findLatestSprint();
  const info   = _openSprintForm(latest.folderId).describe();
  const folder = drive.getFolder(latest.folderId);

  new ReminderNotifier().notifyCreated({
    sprintName: latest.name,
    startDate:  DateFormat.formatDate(latest.startDate),
    endDate:    DateFormat.formatDate(latest.endDate),
    folderUrl:  folder.getUrl(),
    formUrl:    info.editUrl,
    slideUrl:   folder.getUrl(),
  });

  Logger.log(`📩 已補發「已建立」通知:${latest.name}`);
}

/**
 * 【可執行】補發「問卷已發布」卡片到個人頻道
 *
 * 卡片上的「團隊提醒時間」是依最新 Sprint 結束日推算的,
 * 不代表真的有排定提醒排程 —— 那要另外用 showRetroStatus() 確認。
 */
function notifyOwnerPublished() {
  const latest     = _findLatestSprint();
  const info       = _openSprintForm(latest.folderId).describe();
  const triggers   = new TriggerManager();
  const endDateStr = DateFormat.formatDate(latest.endDate);

  new ReminderNotifier().notifyPublished({
    sprintName: latest.name,
    previewUrl: info.previewUrl,
    editUrl:    info.editUrl,
    reminderAt: DateFormat.formatDateTime(triggers.calcReminderDate(endDateStr)),
  });

  Logger.log(`📩 已補發「已發布」通知:${latest.name}`);
}

/**
 * 【可執行】補發填寫提醒到「團隊」頻道
 *
 * ⚠️ 這會真的發到團隊頻道。執行前先用 showRetroStatus() 確認
 *    最新 Sprint 是不是你要的那一個。
 *    表單若還沒發布,會先在 log 警示但仍照常發送。
 */
function notifyTeamReminder() {
  const latest = _findLatestSprint();
  const info   = _openSprintForm(latest.folderId).describe();

  if (!info.isPublished) {
    Logger.log('⚠️ 表單尚未發布,團隊點連結可能無法填寫。建議先執行 publishLatestForm()');
  }

  new ReminderNotifier().notifyReminder({
    sprintName: latest.name,
    formUrl:    info.previewUrl,
  });

  Logger.log(`📩 已補發團隊提醒:${latest.name}`);
}


/* ========== 🔍 查詢與檢查(唯讀) ========== */

/**
 * 【可執行】顯示目前流程狀態:最新 Sprint、表單發布狀態、待處理排程
 *
 * 出事時第一個執行這個,它會告訴你現在缺什麼。
 */
function showRetroStatus() {
  const latest   = _findLatestSprint();
  const info     = _openSprintForm(latest.folderId).describe();
  const triggers = new TriggerManager();
  const planner  = new SprintPlanner(SPRINT_OPTIONS.sprintDays);

  Logger.log('========== 目前狀態 ==========');
  Logger.log(`最新 Sprint       ${latest.name}`);
  Logger.log(`  起訖            ${DateFormat.formatDate(latest.startDate)} ~ ${DateFormat.formatDate(latest.endDate)}`);
  Logger.log(`  表單            ${info.formName}`);
  Logger.log(`  已發布          ${info.isPublished ? '是' : '否'}`);
  Logger.log('------------------------------------------------');
  Logger.log(`待處理發布排程     ${triggers.listByHandler('publishTask').length} 個`);
  Logger.log(`待處理提醒排程     ${triggers.listByHandler('reminderTask').length} 個`);
  Logger.log('------------------------------------------------');
  Logger.log(`今天              ${DateFormat.formatDate(new Date())}`);
  Logger.log(`該建下一個了嗎     ${planner.isTimeForNext(latest.endDate) ? '是' : '否'}`);
  Logger.log(`下一個預定開始日   ${DateFormat.formatDate(planner.nextStartDateAfter(latest.endDate))}`);
}

/**
 * 【可執行】預覽下一個 Sprint 會是什麼,不會建立任何東西
 */
function showNextSprint() {
  const drive   = Infra.createDriveClient();
  const finder  = new SprintFinder(drive, SPRINT_OPTIONS.sprintRootFolderId);
  const planner = new SprintPlanner(SPRINT_OPTIONS.sprintDays);
  const plan    = planner.planNext(finder.listRecent());

  if (plan) {
    Logger.log(`📌 接續自:${plan.basedOn.name}(結束於 ${DateFormat.formatDate(plan.basedOn.endDate)})`);
    Logger.log(`📆 下一個:${plan.name}`);
    Logger.log(`   起始日:${DateFormat.formatDate(plan.startDate)}(${DateFormat.formatWeekday(plan.startDate)})`);
    Logger.log(`   結束日:${DateFormat.formatDate(plan.endDate)}(${DateFormat.formatWeekday(plan.endDate)})`);
    Logger.log(`   會建在:${plan.year} 年度資料夾`);
  } else {
    Logger.log('⚠️ 找不到可接續的 Sprint(今年與去年都沒有)');
    Logger.log('   若是第一次啟用,直接執行 createSprintFolder() 會從本週一建立第一個');
  }
}

/**
 * 【可執行】列出今年與去年的所有 Sprint,由新到舊
 */
function showRecentSprints() {
  const drive   = Infra.createDriveClient();
  const finder  = new SprintFinder(drive, SPRINT_OPTIONS.sprintRootFolderId);
  const sprints = finder.listRecent();

  Logger.log(`📋 共找到 ${sprints.length} 個 Sprint(今年與去年,由新到舊):`);
  sprints.forEach((sprint, index) => {
    const marker = index === 0 ? '⭐' : '  ';
    Logger.log(`${marker} ${sprint.name}  ${DateFormat.formatDate(sprint.startDate)} ~ ${DateFormat.formatDate(sprint.endDate)}`);
  });
}

/**
 * 【可執行】檢查根資料夾與樣板資料夾設定是否正確
 *
 * 純唯讀,不會建立任何東西。第一次設定完先跑這個確認。
 *
 * @returns {boolean} 全部通過才回傳 true
 */
function checkRetroSetup() {
  return new SprintFolderBuilder(
    Infra.createDriveClient(),
    Infra.createFormClient(),
    SPRINT_OPTIONS.sprintRootFolderId,
    SPRINT_OPTIONS.templateFolderId
  ).validateSetup();
}


/* ========== 🗑️ 排程維運 ========== */

/**
 * 【可執行】列出目前所有排程,標示哪些是動態排程(會被清除)
 *
 * 不會刪除任何東西,先看清楚用。
 *
 * @returns {{total: number, dynamic: number, fixed: number}}
 */
function listAllTriggers() {
  return new TriggerInspector().listAll();
}

/**
 * 【可執行】清除所有動態排程,讓流程回到乾淨狀態
 *
 * 只動排程不動 Drive —— 資料夾、表單、投影片都會保留。
 *
 * @returns {number} 實際刪除的排程數量
 */
function clearDynamicTriggers() {
  return new TriggerInspector().clearDynamic();
}


/* ========== 🔒 私有 ========== */

/**
 * 取得最新的 Sprint
 * @private
 * @throws {Error} 今年與去年都找不到 Sprint 時
 */
function _findLatestSprint() {
  const drive = Infra.createDriveClient();
  return new SprintFinder(drive, SPRINT_OPTIONS.sprintRootFolderId).findLatest();
}

/**
 * 開啟指定 Sprint 資料夾裡的表單
 * @private
 * @returns {SprintForm}
 */
function _openSprintForm(sprintFolderId) {
  const drive      = Infra.createDriveClient();
  const formClient = Infra.createFormClient();
  const finder     = new SprintFinder(drive, SPRINT_OPTIONS.sprintRootFolderId);

  return new SprintForm(drive, formClient, finder.findForm(sprintFolderId));
}

/**
 * 決定 createSprintFolder() 要建哪一個 Sprint
 *
 * MANUAL_SPRINT 有填就用指定的;沒填就自動推算下一個;
 * 連可接續的都沒有(第一次啟用)就從今天推算第一個,並在 log 警示。
 *
 * @private
 * @returns {{name: string, year: number}}
 */
function _resolveSprintSpec(finder, planner) {
  let spec = null;

  if (MANUAL_SPRINT) {
    spec = {
      name: `${MANUAL_SPRINT.start}-${MANUAL_SPRINT.end}`,
      year: MANUAL_SPRINT.year,
    };
    _assertValidSprintSpec(spec, MANUAL_SPRINT);
    Logger.log(`📌 使用 MANUAL_SPRINT 指定的 Sprint:${spec.name}`);
  } else {
    const plan = planner.planNext(finder.listRecent());

    if (plan) {
      spec = { name: plan.name, year: plan.year };
      Logger.log(`📌 自動推算,接續 ${plan.basedOn.name} 之後:${spec.name}`);
    } else {
      const first = planner.planFirst();
      spec = { name: first.name, year: first.year };
      Logger.log('⚠️ 今年與去年都找不到任何 Sprint 資料夾');
      Logger.log(`⚠️ 改為從本週一推算第一個 Sprint:${spec.name}`);
      Logger.log('⚠️ 若這不是你要的,請填好 MANUAL_SPRINT 常數後重新執行');
    }
  }

  return spec;
}

/**
 * 驗證 MANUAL_SPRINT 的格式
 * @private
 * @throws {Error} 年份或起訖日格式不正確時
 */
function _assertValidSprintSpec(spec, raw) {
  const validYear  = Number.isInteger(raw.year) && raw.year >= 2000 && raw.year <= 2999;
  const validDates = /^\d{4}-\d{4}$/.test(spec.name);

  if (!validYear) {
    throw new Error(`MANUAL_SPRINT.year 格式錯誤:「${raw.year}」,應該是四位數年份,例如 2026`);
  }
  if (!validDates) {
    throw new Error(
      `MANUAL_SPRINT 的起訖日格式錯誤:「${spec.name}」\n` +
      "start 與 end 都要是 4 位數字的 MMDD,例如 { year: 2026, start: '0622', end: '0703' }"
    );
  }
}

/**
 * 排程時間已經過去的話,在 log 警示並提示改用哪個直接執行的函式
 * @private
 */
function _warnIfPast(triggerDate, label, alternativeFn) {
  if (triggerDate < new Date()) {
    Logger.log(`⚠️ 算出的${label}時間 ${DateFormat.formatDateTime(triggerDate)} 已經過去了`);
    Logger.log(`   排定後會立刻或很快觸發。若不是你要的,改用 ${alternativeFn}`);
  }
}
