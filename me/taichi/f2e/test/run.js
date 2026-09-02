#!/usr/bin/env node
/**
 * 執行所有測試
 *
 *   node me/taichi/f2e/test/run.js            全部
 *   node me/taichi/f2e/test/run.js retro      只跑檔名含 retro 的
 *
 * 任何一組失敗就以非 0 結束,方便之後接 CI。
 */

const fs        = require('fs');
const path      = require('path');
const { execFileSync } = require('child_process');

const ROOT   = __dirname;
const filter = process.argv[2] || '';

function collectTests(dir) {
  const found = [];

  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      found.push(...collectTests(full));
    } else if (entry.name.endsWith('.test.js')) {
      found.push(full);
    }
  });

  return found;
}

const tests = collectTests(ROOT)
  .filter((f) => path.relative(ROOT, f).includes(filter))
  .sort();

let passed = 0;
let failed = 0;

tests.forEach((file) => {
  const name = path.relative(ROOT, file);
  let output = '';
  let ok     = true;

  try {
    output = execFileSync('node', [file], { encoding: 'utf8' });
  } catch (error) {
    output = String(error.stdout || '') + String(error.stderr || '');
    ok     = false;
  }

  const summary = output.trim().split('\n').pop();
  const count   = (summary.match(/(\d+) 通過/) || [])[1];

  if (ok) {
    passed = passed + Number(count || 0);
  } else {
    failed = failed + 1;
  }

  console.log(`${ok ? '✅' : '❌'} ${name.padEnd(38)} ${summary}`);

  if (!ok) {
    console.log(output);
  }
});

console.log('------------------------------------------------------------');
console.log(failed === 0
  ? `全部通過,共 ${passed} 個檢查(${tests.length} 組)`
  : `${failed} 組失敗`);

process.exit(failed === 0 ? 0 : 1);
