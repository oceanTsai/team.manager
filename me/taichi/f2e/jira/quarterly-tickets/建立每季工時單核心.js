// ==========================================================================
// QuarterlyTicketCreator.gs - 季度會議單建立核心邏輯(class 封裝)
// ==========================================================================
//
// 【模組用途】
//   在指定 Epic 底下,為某季度建立預定義的會議紀錄單。
//   建立完透過注入的 notifier + messageTemplate 發送結果通知。
//
// 【特性】
//   - 重複保護:建立前會檢查 Epic 下是否已有同名工單,避免重複建單
//   - Reporter 自動帶入:不指定 reporter,Jira 會自動用 API token 擁有者
//   - 通知解耦:本 class 不關心通知怎麼長、用哪個平台,
//             由外部注入 notifier 和 messageTemplate 控制(策略模式)
//
// 【依賴】
//   - JiraIdentityLib(必填,取得 Jira URL 與 admin 認證)
//   - NotifyLib(選填,通知用)
//   - TicketCreationTemplate(選填,渲染通知內容用)
//
// ==========================================================================
// 【API 概覽】
// ==========================================================================
//
//   new QuarterlyTicketCreator({ domain, config, headers, notifier?, messageTemplate? })
//
//   creator.createForQuarter(quarterTag, mode?)  ← 建立指定季度的會議單
//   creator.getCurrentQuarterTag()               ← 取得「現在這一季」的 tag
//   creator.isQuarterStartMonth()                ← 今天是不是季初月份 (1/4/7/10)
//   creator.fetchMyself()                         ← 取得目前 API token 擁有者資訊
//
// ==========================================================================
// 【建構子參數】
// ==========================================================================
//
//   domain      {string}  必填  Jira 網域,例如 jiraEnv.getJiraUrl()
//   config      {Object}  必填  會議單設定:
//                                {
//                                  parentEpic: 'VIPOP-110',
//                                  projectKey: 'VIPOP',
//                                  issueType:  'Task',
//                                  titles: ['標題1', '標題2']
//                                }
//   headers     {Object}  必填  開單用的 auth headers,由外部決定用哪個帳號
//   notifier    {Object}  選填  NotifyLib 建立的 notifier 實例
//                                沒提供就不會發通知(只 log)
//   messageTemplate {Object}  選填  MessageTemplate 子類實例,用來渲染通知
//                                沒提供也不會發通知
//
// ==========================================================================


class QuarterlyTicketCreator {

  /**
   * @param {Object} option
   * @param {string} option.domain    - Jira 網域,例如 jiraEnv.getJiraUrl()
   * @param {Object} option.config    - 會議單設定 { parentEpic, projectKey, issueType, titles }
   * @param {Object} option.headers   - 開單用的 auth headers(必填),由外部決定用哪個帳號
   * @param {Object} [option.notifier] - 通知器(NotifyLib 提供),沒提供就不發通知
   * @param {Object} [option.messageTemplate] - 訊息樣板,沒提供就不發通知
   */
  constructor(option) {
    this._option = {
      domain: option.domain,
      config: option.config,
      notifier: option.notifier || null,
      messageTemplate: option.messageTemplate || null,
      headers: option.headers
    };
  }

  // ------------------------------------------------------------------------
  // 公開 API
  // ------------------------------------------------------------------------

  /**
   * 建立指定季度的會議單
   * @param {string} quarterTag - 例如 'Y26Q1'
   * @param {string} [mode='manual'] - 執行模式,影響通知文案
   * @return {{results: Array}}
   */
  createForQuarter(quarterTag, mode = 'manual') {
    const results = [];

    // 步驟 1:撈取自己的資料,在 log 確認 Reporter 將會是誰
    try {
      const myself = this.fetchMyself();
      Logger.log(`Reporter 將自動設為:${myself.displayName} (${myself.emailAddress})`);
    } catch (e) {
      Logger.log(`⚠ 取得帳號資訊失敗(不影響建單):${e.message}`);
    }

    // 步驟 2:撈出父單底下所有子單的 summary 用於查重
    Logger.log(`\n--- 撈取 ${this._option.config.parentEpic} 底下所有子單以檢查重複 ---`);
    let existingTitles;
    try {
      existingTitles = this._getExistingChildTitles();
      Logger.log(`找到 ${existingTitles.size} 張子單`);
    } catch (e) {
      Logger.log(`✗ 撈取子單失敗,中止: ${e.message}`);
      const errorResults = [{ status: 'error', title: '(撈取子單失敗)', error: e.message }];
      this._notify(quarterTag, mode, errorResults);
      return { results: errorResults };
    }

    // 步驟 3:逐一建立會議單
    this._option.config.titles.forEach((titlePrefix, index) => {
      const fullTitle = `${titlePrefix} (${quarterTag})`;
      Logger.log(`\n--- 第 ${index + 1} 張: ${fullTitle} ---`);

      if (existingTitles.has(fullTitle)) {
        Logger.log(`⏭  已存在同名工單,跳過`);
        results.push({ status: 'skipped', title: fullTitle });
        return;
      }

      try {
        const issueKey = this._createTicket(fullTitle);
        const link = `${this._option.domain}/browse/${issueKey}`;
        Logger.log(`✓ 建立成功: ${issueKey}`);
        Logger.log(`  連結: ${link}`);
        results.push({ status: 'success', title: fullTitle, issueKey, link });
      } catch (e) {
        Logger.log(`✗ 建立失敗: ${e.message}`);
        results.push({ status: 'failed', title: fullTitle, error: e.message });
      }
    });

    Logger.log(`\n========== 處理完成 ==========`);

    // 步驟 4:發送通知
    this._notify(quarterTag, mode, results);

    return { results };
  }

