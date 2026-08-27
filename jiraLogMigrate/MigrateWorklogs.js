// ==========================================================================
// WorklogMigrator.gs - Worklog 搬移核心邏輯(class 封裝)
// ==========================================================================
//
// 【模組用途】
//   把 Jira 某張工單的 worklog 按指定條件搬到另一張工單。
//   搬移時用對應使用者的 token 在目標單建立新 worklog,以保留原作者身份。
//
// 【特性】
//   - 不記錄進度:每次都重新撈來源,搬完即刪,自然不會重複
//   - 自動超時保護:跑到時間上限會主動中斷,回傳 finished=false
//   - 斷點續跑:中斷後再執行同一個 function 就會接續處理
//   - 跳過明細追蹤:無對應 user / 缺 token 的 worklog 會收集起來統一列出
//
// 【依賴】
//   - EnvLib(Jira 環境變數 Library,需先掛載並設定識別碼為 EnvLib)
//   - 主程式需提供 userMapping(name 別名 → user key 對應)
//
// ==========================================================================
// 【API 概覽】
// ==========================================================================
//
//   new WorklogMigrator({ jiraEnv, userMapping, maxRuntimeSeconds?, sleepMs? })
//
//   migrator.migrate({ source, target, filter, label? })       ← 底層通用
//   migrator.migrateQuarter({ source, target, year, quarter }) ← 按季度搬
//   migrator.migrateYear({ source, target, year })             ← 按年搬
//
//   所有 migrate 方法回傳:
//     { finished, success, failed, skipped, skippedDetails }
//
// ==========================================================================
// 【建構子參數】
// ==========================================================================
//
//   jiraEnv             {Object}  必填  從 EnvLib.jiraEnv() 取得的單例
//   userMapping         {Object}  必填  使用者名字對應表,格式如下:
//                                       {
//                                         BRIAN: ['Brian Chao', '趙軒弘', 'Brian'],
//                                         ENYA:  ['Enya Chen', '陳恩雅', 'Enya'],
//                                         ...
//                                       }
//                                       key 必須對應 EnvLib 的 user enum
//                                       (代表會去讀 JIRA_EMAIL_BRIAN / JIRA_TOKEN_BRIAN)
//                                       value 陣列放這位使用者在 Jira 上可能出現的所有顯示名稱
//   maxRuntimeSeconds   {number}  選填  執行時間上限(秒),預設 330(5.5 分鐘)
//                                       Apps Script 單次執行上限 6 分鐘,330 留 30 秒緩衝
//   sleepMs             {number}  選填  每筆處理後 sleep 毫秒數,預設 300
//                                       避免打太快觸發 Jira rate limit
//
// ==========================================================================
// 【方法 1】migrateQuarter — 按季度搬移(最常用)
// ==========================================================================
//
//   migrator.migrateQuarter({ source, target, year, quarter })
//
//   參數:
//     source   {string} 來源工單,例如 'VIPOP-45336'
//     target   {string} 目標工單,例如 'VIPOP-50001'
//     year     {number} 西元年,例如 2026
//     quarter  {number} 1 / 2 / 3 / 4
//
//   範例:把 VIPOP-45336 的 2026 Q1 worklog 搬到 VIPOP-50001
//     migrator.migrateQuarter({
//       source: 'VIPOP-45336',
//       target: 'VIPOP-50001',
//       year: 2026,
//       quarter: 1
//     });
//
// ==========================================================================
// 【方法 2】migrateYear — 按年搬移
// ==========================================================================
//
//   migrator.migrateYear({ source, target, year })
//
//   參數:
//     source   {string} 來源工單
//     target   {string} 目標工單
//     year     {number} 西元年,例如 2026
//
//   範例:把 VIPOP-36105 整個 2026 年的 worklog 搬到 VIPOP-45336
//     migrator.migrateYear({
//       source: 'VIPOP-36105',
//       target: 'VIPOP-45336',
//       year: 2026
//     });
//
// ==========================================================================
// 【方法 3】migrate — 底層通用方法,用任意 filter
// ==========================================================================
//
//   migrator.migrate({ source, target, filter, label })
//
//   參數:
//     source   {string}     來源工單
//     target   {string}     目標工單
//     filter   {Function}   (worklog) => boolean,回傳 true 才會被搬
//     label    {string}     選填,log 用的標籤,例如 'Y26Q1'
//
//   filter 拿到的 worklog 物件:
//     {
//       id: "1279441",
//       started: "2026-03-10T10:15:00.000+0800",   // 工時發生時間
//       timeSpent: "10m",                           // 工時長度(人類可讀)
//       timeSpentSeconds: 600,                      // 工時長度(秒)
//       author: {
//         displayName: "Brian Chao 趙軒弘",          // 作者顯示名
//         accountId: "712020:xxx..."
//       },
//       comment: { ... }                            // 註解(ADF 格式)
//     }
//
//   filter 範例:
//
//   (a) 搬某個月的(例如 2026 年 5 月)
//     filter: wl => {
//       const d = new Date(wl.started);
//       return d.getFullYear() === 2026 && d.getMonth() === 4;  // 月份從 0 起算
//     }
//
//   (b) 搬某個人的
//     filter: wl => wl.author.displayName.includes('Brian')
//
//   (c) 搬工時超過 1 小時的
//     filter: wl => wl.timeSpentSeconds > 3600
//
//   (d) 搬特定日期範圍
//     filter: wl => {
//       const d = new Date(wl.started);
//       return d >= new Date('2026-03-01') && d <= new Date('2026-03-31T23:59:59');
//     }
//
//   (e) 多條件組合(某人在某季的工時)
//     filter: wl => {
//       if (!wl.author.displayName.includes('Brian')) return false;
//       const d = new Date(wl.started);
//       if (d.getFullYear() !== 2026) return false;
//       return Math.ceil((d.getMonth() + 1) / 3) === 1;
//     }
//
//   (f) 全部都搬(無條件)
//     filter: wl => true
//
// ==========================================================================
// 【回傳值】所有 migrate 方法共用
// ==========================================================================
//
//   {
//     finished:         {boolean}   true = 全部搬完(或無符合條件的)
//                                   false = 超時被中斷,需要再執行接續
//     success:          {number}    本次成功搬移的筆數
//     failed:           {number}    本次處理失敗的筆數
//     skipped:          {number}    本次跳過的筆數(找不到 user / 缺 token)
//     skippedDetails:   {Array}     跳過的 worklog 明細
//                                   [{ id, author, reason }, ...]
//   }
//
//   注意:當 finished = false,主程式應該立刻 return,不要繼續執行後面的 task,
//        因為時間已經用光。再執行一次主函式就會自動接續。
//
// ==========================================================================
// 【完整使用範例】
// ==========================================================================
//
//   function migrateToQuarters() {
//     const migrator = new WorklogMigrator({
//       jiraEnv: EnvLib.jiraEnv(),
//       userMapping: USER_MAPPING
//     });
//
//     const tasks = [
//       { source: 'VIPOP-45336', target: 'VIPOP-50001', year: 2026, quarter: 1 },
//       { source: 'VIPOP-45336', target: 'VIPOP-50002', year: 2026, quarter: 2 }
//     ];
//
//     for (const task of tasks) {
//       const result = migrator.migrateQuarter(task);
//       if (!result.finished) {
//         Logger.log('⏸ 超時中斷,請再執行一次');
//         return;
//       }
//     }
//     Logger.log('✓ 全部完成');
//   }
//
// ==========================================================================


