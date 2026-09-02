const H = require('../helpers');
H.installGasStubs();

const DateFormat          = H.load('DateFormat.js', 'DateFormat');
global.DateFormat         = DateFormat;
const SprintFinder        = H.load('SprintFinder.js', 'SprintFinder');
global.SprintFinder       = SprintFinder;
const SprintPlanner       = H.load('SprintPlanner.js', 'SprintPlanner');
const SprintFolderBuilder = H.load('SprintFolderBuilder.js', 'SprintFolderBuilder');
const SprintForm          = H.load('SprintForm.js', 'SprintForm');
const TriggerManager      = H.load('TriggerManager.js', 'TriggerManager');
global.TriggerManager     = TriggerManager;
const TriggerInspector    = H.load('TriggerInspector.js', 'TriggerInspector');

let pass=0, fail=0;
const check=(l,a,e)=>{const ok=String(a)===String(e);
  console.log(`  ${ok?'✅':'❌'} ${l}  →  ${a}${ok?'':`  (預期 ${e})`}`);ok?pass++:fail++};

console.log('【DateFormat】靜態方法');
check('formatDate', DateFormat.formatDate(new Date(2026,5,19)), '2026/06/19');
check('formatMMDD', DateFormat.formatMMDD(new Date(2026,5,19)), '0619');
check('formatDateTime', DateFormat.formatDateTime(new Date(2026,5,19,10,0)), '2026/06/19 10:00');
check('formatWeekday', DateFormat.formatWeekday(new Date(2026,5,19)), '週五');

console.log('\n【SprintFinder】跨年:今年+去年一起找，基準年取資料夾年份');
let drive = H.fakeDrive({
  folders: { ROOT:['template','2025','2026'], 'ROOT/2026':['1214-1225','1228-0108'], 'ROOT/2025':['1201-1212'] },
  files: {},
});
let finder = new SprintFinder(drive, 'ROOT');
let latest = finder.findLatest();
check('找到跨年 Sprint', latest.name, '1228-0108');
check('結束日跨到 2027', DateFormat.formatDate(latest.endDate), '2027/01/08');
check('開始日留在 2026', DateFormat.formatDate(latest.startDate), '2026/12/28');
check('template 被忽略', finder.listRecent().every(s=>/^\d{4}-\d{4}$/.test(s.name)), true);

console.log('\n【SprintFinder】兩年都沒有就拋錯，不撈更舊的');
finder = new SprintFinder(H.fakeDrive({folders:{ROOT:['2020'],'ROOT/2020':['0301-0312']},files:{}}), 'ROOT');
check('拋錯', (()=>{try{finder.findLatest();return false}catch(e){return e.message.includes('都找不到')}})(), true);

console.log('\n【SprintPlanner】純計算，完全不碰 Drive');
const planner = new SprintPlanner(11);
let plan = planner.planNext([{ name:'0608-0619', endDate:new Date(2026,5,19) }]);
check('接續算出 0622-0703', plan.name, '0622-0703');
check('起始日是週一', DateFormat.formatWeekday(plan.startDate), '週一');
check('結束日是週五', DateFormat.formatWeekday(plan.endDate), '週五');
check('歸檔年份取開始日那年', plan.year, 2026);
plan = planner.planNext([{ name:'1214-1225', endDate:new Date(2026,11,25) }]);
check('跨年:算出 1228-0108', plan.name, '1228-0108');
check('跨年:結束日 2027', DateFormat.formatDate(plan.endDate), '2027/01/08');
check('跨年:仍歸檔 2026', plan.year, 2026);
check('沒有可接續的回傳 null', planner.planNext([]), 'null');
const first = planner.planFirst();
check('第一個 Sprint 起於週一', DateFormat.formatWeekday(first.startDate), '週一');
check('第一個 Sprint 不晚於今天', first.startDate <= new Date(), true);

console.log('\n【SprintFolderBuilder】可重複執行:已存在就沿用/跳過');
const tree = { folders:{ROOT:['2026','template'],'ROOT/2026':[]},
               files:{'ROOT/template':[{name:'表單樣板',mime:'mime/form'},{name:'投影片樣板',mime:'mime/slide'}]} };
drive = H.fakeDrive(tree);
const builder = new SprintFolderBuilder(drive, H.fakeFormClient(), 'ROOT', 'ROOT/template');
let built = builder.build(2026, '0622-0703');
check('第一次:資料夾是新建的', built.created.folder, true);
check('第一次:表單是新建的', built.created.form, true);
check('第一次:投影片是新建的', built.created.slide, true);
built = builder.build(2026, '0622-0703');
check('第二次:資料夾沿用', built.created.folder, false);
check('第二次:表單跳過', built.created.form, false);
check('第二次:投影片跳過', built.created.slide, false);
check('不會拋「已存在」的錯', true, true);

console.log('\n【SprintForm】發布與讀取分開');
const formClient = H.fakeFormClient();
const formFile = { getId:()=>'F1', getName:()=>'0622-0703', getUrl:()=>'edit://F1' };
const sf = new SprintForm(drive, formClient, formFile);
check('一開始未發布', sf.isPublished(), false);
check('publish() 回傳 true(真的發布了)', sf.publish(), true);
check('已發布', sf.isPublished(), true);
check('重複 publish() 回傳 false', sf.publish(), false);
const desc = sf.describe();
check('previewUrl 是填寫網址', desc.previewUrl, 'viewform://F1');
check('editUrl 是編輯網址', desc.editUrl, 'edit://F1');

console.log('\n【TriggerManager】只管排程');
H.setTriggers([]); const tm = new TriggerManager();
check('publishDateFor', DateFormat.formatDateTime(tm.calcPublishDate('2026/06/19')), '2026/06/17 05:00');
check('reminderDateFor', DateFormat.formatDateTime(tm.calcReminderDate('2026/06/19')), '2026/06/18 10:00');
tm.schedulePublish('2026/06/19');
check('排定後有 1 個', tm.listByHandler('publishTask').length, 1);

console.log('\n【TriggerManager】cleanUpAfterRun 兩種情境');
H.setTriggers([H.mkTrig('prepareRetro','FIXED'), H.mkTrig('publishTask','P1')]);
tm.cleanUpAfterRun({triggerUid:'P1'},'publishTask');
check('排程觸發:精確刪自己', H.getTriggers().length, 1);
check('固定排程保留', H.getTriggers()[0].getHandlerFunction(), 'prepareRetro');
H.setTriggers([H.mkTrig('prepareRetro','FIXED'), H.mkTrig('publishTask','P-pending')]);
tm.cleanUpAfterRun(undefined,'publishTask');
check('手動執行:清掉待處理的', H.getTriggers().filter(t=>t.getHandlerFunction()==='publishTask').length, 0);
check('固定排程仍保留', H.getTriggers().length, 1);

console.log('\n【TriggerInspector】只清動態排程');
H.setTriggers([H.mkTrig('prepareRetro','F'), H.mkTrig('publishTask','D1'), H.mkTrig('reminderTask','D2')]);
const inspector = new TriggerInspector();
let r = inspector.listAll();
check('分類:動態 2 固定 1', `${r.dynamic}/${r.fixed}`, '2/1');
check('listAll 不刪東西', H.getTriggers().length, 3);
check('clearDynamic 刪 2 個', inspector.clearDynamic(), 2);
check('固定排程保留', H.getTriggers()[0].getHandlerFunction(), 'prepareRetro');

console.log(`\n========== ${pass} 通過 / ${fail} 失敗 ==========`);
process.exit(fail===0?0:1);