  /**
   * 取得「現在這一季」的 tag
   * @return {string} 例如 'Y26Q2'
   */
  getCurrentQuarterTag() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const yearShort = year % 100;
    const quarter = Math.ceil(month / 3);
    return `Y${yearShort}Q${quarter}`;
  }

  /**
   * 今天是不是季初月份(1/4/7/10)
   * @return {boolean}
   */
  isQuarterStartMonth() {
    const month = new Date().getMonth() + 1;
    return month === 1 || month === 4 || month === 7 || month === 10;
  }

  /**
   * 呼叫 Jira /myself,取得當前 API token 擁有者的資料
   * @return {{accountId, displayName, emailAddress}}
   */
  fetchMyself() {
    const url = `${this._option.domain}/rest/api/3/myself`;
    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: this._option.headers,
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      throw new Error(`HTTP ${response.getResponseCode()}: ${response.getContentText()}`);
    }

    return JSON.parse(response.getContentText());
  }

  // ------------------------------------------------------------------------
  // 私有方法
  // ------------------------------------------------------------------------

  /**
   * 統一通知入口:用 messageTemplate 渲染 → 用 notifier 發送
   * 沒有注入 notifier/messageTemplate 就略過(只 log)
   * @private
   */
  _notify(quarterTag, mode, results) {
    if (!this._option.notifier || !this._option.messageTemplate) {
      Logger.log('⚠ 未注入 notifier 或 messageTemplate,略過通知');
      return;
    }

    try {
      const message = this._option.messageTemplate.render({
        quarterTag: quarterTag,
        mode: mode,
        jiraDomain: this._option.domain,
        parentEpic: this._option.config.parentEpic,
        results: results
      });

      const ok = this._option.notifier.sendCard(message);
      if (ok) {
        Logger.log('✓ 通知已發送');
      } else {
        Logger.log('⚠ 通知發送失敗(詳見前一行 log)');
      }
    } catch (e) {
      Logger.log(`⚠ 通知處理失敗: ${e.message}`);
    }
  }

  /**
   * 撈取 parentEpic 底下所有子單的標題
   * @private
   * @return {Set<string>}
   */
  _getExistingChildTitles() {
    const titles = new Set();
    let nextPageToken = null;
    const jql = `parent = ${this._option.config.parentEpic}`;

    while (true) {
      let url = `${this._option.domain}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=summary&maxResults=100`;
      if (nextPageToken) {
        url += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;
      }

      const response = UrlFetchApp.fetch(url, {
        method: 'get',
        headers: this._option.headers,
        muteHttpExceptions: true
      });

      if (response.getResponseCode() !== 200) {
        throw new Error(`HTTP ${response.getResponseCode()}: ${response.getContentText()}`);
      }

      const data = JSON.parse(response.getContentText());
      (data.issues || []).forEach(i => {
        if (i.fields && i.fields.summary) {
          titles.add(i.fields.summary);
        }
      });

      if (data.isLast || !data.nextPageToken) break;
      nextPageToken = data.nextPageToken;
    }

    return titles;
  }

  /**
   * 建立單張工單
   * @private
   * @param {string} title - 工單標題
   * @return {string} 建立成功後的工單編號
   */
  _createTicket(title) {
    const url = `${this._option.domain}/rest/api/3/issue`;
    const payload = {
      fields: {
        project: { key: this._option.config.projectKey },
        summary: title,
        issuetype: { name: this._option.config.issueType },
        parent: { key: this._option.config.parentEpic }
      }
    };

    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      headers: this._option.headers,
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 201) {
      throw new Error(`HTTP ${response.getResponseCode()}: ${response.getContentText()}`);
    }

    return JSON.parse(response.getContentText()).key;
  }
}
