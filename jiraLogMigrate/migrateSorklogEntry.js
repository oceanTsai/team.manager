// ==========================================================================
// Main.gs - 搬移 log 執行用主程式
// --------------------------------------------------------------------------
// 在這裡定義「這次要搬什麼」,真正的搬移邏輯都在 WorklogMigrator 裡。
//
// 可執行的函式:
//   migrateToQuarters     → 把年度單 worklog 按季度拆到對應的季度單
//   migrateAnnualToSingle → (舊邏輯)把年度單整年 worklog 搬到單一目標單
//
// ⚠️ 需要掛載 Library:EnvLib(識別碼設為 EnvLib)
//
// 【設定方式】
//   修改下方常數區的 tasks 陣列
//   target 沒準備好就留空字串 '' 或 'TODO',會自動跳過(不用註解整行)
// ==========================================================================


// ==========================================================================
// 👇 季度搬移任務(給 migrateToQuarters 用)👇
// --------------------------------------------------------------------------
// target 沒準備好就留 '' 或 'TODO',會自動跳過,不需要刪除/註解整行
// ==========================================================================
const QUARTER_TASKS = [
  // F2E 內部會議
  { source: 'VIPOP-45336', target: '', year: 2026, quarter: 1 },
  { source: 'VIPOP-45336', target: 'VIPOP-45342', year: 2026, quarter: 2 },
  { source: 'VIPOP-45336', target: 'VIPOP-45340', year: 2026, quarter: 3 },
  { source: 'VIPOP-45336', target: '', year: 2026, quarter: 4 },

  // F2E Sprint 相關會議
  { source: 'VIPOP-45326', target: '', year: 2026, quarter: 1 },
  { source: 'VIPOP-45326', target: 'VIPOP-45343', year: 2026, quarter: 2 },
  { source: 'VIPOP-45326', target: 'VIPOP-45341', year: 2026, quarter: 3 },
  { source: 'VIPOP-45326', target: '', year: 2026, quarter: 4 },
];


// ==========================================================================
// 👇 年度搬移任務(給 migrateAnnualToSingle 用)👇
// --------------------------------------------------------------------------
// 把整年 worklog 從某張單搬到另一張單
// ==========================================================================
const ANNUAL_TASKS = [
  { source: 'VIPOP-36105', target: 'VIPOP-45336', year: 2026 },
  { source: 'VIPOP-36059', target: 'VIPOP-45326', year: 2026 }
];


// ==========================================================================
// 👇 使用者名字對應表 👇
// --------------------------------------------------------------------------
// key 必須對應 EnvLib User enum 的值
// 陣列裡放這位使用者在 Jira 可能出現的所有顯示名稱別名
// ==========================================================================
const USER_MAPPING = {
  //AGNES:   ['Agnes Kao 高慈謙', '高慈謙', 'Agnes'],
  BRIAN:   ['Brian Chao 趙軒弘', '趙軒弘', 'Brian'],
  ENYA:    ['Enya Chen 陳恩雅', '陳恩雅', 'Enya'],
  JUNE:    ['June Wang 王歆瑜', '王歆瑜', 'June'],
  PEDRO:   ['Pedro Yang 楊甯', '楊甯', 'Pedro'],
  SAMURA:  ['Samura Chen 陳昱霖', '陳昱霖', 'Samura'],
  STEVEN:  ['Steven Chen 陳融威', '陳融威', 'Steven'],
  WILLIAM: ['William Lu 呂紹瑋', '呂紹瑋', 'William']
};


// ==========================================================================
// 【可執行】把年度單 worklog 按季度拆到對應的季度單
// 修改檔案上方的 QUARTER_TASKS 後執行此函式
// ==========================================================================
function migrateToQuarters() {
  const migrator = new WorklogMigrator({
    jiraEnv: EnvLib.jiraEnv(),
    userMapping: USER_MAPPING
  });

  runTasks(QUARTER_TASKS, task => migrator.migrateQuarter(task));
}