class WorklogMigrator {

  /**
   * @param {Object} opts
   * @param {Object} opts.jiraEnv         - EnvLib.jiraEnv() 取得的單例
   * @param {Object} opts.userMapping     - { KEY: [...name aliases] }
   * @param {number} [opts.maxRuntimeSeconds=330] - 執行時間上限(秒),預設 5.5 分鐘
   * @param {number} [opts.sleepMs=300]   - 每筆處理後 sleep 毫秒數,避免 rate limit
   */
  constructor({ jiraEnv, userMapping, maxRuntimeSeconds = 330, sleepMs = 300 }) {
    this.jira = jiraEnv;
    this.userMapping = userMapping;
    this.maxRuntime = maxRuntimeSeconds;
    this.sleepMs = sleepMs;
    this.startTime = new Date().getTime();
    this.domain = jiraEnv.getJiraUrl();
    this.adminHeaders = jiraEnv.getAdmin().authHeaders;
  }

  // ------------------------------------------------------------------------
  // 公開 API
  // ------------------------------------------------------------------------

  /**
   * 底層通用搬移方法 - 用任意 filter
   * @param {Object} opts
   * @param {string} opts.source       - 來源工單編號
   * @param {string} opts.target       - 目標工單編號
   * @param {Function} opts.filter     - (worklog) => boolean,決定該筆要不要搬
   * @param {string} [opts.label]      - log 用的標籤,例如 'Y26Q1'
   * @return {{finished, success, failed, skipped, skippedDetails}}
   */
  migrate({ source, target, filter, label }) {
    const labelText = label ? ` (${label})` : '';
    Logger.log(`\n========== 處理: ${source} -> ${target}${labelText} ==========`);

    // 每次都重新撈來源,還在的就是還沒搬的
    const worklogs = this._getAllWorklogs(source);
    const pending = worklogs.filter(filter);
    Logger.log(`[${source}]${labelText} 目前還剩 ${pending.length} 筆符合條件的 worklog`);

    if (pending.length === 0) {
      Logger.log(`[${source}]${labelText} 已搬完 ✓`);
      return this._buildResult(true, 0, 0, 0, []);
    }

    let success = 0, failed = 0, skipped = 0;
    const skippedDetails = [];

    for (let i = 0; i < pending.length; i++) {
      if (this._isTimeUp()) {
        const elapsed = this._elapsedSeconds();
        Logger.log(`\n⏰ 已執行 ${elapsed.toFixed(0)} 秒,中斷此次執行`);
        Logger.log(`[${source}]${labelText} 本次:成功 ${success} / 失敗 ${failed} / 跳過 ${skipped}`);
        return this._buildResult(false, success, failed, skipped, skippedDetails);
      }

      const wl = pending[i];
      const authorName = wl.author.displayName;
      const remaining = (this.maxRuntime - this._elapsedSeconds()).toFixed(0);
      Logger.log(`\n--- 第 ${i + 1}/${pending.length} 筆 (剩 ${remaining}s) ---`);
      Logger.log(`作者: ${authorName} | 時間: ${wl.started} | 工時: ${wl.timeSpent} | ID: ${wl.id}`);

      // 找對應 user
      const userKey = this._findUserKey(authorName);
      if (!userKey) {
        Logger.log(`✗ 找不到對應使用者,跳過`);
        skipped++;
        skippedDetails.push({ id: wl.id, author: authorName, reason: '找不到對應使用者' });
        continue;
      }

      // 從 EnvLib 取 user 認證
      let userHeaders;
      try {
        userHeaders = this.jira.getUser(userKey).authHeaders;
      } catch (e) {
        Logger.log(`✗ ${userKey} 沒有設定 email 或 token,跳過`);
        skipped++;
        skippedDetails.push({ id: wl.id, author: authorName, reason: `${userKey} 沒有設定 email/token` });
        continue;
      }

      // 新增到目標 → 從來源刪除
      try {
        const newWl = this._addWorklog(target, wl, userHeaders);
        Logger.log(`✓ 已用 ${userKey} 身份新增到 ${target} (新 ID: ${newWl.id})`);
        this._deleteWorklog(source, wl.id, userHeaders);
        Logger.log(`✓ 已從 ${source} 刪除 (ID: ${wl.id})`);
        success++;
      } catch (e) {
        Logger.log(`✗ 處理失敗: ${e.message}`);
        failed++;
      }
      Utilities.sleep(this.sleepMs);
    }

    Logger.log(`\n[${source} -> ${target}]${labelText} 本次:成功 ${success} / 失敗 ${failed} / 跳過 ${skipped}`);
    this._logSkippedDetails(source, skippedDetails);

    return this._buildResult(true, success, failed, skipped, skippedDetails);
  }

