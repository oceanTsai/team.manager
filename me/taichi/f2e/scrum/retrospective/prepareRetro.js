/**
 * ============================================================
 * prepareRetro.gs - 建立下一個 Sprint 回顧(排程入口)
 * ============================================================
 * 📦 屬於 retrospective
 *
 * RetroPreparer 是「編排」角色 —— 把各個單一職責的類別串起來,自己不含
 * 業務邏輯:
 *
 *   SprintFinder         找到現有的 Sprint
 *   SprintPlanner        算出下一個 Sprint 是什麼
 *   SprintFolderBuilder  建資料夾 + 複製表單/投影片
 *   ReminderNotifier     通知主管「已建立」
 *   TriggerManager       排定發布排程
 *
 * 這裡同時是**組裝根**(composition root):所有具體依賴在這裡建立後注入,
 * 底下的類別都只認介面、不自己去拿 Infra。
 *
 * 每個動作都能單獨呼叫 —— 見 手動操作.gs。
 * 失敗時只發通知,不做自動修復:你收到通知後自己補呼叫缺的那一步。
 *
 * 📦 依賴外部 Library:InfraLib(Infra)、NotifyLib(Notify)
 *
 * 🔐 Script Properties:
 *   - RETRO_CHAT_WEBHOOK_URL  個人 Google Chat Webhook URL
 *   - B_TEAM_RETRO_WEBHOOK    團隊 Google Chat Webhook URL
 *
 * ⚠️ prepareRetro() 給每週的固定排程呼叫。
 *    手動想建立資料夾請用 手動操作.gs 的 createSprintFolder()。
 * ============================================================
 */


/* ========== ⚙️ 設定區 ========== */

const SPRINT_OPTIONS = {
  templateFolderId:   '13KzUPSk_wBR73f2feBFbv3qwa2b4NWlP',  // scrum/template 資料夾
  sprintRootFolderId: '16cZbBannmdoUifDlOU7T0VRTp6AH2H6t',  // scrum 根資料夾
  sprintDays:         11,
};


class RetroPreparer {

  /**
   * @param {Object} options - SPRINT_OPTIONS
   */
  constructor(options) {
    const drive = Infra.createDriveClient();

    this._options  = options;
    this._finder   = new SprintFinder(drive, options.sprintRootFolderId);
    this._planner  = new SprintPlanner(options.sprintDays);
    this._builder  = new SprintFolderBuilder(
      drive,
      Infra.createFormClient(),
      options.sprintRootFolderId,
      options.templateFolderId
    );
    this._triggers = new TriggerManager();
  }


  /* ========== 🚀 公開方法 ========== */

  /**
   * 只在「今天已經到下一個 Sprint 的開始日」時才建立,否則跳過
   *
   * 排程觸發與手動執行走同一套日期判斷 —— 不再有「手動就強制執行」的特例,
   * 那個特例是先前「重跑時建出錯誤 Sprint」的根源。
   *
   * @returns {Object|null} 建立結果,或 null(今天不該建立)
   */
  run() {
    const latest = this._finder.findLatest();
    let   result = null;

    Logger.log(`📌 最新 Sprint:${latest.name}(結束於 ${DateFormat.formatDate(latest.endDate)})`);

    if (this._planner.isTimeForNext(latest.endDate)) {
      this._assertNoPendingSprint();
      result = this._createNext();
    } else {
      const expected = this._planner.nextStartDateAfter(latest.endDate);
      Logger.log(`⏸️ 今天不建立 —— ${latest.name} 還沒到下一個開始日`);
      Logger.log(`   預定開始日:${DateFormat.formatDate(expected)}`);
    }

    return result;
  }


  /* ========== 🔒 私有 ========== */

