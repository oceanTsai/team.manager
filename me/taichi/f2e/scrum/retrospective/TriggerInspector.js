/**
 * ============================================================
 * TriggerInspector.gs - 動態排程的檢視與清除
 * ============================================================
 * 📦 屬於 retrospective
 *
 * 職責:
 *   把「目前有哪些排程、哪些該清」呈現給人看,以及執行清除。
 *
 * ⚠️ 只會處理「程式動態建立的一次性排程」:
 *      publishTask  (發布表單)
 *      reminderTask (提醒團隊)
 *
 *    名單定義在 TriggerManager.DYNAMIC_HANDLERS。
 *    你在 GAS 觸發器頁面手動設定的固定排程(例如每週執行 prepareRetro
 *    的那一個)不在名單內,不會被碰到。
 *
 * ⚠️ 只動排程,不動 Drive:
 *    資料夾、表單、投影片都會保留。刪除 Drive 資料是不可逆操作,
 *    應該由人確認後手動處理,不交給程式判斷。
 * ============================================================
 */


class TriggerInspector {

  /**
   * 列出所有排程,標示哪些屬於動態排程
   *
   * 不會刪除任何東西,純檢視用。
   *
   * @returns {{total: number, dynamic: number, fixed: number}}
   */
  listAll() {
    const triggers = ScriptApp.getProjectTriggers();
    let   dynamic  = 0;

    Logger.log(`========== 目前共有 ${triggers.length} 個排程 ==========`);

    triggers.forEach((trigger, index) => {
      const handler   = trigger.getHandlerFunction();
      const isDynamic = TriggerManager.DYNAMIC_HANDLERS.includes(handler);
      const mark      = isDynamic ? '🗑️ 動態排程(會被清除)' : '🔒 固定排程(保留)';

      if (isDynamic) {
        dynamic = dynamic + 1;
      }

      Logger.log(`${index + 1}. ${handler.padEnd(16)} ${mark}  ID: ${trigger.getUniqueId()}`);
    });

    const fixed = triggers.length - dynamic;

    Logger.log('------------------------------------------------');
    Logger.log(`動態排程 ${dynamic} 個 / 固定排程 ${fixed} 個`);

    if (dynamic > 0) {
      Logger.log('執行 clearDynamicTriggers() 可清除上述動態排程');
    } else {
      Logger.log('目前沒有待清除的動態排程,流程處於乾淨狀態');
    }

    return { total: triggers.length, dynamic: dynamic, fixed: fixed };
  }

  /**
   * 清除所有動態排程,讓流程回到乾淨狀態
   *
   * 清除後可以重新執行 prepareRetro()。Drive 上的資料夾與表單不受影響。
   *
   * @returns {number} 實際刪除的排程數量
   */
  clearDynamic() {
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
      Logger.log('現在可以重新執行 prepareRetro() 建立下一個 Sprint');
    } else {
      Logger.log('沒有動態排程需要清除,流程本來就是乾淨的');
    }

    return targets.length;
  }
}