  /**
   * 按季度搬移(語法糖)
   * @param {Object} opts
   * @param {string} opts.source
   * @param {string} opts.target
   * @param {number} opts.year     - 例如 2026
   * @param {number} opts.quarter  - 1 / 2 / 3 / 4
   */
  migrateQuarter({ source, target, year, quarter }) {
    if (quarter < 1 || quarter > 4) {
      throw new Error(`quarter 必須是 1~4,收到: ${quarter}`);
    }
    const filter = wl => {
      const d = new Date(wl.started);
      if (d.getFullYear() !== year) return false;
      const wlQuarter = Math.ceil((d.getMonth() + 1) / 3);
      return wlQuarter === quarter;
    };
    const yearShort = year % 100;
    const label = `Y${yearShort}Q${quarter}`;
    return this.migrate({ source, target, filter, label });
  }

  /**
   * 按年搬移(語法糖,跟原本的需求一致)
   * @param {Object} opts
   * @param {string} opts.source
   * @param {string} opts.target
   * @param {number} opts.year
   */
  migrateYear({ source, target, year }) {
    const filter = wl => new Date(wl.started).getFullYear() === year;
    return this.migrate({ source, target, filter, label: `Y${year}` });
  }

  // ------------------------------------------------------------------------
  // 私有方法
  // ------------------------------------------------------------------------

