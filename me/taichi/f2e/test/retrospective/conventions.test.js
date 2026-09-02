const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', '..', 'scrum', 'retrospective') + path.sep;
const files = fs.readdirSync(DIR).filter(f=>f.endsWith('.js'));
const read = f => fs.readFileSync(DIR+f,'utf8');
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*/g,'');
const all = files.map(read).join('\n');

let pass=0,fail=0;
const check=(l,a,e)=>{const ok=String(a)===String(e);
  console.log(`  ${ok?'✅':'❌'} ${l}  →  ${a}${ok?'':`  (預期 ${e})`}`);ok?pass++:fail++};

console.log('【命名規範】class 是名詞、方法是動詞、私有才有 _');
const classes = all.match(/^class (\w+)/gm).map(s=>s.replace('class ',''));
check('所有 class 都是大駝峰名詞', classes.every(c=>/^[A-Z][A-Za-z]+$/.test(c)), true);
check('沒有 class 以 _ 開頭', classes.some(c=>c.startsWith('_')), false);
const publicMethods = all.match(/^  ([a-z]\w*)\(/gm).map(s=>s.trim().replace('(',''));
const verbs = /^(render|calc|format|find|list|plan|is|next|build|validate|publish|describe|run|schedule|cancel|delete|clean|notify|clear)/;
const badVerbs = [...new Set(publicMethods)].filter(m=>m!=='constructor' && !verbs.test(m));
check(`公開方法都是動詞開頭${badVerbs.length?' — '+badVerbs.join(','):''}`, badVerbs.length, 0);

console.log('\n【封裝】私有成員一律加 _');
const fieldAssigns = [...new Set((all.match(/this\.[a-zA-Z]\w* *=/g)||[]).map(s=>s.replace(/ *=$/,'')))];
const publicFields = fieldAssigns.filter(f=>!f.startsWith('this._'));
check(`沒有公開欄位${publicFields.length?' — '+publicFields.join(','):''}`, publicFields.length, 0);

console.log('\n【依賴反轉】類別不自己去拿 Infra，由建構子注入');
['SprintFinder.js','SprintPlanner.js','SprintFolderBuilder.js','SprintForm.js'].forEach(f=>{
  check(`${f} 不呼叫 Infra.create*`, /Infra\.create/.test(stripComments(read(f))), false);
});
check('SprintPlanner 完全不碰 Drive', /drive|Drive/.test(read('SprintPlanner.js').replace(/\/\*[\s\S]*?\*\//g,'')), false);

console.log('\n【組裝根】只有編排層與手動入口建立具體依賴');
const composition = ['prepareRetro.js','PublishTask.js','ReminderTask.js','手動操作.js'];
const others = files.filter(f=>!composition.includes(f));
const leaked = others.filter(f=>/Infra\.create/.test(stripComments(read(f))));
check(`底層類別沒有洩漏建立依賴${leaked.length?' — '+leaked.join(','):''}`, leaked.length, 0);

console.log('\n【GAS 限制】排程與選單入口必須是全域函式');
['prepareRetro','publishTask','reminderTask'].forEach(f=>{
  check(`${f} 是全域函式`, new RegExp(`^function ${f}\\(`,'m').test(all), true);
});

console.log('\n【全域污染】沒有重複宣告(GAS 共用全域，撞名會靜默覆蓋)');
const globals = (all.match(/^(class|function|const) [\w$]+/gm)||[]).map(s=>s.split(' ')[1]);
const dupes = globals.filter((g,i)=>globals.indexOf(g)!==i);
check(`無重複宣告${dupes.length?' — '+dupes.join(','):''}`, dupes.length, 0);

console.log('\n【單一出口】不使用預先 return');
const guardReturns = [];
files.forEach(f=>{
  read(f).split('\n').forEach((line,i)=>{
    if (/^\s{2,}if \(.*\) return |^\s{2,}return;$/.test(line)) guardReturns.push(`${f}:${i+1}`);
  });
});
check(`沒有 guard clause${guardReturns.length?' — '+guardReturns.join(','):''}`, guardReturns.length, 0);

console.log('\n【危險函式】名為 test 實為正式執行的已移除');
['testScheduledRun','testValidate','testReminderNotifier'].forEach(f=>{
  check(`${f} 不存在`, new RegExp(`^function ${f}\\(`,'m').test(all), false);
});

console.log(`\n========== ${pass} 通過 / ${fail} 失敗 ==========`);
process.exit(fail===0?0:1);
