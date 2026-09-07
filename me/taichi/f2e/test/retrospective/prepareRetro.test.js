const H = require('../helpers');
H.installGasStubs();

global.Notify = {
  getMessageTemplateClass: () => class { render(){ throw new Error('必須實作') } },
  createChatNotifier: () => ({ sendCard: () => true }),
};
global.PropertiesService = {
  getScriptProperties: () => ({
    getProperty: (k) => ({ RETRO_CHAT_WEBHOOK_URL: 'chat://personal', B_TEAM_RETRO_WEBHOOK: 'chat://team' }[k] || null),
  }),
};

const DateFormat           = H.load('DateFormat.js', 'DateFormat');                   global.DateFormat = DateFormat;
const SprintFinder         = H.load('SprintFinder.js', 'SprintFinder');               global.SprintFinder = SprintFinder;
const SprintPlanner        = H.load('SprintPlanner.js', 'SprintPlanner');             global.SprintPlanner = SprintPlanner;
const SprintFolderBuilder  = H.load('SprintFolderBuilder.js', 'SprintFolderBuilder'); global.SprintFolderBuilder = SprintFolderBuilder;
const TriggerManager       = H.load('TriggerManager.js', 'TriggerManager');           global.TriggerManager = TriggerManager;
const RetroMessageTemplate = H.load('RetroMessageTemplate.js', 'RetroMessageTemplate'); global.RetroMessageTemplate = RetroMessageTemplate;
const ReminderNotifier     = H.load('ReminderNotifier.js', 'ReminderNotifier');        global.ReminderNotifier = ReminderNotifier;
const RetroPreparer        = H.load('prepareRetro.js', 'RetroPreparer');

let pass = 0, fail = 0;
const check = (l, a, e) => {
  const ok = String(a) === String(e);
  console.log(`  ${ok ? '✅' : '❌'} ${l}  →  ${a}${ok ? '' : `  (預期 ${e})`}`);
  ok ? pass++ : fail++;
};

// 用「距今幾天」推算固定日期,測試不會隨著執行日期經過而失效
function shiftDays(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

// 資料夾依「開始日」的年份歸檔(見 SprintFinder 的規則),所以放進 start 那一年
function buildFixture(drive, endOffsetDays) {
  const end   = shiftDays(endOffsetDays);
  const start = shiftDays(endOffsetDays - 11);
  const name  = `${DateFormat.formatMMDD(start)}-${DateFormat.formatMMDD(end)}`;
  const year  = String(start.getFullYear());

  if (!drive.folders[drive.__root]) drive.folders[drive.__root] = [];
  if (!drive.folders[drive.__root].includes(year)) drive.folders[drive.__root].push(year);
  const yearKey = `${drive.__root}/${year}`;
  drive.folders[yearKey] = (drive.folders[yearKey] || []).concat(name);

  return name;
}

function makeTree() {
  const tree = { folders: { ROOT: ['template'] }, files: { 'ROOT/template': [
    { name: '表單樣板', mime: 'mime/form' }, { name: '投影片樣板', mime: 'mime/slide' },
  ] } };
  tree.__root = 'ROOT';
  return tree;
}

const SPRINT_OPTIONS = { templateFolderId: 'ROOT/template', sprintRootFolderId: 'ROOT', sprintDays: 11 };

console.log('【RetroPreparer】算出的下一個 Sprint 若整段已過去,中止並拋錯(B)');
H.setTriggers([]);
let tree = makeTree();
buildFixture(tree, -60); // 上一個 60 天前就結束了,往後推算的下一個也還是過去
global.Infra.createDriveClient = () => H.fakeDrive(tree);
global.Infra.createFormClient  = () => H.fakeFormClient();

let threw = null;
try {
  new RetroPreparer(SPRINT_OPTIONS).run();
} catch (e) { threw = e; }
check('有拋出例外', !!threw, true);
check('訊息說明是過期 Sprint', !!(threw && threw.message.includes('已經是過去')), true);
check('訊息引導改用 MANUAL_SPRINT', !!(threw && threw.message.includes('MANUAL_SPRINT')), true);

console.log('\n【RetroPreparer】算出的下一個 Sprint 在未來,正常建立,且只查一次 Drive 清單(A)');
H.setTriggers([]);
tree = makeTree();
buildFixture(tree, -7); // 上一個 7 天前結束,推算出的下一個還在未來
const drive = H.fakeDrive(tree);
global.Infra.createDriveClient = () => drive;
global.Infra.createFormClient  = () => H.fakeFormClient();

let listRecentCalls = 0;
const originalListRecent = SprintFinder.prototype.listRecent;
SprintFinder.prototype.listRecent = function (...args) {
  listRecentCalls = listRecentCalls + 1;
  return originalListRecent.apply(this, args);
};

threw = null;
let result = null;
try {
  result = new RetroPreparer(SPRINT_OPTIONS).run();
} catch (e) { threw = e; }
SprintFinder.prototype.listRecent = originalListRecent;

check('不拋錯', threw, 'null');
check('有建立資料夾', !!(result && result.folderId), true);
check('listRecent() 只查一次', listRecentCalls, 1);

console.log(`\n========== ${pass} 通過 / ${fail} 失敗 ==========`);
process.exit(fail === 0 ? 0 : 1);
