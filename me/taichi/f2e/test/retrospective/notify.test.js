const H = require('../helpers');
H.installGasStubs();

let SENT=[], PROPS={}, chatThrows=false;
global.Notify = {
  getMessageTemplateClass: () => class { render(){ throw new Error('必須實作') } },
  createChatNotifier: url => { if (chatThrows) throw new Error('webhook 掛了');
    return { sendCard: m => { SENT.push({url,m}); return true } } },
};
global.PropertiesService = { getScriptProperties: () => ({ getProperty: k => PROPS[k] || null }) };
global.SPRINT_OPTIONS = { sprintRootFolderId:'ROOT456' };

const DateFormat = H.load('DateFormat.js','DateFormat'); global.DateFormat = DateFormat;
const RetroMessageTemplate = H.load('RetroMessageTemplate.js','RetroMessageTemplate');
global.RetroMessageTemplate = RetroMessageTemplate;
const ReminderNotifier = H.load('ReminderNotifier.js','ReminderNotifier');
const fn = H.load('FailureNotifier.js','notifyFailure');

let pass=0,fail=0;
const check=(l,a,e)=>{const ok=String(a)===String(e);
  console.log(`  ${ok?'✅':'❌'} ${l}  →  ${a}${ok?'':`  (預期 ${e})`}`);ok?pass++:fail++};
const t = new RetroMessageTemplate();
const EDIT='edit://F', VIEW='view://F';

console.log('【卡片 1「已建立」→ 主管】');
const c1 = t.renderSprintCreated({sprintName:'0608-0619',startDate:'2026/06/08',endDate:'2026/06/19',
  folderUrl:'d://F',formUrl:EDIT,slideUrl:'s://S'});
check('標題', c1.title, '✅ Sprint 0608-0619 已建立');
check('按鈕', c1.actions.map(a=>a.text).join('/'), '開啟資料夾/調整表單');
check('「調整表單」連編輯網址', c1.actions[1].url, EDIT);

console.log('\n【卡片 2「已發布」→ 主管確認用】');
const c2 = t.renderFormPublished({sprintName:'0608-0619',previewUrl:VIEW,editUrl:EDIT,reminderAt:'2026/06/18 10:00'});
check('副標是團隊提醒時間', c2.subtitle, '團隊將於 2026/06/18 10:00 收到填寫提醒');
check('不再叫人「請盡快完成」', c2.subtitle.includes('請盡快完成'), false);
check('有團隊提醒時間欄位', c2.fields.some(f=>f.label.includes('團隊提醒時間')), true);
check('按鈕', c2.actions.map(a=>a.text).join('/'), '預覽填寫畫面/調整表單');
check('預覽連填寫網址', c2.actions[0].url, VIEW);
check('調整連編輯網址', c2.actions[1].url, EDIT);

console.log('\n【卡片 3「提醒填寫」→ 團隊】');
const c3 = t.renderSurveyReminder({sprintName:'0608-0619',formUrl:VIEW});
check('標題含「填寫」', c3.title, '📋 Sprint 0608-0619 回顧問卷填寫提醒');
check('連填寫網址', c3.actions[0].url, VIEW);

console.log('\n【卡片 2 vs 3】不該長得一樣');
check('欄位不同', JSON.stringify(c2.fields)===JSON.stringify(c3.fields), false);
check('按鈕不同', JSON.stringify(c2.actions)===JSON.stringify(c3.actions), false);

console.log('\n【ReminderNotifier】三張卡片發到正確頻道');
PROPS={RETRO_CHAT_WEBHOOK_URL:'chat://personal', B_TEAM_RETRO_WEBHOOK:'chat://team'};
SENT=[]; const n = new ReminderNotifier();
n.notifyCreated({sprintName:'S',startDate:'a',endDate:'b',folderUrl:'f',formUrl:'m',slideUrl:'s'});
n.notifyPublished({sprintName:'S',previewUrl:VIEW,editUrl:EDIT,reminderAt:'x'});
n.notifyReminder({sprintName:'S',formUrl:VIEW});
check('已建立 → 個人頻道', SENT[0].url, 'chat://personal');
check('已發布 → 個人頻道', SENT[1].url, 'chat://personal');
check('提醒填寫 → 團隊頻道', SENT[2].url, 'chat://team');

console.log('\n【FailureNotifier】卡片要能告訴人去哪裡做什麼');
SENT=[]; H.resetLog(); chatThrows=false;
PROPS={RETRO_CHAT_WEBHOOK_URL:'chat://personal'};
fn('publishTask','發布回顧表單', new Error('資料夾內有多個表單'));
const card = SENT[0].m;
check('發到個人頻道', SENT[0].url, 'chat://personal');
check('標題是「在做什麼」失敗', card.title.includes('發布回顧表單'), true);
const steps = card.fields.find(f=>f.label.includes('怎麼處理')).value;
check('指引有逐步編號', steps.includes('①')&&steps.includes('③'), true);
check('指引點名要重跑哪個函式', steps.includes('「publishTask」'), true);
check('指引提到卡住時怎麼辦', steps.includes('clearDynamicTriggers'), true);
check('有 Apps Script 按鈕', card.actions[0].url.includes('SCRIPT123'), true);
check('有 Drive 按鈕', card.actions[1].url.includes('ROOT456'), true);

console.log('\n【FailureNotifier】絕不拋錯(否則會蓋掉原始錯誤)');
let threw=false;
SENT=[]; PROPS={};
try { fn('prepareRetro','建立', new Error('原始錯誤')) } catch(e){ threw=true }
check('webhook 沒設定:不拋錯', threw, false);
check('webhook 沒設定:不發卡', SENT.length, 0);
threw=false; PROPS={RETRO_CHAT_WEBHOOK_URL:'u'}; chatThrows=true;
try { fn('reminderTask','提醒', new Error('原始錯誤')) } catch(e){ threw=true }
check('發送失敗:不拋錯', threw, false);
check('有記錄通知本身失敗', H.getLog().some(l=>l.includes('失敗通知本身也失敗')), true);

console.log(`\n========== ${pass} 通過 / ${fail} 失敗 ==========`);
process.exit(fail===0?0:1);
