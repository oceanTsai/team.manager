/**
 * ============================================================
 * SprintPlanner.gs - 推算「下一個 Sprint 該是什麼」
 * ============================================================
 * 📦 屬於 retrospective
 *
 * 職責:
 *   純計算。給它現有的 Sprint 清單,算出下一個的名稱與起訖日。
 *
 * ⚠️ 完全不碰 Drive:
 *   Sprint 清單由呼叫端傳進來(SprintFinder 負責去找)。
 *   這樣這個類別可以完全用單元測試涵蓋,不需要任何 Google 服務。
 *
 * ⚠️ 也不做這些事:
 *   不建立資料夾、不排程、不發通知。
 *
 * 業務規則:
 *   - Sprint 週一開始,第二週週五結束(起訖相差 sprintDays 天,預設 11)
 *   - 下一個 Sprint 從「上一個結束日之後的第一個週一」開始
 *   - 資料夾命名 MMDD-MMDD,依「開始日的年份」歸檔
 * ============================================================
 */


class SprintPlanner {

  /** 上一個 Sprint 結束後,隔幾天是下一個的開始日(週五 + 3 = 下週一) */
  static get DAYS_TO_NEXT_START() { return 3; }

  /**
   * @param {number} [sprintDays=11] - Sprint 起訖相差天數
   */
  constructor(sprintDays) {
    this._sprintDays = sprintDays || 11;
  }


  /* ========== 📆 推算 ========== */

  /**
   * 接續現有的 Sprint,推算下一個
   *
   * @param {{name: string, endDate: Date}|null} latestSprint
   *        目前最新的 Sprint(SprintFinder.findLatest() 的回傳),沒有就傳 null
   * @returns {{name: string, startDate: Date, endDate: Date, year: number,
   *            basedOn: Object}|null}
   *          latestSprint 為 null 時回傳 null(不拋錯,由呼叫端決定怎麼處理)
   */
  planNext(latestSprint) {
    let plan = null;

    if (latestSprint) {
      const start = SprintPlanner._nextMondayAfter(latestSprint.endDate);
      const end   = SprintPlanner._addDays(start, this._sprintDays);

      plan = {
        name:      `${DateFormat.formatMMDD(start)}-${DateFormat.formatMMDD(end)}`,
        startDate: start,
        endDate:   end,
        year:      start.getFullYear(),   // 依開始日歸檔,跨年 Sprint 才會放對年度資料夾
        basedOn:   latestSprint,
      };
    }

    return plan;
  }

  /**
   * 從今天推算「第一個」Sprint —— 只在完全沒有任何 Sprint 資料夾時使用
   *
   * 規則:從本週一開始(涵蓋今天),往後 sprintDays 天。
   * 之所以是本週一而不是下週一:會走到這條路通常是第一次啟用,
   * 會希望立刻有東西可以用,而不是再等一週。
   *
   * @returns {{name: string, startDate: Date, endDate: Date, year: number}}
   */
  planFirst() {
    const start = SprintPlanner._thisMonday(new Date());
    const end   = SprintPlanner._addDays(start, this._sprintDays);

    return {
      name:      `${DateFormat.formatMMDD(start)}-${DateFormat.formatMMDD(end)}`,
      startDate: start,
      endDate:   end,
      year:      start.getFullYear(),
    };
  }


  /* ========== ⏱️ 時機判斷 ========== */

  /**
   * 今天是否已經到了「該建立下一個 Sprint」的時間
   *
   * @param {Date} latestEndDate - 最新 Sprint 的結束日
   * @returns {boolean}
   */
  isTimeForNext(latestEndDate) {
    const expectedStart = this.nextStartDateAfter(latestEndDate);
    const today         = new Date();

    today.setHours(0, 0, 0, 0);
    expectedStart.setHours(0, 0, 0, 0);

    return today >= expectedStart;
  }

  /**
   * 算出下一個 Sprint 的預定開始日(結束日 + 3 天)
   *
   * @param {Date} latestEndDate
   * @returns {Date}
   */
  nextStartDateAfter(latestEndDate) {
    return SprintPlanner._addDays(latestEndDate, SprintPlanner.DAYS_TO_NEXT_START);
  }


  /* ========== 🔒 私有:日期計算 ========== */

  /**
   * 取得指定日期「之後」的第一個週一(不含當天)
   * @private
   */
  static _nextMondayAfter(date) {
    const next = new Date(date);

    next.setDate(next.getDate() + 1);
    while (next.getDay() !== 1) {
      next.setDate(next.getDate() + 1);
    }

    return next;
  }

  /**
   * 取得指定日期所在那一週的週一(含當天)
   * @private
   */
  static _thisMonday(date) {
    const monday = new Date(date);

    monday.setHours(0, 0, 0, 0);
    while (monday.getDay() !== 1) {
      monday.setDate(monday.getDate() - 1);
    }

    return monday;
  }

  /** @private */
  static _addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