// ==========================================================================
// 【可執行】(舊邏輯)把年度單整年 worklog 搬到單一目標單
// 修改檔案上方的 ANNUAL_TASKS 後執行此函式
// ==========================================================================
function migrateAnnualToSingle() {
  const migrator = new WorklogMigrator({
    jiraEnv: EnvLib.jiraEnv(),
    userMapping: USER_MAPPING
  });

  runTasks(ANNUAL_TASKS, task => migrator.migrateYear(task));
}


// ==========================================================================
// 【私有】逐一執行 tasks
// --------------------------------------------------------------------------
// - 自動驗證 source / target,沒填或無效就跳過(繼續處理後面的)
// - 遇到超時(result.finished = false)就中止,印提示讓使用者再執行一次
// - 全部跑完印總結
//
// @param {Array<Object>}   tasks - 任務陣列
// @param {Function} runFn         - (task) => result,實際執行的 callback
// ==========================================================================
function runTasks(tasks, runFn) {
  let executedCount = 0;
  let skippedCount = 0;
  const skippedTasks = [];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const taskLabel = _formatTaskLabel(task, i);

    // 驗證 task
    const validationError = _validateTask(task);
    if (validationError) {
      Logger.log(`\n⏭  [${taskLabel}] 跳過:${validationError}`);
      skippedCount++;
      skippedTasks.push({ label: taskLabel, reason: validationError });
      continue;
    }

    // 執行
    const result = runFn(task);
    executedCount++;

    // 超時中斷
    if (!result.finished) {
      Logger.log(`\n⏸ 時間快到了,已中斷。請再次執行接續處理`);
      Logger.log(`本次執行 ${executedCount} 個 task,跳過 ${skippedCount} 個`);
      return;
    }
  }

  // 全部跑完
  Logger.log(`\n========== 全部處理完成 ==========`);
  Logger.log(`執行: ${executedCount} 個 task / 跳過: ${skippedCount} 個 task`);

  if (skippedTasks.length > 0) {
    Logger.log(`\n跳過明細:`);
    skippedTasks.forEach((s, i) => {
      Logger.log(`  ${i + 1}. ${s.label} — ${s.reason}`);
    });
  }
}


// ==========================================================================
// 【私有】驗證 task 是否該執行
// --------------------------------------------------------------------------
// 回傳 null = 通過驗證可執行
// 回傳字串 = 該字串就是「跳過原因」
// ==========================================================================
function _validateTask(task) {
  if (!task) return 'task 為空';

  if (!_isValidIssueKey(task.source)) {
    return `source 無效或未填:「${task.source}」`;
  }
  if (!_isValidIssueKey(task.target)) {
    return `target 無效或未填:「${task.target}」`;
  }

  return null;
}


// ==========================================================================
// 【私有】判斷 issue key 是否有效
// --------------------------------------------------------------------------
// 無效的情況:
//   - null / undefined
//   - 空字串、純空白字串
//   - 'TODO' 或 'todo' 等佔位字串
//   - 不符合 Jira issue key 格式(例如 ABC-123)
// ==========================================================================
function _isValidIssueKey(value) {
  if (value == null) return false;
  if (typeof value !== 'string') return false;

  const trimmed = value.trim();
  if (trimmed === '') return false;
  if (trimmed.toUpperCase() === 'TODO') return false;

  return /^[A-Z][A-Z0-9]+-\d+$/.test(trimmed);
}


// ==========================================================================
// 【私有】格式化 task 標籤(給 log 用)
// ==========================================================================
function _formatTaskLabel(task, index) {
  const num = index + 1;
  const src = task.source || '?';
  const tgt = task.target || '(未填)';

  if (task.quarter != null) {
    const yearShort = (task.year || 0) % 100;
    return `#${num} ${src} → ${tgt} Y${yearShort}Q${task.quarter}`;
  }
  if (task.year != null) {
    return `#${num} ${src} → ${tgt} Y${task.year}`;
  }
  return `#${num} ${src} → ${tgt}`;
}