  /**
   * 累積耗時(秒)
   * @private
   */
  _elapsedSeconds() {
    return (new Date().getTime() - this.startTime) / 1000;
  }

  /**
   * 是否已超過時間上限
   * @private
   */
  _isTimeUp() {
    return this._elapsedSeconds() > this.maxRuntime;
  }

  /**
   * 根據 Jira author display name 反查 user key
   * 比對方式:完全相符 / 子字串雙向比對
   * @private
   */
  _findUserKey(authorDisplayName) {
    if (!authorDisplayName) return null;
    const target = authorDisplayName.toLowerCase().trim();
    for (const key of Object.keys(this.userMapping)) {
      const names = this.userMapping[key];
      for (const n of names) {
        const candidate = n.toLowerCase().trim();
        if (candidate === target) return key;
        if (target.includes(candidate)) return key;
        if (candidate.includes(target)) return key;
      }
    }
    return null;
  }

  /**
   * 取得指定工單的所有 worklog(自動處理分頁)
   * @private
   */
  _getAllWorklogs(issueKey) {
    const all = [];
    let startAt = 0;
    const maxResults = 100;
    while (true) {
      const url = `${this.domain}/rest/api/3/issue/${issueKey}/worklog?startAt=${startAt}&maxResults=${maxResults}`;
      const response = UrlFetchApp.fetch(url, {
        method: 'get', headers: this.adminHeaders, muteHttpExceptions: true
      });
      if (response.getResponseCode() !== 200) {
        throw new Error(`取得 worklog 失敗 (${issueKey}): ${response.getResponseCode()}`);
      }
      const data = JSON.parse(response.getContentText());
      all.push(...data.worklogs);
      if (startAt + data.worklogs.length >= data.total) break;
      startAt += maxResults;
    }
    return all;
  }

  /**
   * 在目標工單新增 worklog,保留原 timeSpent / started / comment
   * @private
   */
  _addWorklog(targetIssue, originalWorklog, headers) {
    const url = `${this.domain}/rest/api/3/issue/${targetIssue}/worklog?notifyUsers=false`;
    const originalComment = this._extractCommentText(originalWorklog.comment);
    const payload = {
      timeSpentSeconds: originalWorklog.timeSpentSeconds,
      started: originalWorklog.started
    };
    if (originalComment) {
      payload.comment = {
        type: 'doc', version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: originalComment }] }]
      };
    }
    const response = UrlFetchApp.fetch(url, {
      method: 'post', headers: headers,
      payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    if (response.getResponseCode() !== 201) {
      throw new Error(`新增 worklog 失敗: ${response.getResponseCode()} - ${response.getContentText()}`);
    }
    return JSON.parse(response.getContentText());
  }

  /**
   * 從來源工單刪除指定 worklog
   * @private
   */
  _deleteWorklog(sourceIssue, worklogId, headers) {
    const url = `${this.domain}/rest/api/3/issue/${sourceIssue}/worklog/${worklogId}?notifyUsers=false&adjustEstimate=leave`;
    const response = UrlFetchApp.fetch(url, {
      method: 'delete', headers: headers, muteHttpExceptions: true
    });
    if (response.getResponseCode() !== 204) {
      throw new Error(`刪除 worklog 失敗: ${response.getResponseCode()} - ${response.getContentText()}`);
    }
  }

  /**
   * 從 ADF (Atlassian Document Format) comment 取出純文字
   * @private
   */
  _extractCommentText(comment) {
    if (!comment) return '';
    if (typeof comment === 'string') return comment;
    let text = '';
    function traverse(node) {
      if (node.text) text += node.text;
      if (node.content && Array.isArray(node.content)) {
        node.content.forEach(traverse);
        if (node.type === 'paragraph') text += '\n';
      }
    }
    traverse(comment);
    return text.trim();
  }

  /**
   * 列出跳過明細(方便事後人工處理)
   * @private
   */
  _logSkippedDetails(source, skippedDetails) {
    if (skippedDetails.length === 0) return;
    Logger.log(`\n[${source}] 跳過明細:`);
    skippedDetails.forEach((s, i) => {
      Logger.log(`  ${i + 1}. ID=${s.id} | 作者=${s.author} | 原因=${s.reason}`);
    });
    Logger.log(`⚠ 上述 worklog 還留在 ${source},需手動處理`);
  }

  /**
   * 組合 result 物件
   * @private
   */
  _buildResult(finished, success, failed, skipped, skippedDetails) {
    return { finished, success, failed, skipped, skippedDetails };
  }
}