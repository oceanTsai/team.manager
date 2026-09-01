/**
 * ============================================================
 * 清除排程.gs - 動態排程的檢視與清除工具
 * ============================================================
 * 📦 屬於 SprintProject
 *
 * 用途:
 *   流程卡住(例如上一輪出錯留下殘留排程,導致 prepareSprint 一直被擋)
 *   時,用來查看現況並整個 reset 重來。
 *
 * ⚠️ 只會清除「程式動態建立的一次性排程」:
 *      publishTask  (發布表單)
 *      reminderTask (提醒團隊)
 *
 *    名單定義在 TriggerManager.DYNAMIC_HANDLERS。
 *    你在 GAS 觸發器頁面手動設定的固定排程(例如每週執行 prepareSprint
 *    的那一個)不在名單內,不會被刪掉。
 *
 * ⚠️ 只動排程,不動 Drive。
 *    資料夾、表單、投影片都會保留 —— 刪除 Drive 資料是不可逆操作,
 *    應該由人確認後手動處理,不交給程式判斷。
 *
 * 可執行函式(會出現在 GAS 上方「選擇要執行的函式」下拉選單):
 *   listAllTriggers()       📋 列出所有排程,標示哪些會被清除(不會刪)
 *   clearDynamicTriggers()  🗑️ 清除所有動態排程
 *
 * 建議流程:先跑 listAllTriggers() 看清楚,再跑 clearDynamicTriggers()。
 * ============================================================
 */


/**
 * 【可執行】列出目前所有排程,標示哪些屬於動態排程
 *
 * 不會刪除任何東西,純粹檢視用。
 *
 * @returns {{total: number, dynamic: number, fixed: number}} 統計結果
 */
function listAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  let dynamicCount = 0;

  Logger.log(`========== 目前共有 ${triggers.length} 個排程 ==========`);

  triggers.forEach((trigger, index) => {
    const handler   = trigger.getHandlerFunction();
    const isDynamic = TriggerManager.DYNAMIC_HANDLERS.includes(handler);
    const mark      = isDynamic ? '🗑️ 動態排程(會被清除)' : '🔒 固定排程(保留)';

    if (isDynamic) {
      dynamicCount = dynamicCount + 1;
    }

    Logger.log(`${index + 1}. ${handler.padEnd(16)} ${mark}  ID: ${trigger.getUniqueId()}`);
  });

  const fixedCount = triggers.length - dynamicCount;

  Logger.log('------------------------------------------------');
  Logger.log(`動態排程 ${dynamicCount} 個 / 固定排程 ${fixedCount} 個`);

  if (dynamicCount > 0) {
    Logger.log('執行 clearDynamicTriggers() 可清除上述動態排程');
  } else {
    Logger.log('目前沒有待清除的動態排程,流程處於乾淨狀態');
  }

  return { total: triggers.length, dynamic: dynamicCount, fixed: fixedCount };
}


/**
 * 【可執行】清除所有動態排程,讓流程回到乾淨狀態
 *
 * 清除後可以重新執行 prepareSprint() 建立下一個 Sprint。
 * Drive 上的資料夾與表單不受影響。
 *
 * @returns {number} 實際刪除的排程數量
 */
function clearDynamicTriggers() {
  const targets = ScriptApp.getProjectTriggers()
    .filter((trigger) => TriggerManager.DYNAMIC_HANDLERS.includes(trigger.getHandlerFunction()));

  Logger.log(`========== 準備清除 ${targets.length} 個動態排程 ==========`);

  targets.forEach((trigger) => {
    Logger.log(`🗑️ 刪除 ${trigger.getHandlerFunction()}  ID: ${trigger.getUniqueId()}`);
    ScriptApp.deleteTrigger(trigger);
  });

  Logger.log('------------------------------------------------');

  if (targets.length > 0) {
    Logger.log(`✅ 已清除 ${targets.length} 個動態排程`);
    Logger.log('固定排程未受影響,Drive 上的資料夾與表單也都保留');
    Logger.log('現在可以重新執行 prepareSprint() 建立下一個 Sprint');
  } else {
    Logger.log('沒有動態排程需要清除,流程本來就是乾淨的');
  }

  return targets.length;
}