  /**
   * 串起「算 → 建 → 通知 → 排程」四個動作
   * @private
   */
  _createNext() {
    const plan = this._planner.planNext(this._finder.listRecent());

    if (!plan) {
      throw new Error(
        '找不到可接續的 Sprint,無法推算下一個。\n' +
        '若是第一次啟用,請執行 createSprintFolder()。'
      );
    }

    if (this._isPast(plan.endDate)) {
      throw new Error(
        `自動推算出的下一個 Sprint(${plan.name})起訖日已經是過去,` +
        `結束於 ${DateFormat.formatDate(plan.endDate)}。\n` +
        '這代表中間有 Sprint 沒被建立,現在已經接不上實際時間了。\n' +
        '請執行 createSprintFolder(),並視需要在檔案最上方的 MANUAL_SPRINT ' +
        '常數填入正確的年份/起訖日,手動建立目前實際對應的 Sprint。'
      );
    }

    Logger.log(`📆 下一個 Sprint:${plan.name}`);
    Logger.log(`   起始日:${DateFormat.formatDate(plan.startDate)}(${DateFormat.formatWeekday(plan.startDate)})`);
    Logger.log(`   結束日:${DateFormat.formatDate(plan.endDate)}(${DateFormat.formatWeekday(plan.endDate)})`);

    const built = this._builder.build(plan.year, plan.name);

    new ReminderNotifier().notifyCreated({
      sprintName: plan.name,
      startDate:  DateFormat.formatDate(plan.startDate),
      endDate:    DateFormat.formatDate(plan.endDate),
      folderUrl:  built.folderUrl,
      formUrl:    built.formUrl,
      slideUrl:   built.slideUrl,
    });

    this._triggers.schedulePublish(DateFormat.formatDate(plan.endDate));

    Logger.log('🎉 prepareRetro 完成');
    return built;
  }

  /**
   * 判斷指定日期是否已經在今天之前(只比日期,不比時分秒)
   * @private
   */
  _isPast(date) {
    const today  = new Date();
    const target = new Date(date);

    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);

    return target < today;
  }

  /**
   * 確認沒有未完成的 Sprint 流程,有的話中止建立
   *
   * 一次性排程無法攜帶參數,PublishTask / ReminderTask 觸發時只能現場去 Drive
   * 找「結束日最晚的 Sprint」。所以同時存在兩個進行中的 Sprint 時,它們會處理
   * 到錯的那一個。實務上沒有同時跑兩個 Sprint 回顧的需求,直接擋掉最簡單。
   *
   * 走到這裡代表上一個 Sprint 已經結束(日期判斷通過),此時還有殘留排程就是
   * 上一輪出錯沒收乾淨 —— 停下來報錯,不要繼續把狀況搞亂。
   *
   * @private
   * @throws {Error} 還有待處理的動態排程時
   */
  _assertNoPendingSprint() {
    const pending = this._triggers.listPending();

    if (pending.length > 0) {
      const names = pending.map((trigger) => trigger.getHandlerFunction()).join('、');
      throw new Error(
        `上一個 Sprint 的排程還沒收乾淨(待處理:${names})。\n` +
        '這代表上一輪流程中途失敗,先確認狀況再繼續。\n' +
        '處理方式:\n' +
        '  1. 執行 showRetroStatus() 看目前狀態\n' +
        '  2. 若上一個 Sprint 還有步驟沒跑完,到 手動操作.gs 補呼叫缺的那一步\n' +
        '  3. 確認不需要了,執行 clearDynamicTriggers() 清除後再重試'
      );
    }
  }
}


/* ========== 🎯 排程入口(全域函式,不可改名) ========== */

/**
 * 每週固定排程呼叫的入口
 *
 * GAS 的觸發器只能綁全域函式,所以這裡是一層薄包裝,邏輯都在 RetroPreparer。
 *
 * @param {Object} [e] - Apps Script 觸發器傳入的事件物件
 * @returns {Object|null}
 */
function prepareRetro(e) {
  try {
    return new RetroPreparer(SPRINT_OPTIONS).run();
  } catch (error) {
    Logger.log(`❌ prepareRetro 錯誤:${error.message}`);
    notifyFailure('prepareRetro', '建立下一個 Sprint 回顧', error);
    throw error;
  }
}
