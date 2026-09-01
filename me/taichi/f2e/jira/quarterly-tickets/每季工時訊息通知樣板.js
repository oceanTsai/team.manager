/**
 * ============================================================
 * TicketCreationTemplate.gs - 工單建立結果通知樣板
 * ============================================================
 * 📦 屬於主專案
 *
 * 設計目的:
 *   把「季度會議單建立結果」渲染成 Notifier 認得的 Message 結構。
 *   屬於 Notify.MessageTemplate 的業務子類。
 *
 * 依賴:
 *   - Notify(需要 MessageTemplate 基底,識別碼設為 Notify)
 *
 * 使用範例:
 *   const template = new TicketCreationTemplate();
 *   const message = template.render({
 *     quarterTag: 'Y26Q1',
 *     mode: 'manual',
 *     jiraDomain: 'https://104corp.atlassian.net',
 *     parentEpic: 'VIPOP-110',
 *     results: [
 *       { status: 'success', title: '...', issueKey: 'VIPOP-50001', link: '...' },
 *       { status: 'skipped', title: '...' },
 *       { status: 'failed',  title: '...', error: '...' },
 *       { status: 'error',   title: '...', error: '...' }
 *     ]
 *   });
 *
 *   const notifier = Notify.createChatNotifier(webhookUrl);
 *   notifier.sendCard(message);
 * ============================================================
 */
const _MessageTemplate = Notify.getMessageTemplateClass();

class TicketCreationTemplate extends _MessageTemplate {

  /**
   * 把工單建立結果渲染成通用 Message 結構
   *
   * @param {Object} data
   * @param {string} data.quarterTag   - 季度標籤,例如 'Y26Q1'
   * @param {string} data.mode         - 執行模式 'manual' / 'manual-specific' / 'scheduled'
   * @param {string} data.jiraDomain   - Jira 網域
   * @param {string} data.parentEpic   - 父單 Epic 編號
   * @param {Array}  data.results      - 各張單的處理結果
   *                                     [{ status, title, issueKey?, link?, error? }, ...]
   * @returns {Object} Message 結構 { title, fields, actions }
   */
  render(data) {
    const { quarterTag, mode, jiraDomain, parentEpic, results } = data;

    const successCount = results.filter(r => r.status === 'success').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;
    const failedCount  = results.filter(r => r.status === 'failed' || r.status === 'error').length;

    return {
      title:   `${this._headerEmoji(successCount, failedCount)} 季度會議單建立通知 - ${quarterTag}`,
      fields:  this._buildFields({ mode, jiraDomain, parentEpic, results, successCount, skippedCount, failedCount }),
      actions: this._buildActions(results)
    };
  }

  // ------------------------------------------------------------------------
  // 私有方法
  // ------------------------------------------------------------------------

  /**
   * 根據成功/失敗數決定標題 emoji
   * @private
   */
  _headerEmoji(successCount, failedCount) {
    if (failedCount > 0 && successCount === 0) return '❌';
    if (failedCount > 0) return '⚠️';
    return '✅';
  }

  /**
   * 組裝所有 fields
   * @private
   */
  _buildFields({ mode, jiraDomain, parentEpic, results, successCount, skippedCount, failedCount }) {
    const fields = [
      { label: '執行模式', value: this._formatMode(mode) },
      { label: '父單', value: parentEpic, link: `${jiraDomain}/browse/${parentEpic}` },
      { label: '統計', value: `成功 ${successCount} / 跳過 ${skippedCount} / 失敗 ${failedCount}` }
    ];

    results.forEach((r, i) => {
      const field = this._buildResultField(i + 1, r);
      if (field) fields.push(field);
    });

    return fields;
  }

  /**
   * 組裝 actions:每張成功建立的單放一個快速連結
   * @private
   */
  _buildActions(results) {
    return results
      .filter(r => r.status === 'success' && r.link)
      .map(r => ({ text: `開啟 ${r.issueKey}`, url: r.link }));
  }

  /**
   * 把單一張單的處理結果轉成 field
   * @private
   */
  _buildResultField(num, r) {
    if (r.status === 'success') {
      return { label: `${num}. ✓ 建立成功`, value: `${r.issueKey} - ${r.title}`, link: r.link };
    }
    if (r.status === 'skipped') {
      return { label: `${num}. ⏭ 已存在`, value: r.title };
    }
    if (r.status === 'failed') {
      return { label: `${num}. ✗ 建立失敗`, value: `${r.title}\n錯誤:${r.error}` };
    }
    if (r.status === 'error') {
      return { label: `${num}. ❌ 錯誤`, value: `${r.title}\n錯誤:${r.error}` };
    }
    return null;
  }

  /**
   * 執行模式中文化
   * @private
   */
  _formatMode(mode) {
    const map = {
      'manual':          '手動執行(本季)',
      'manual-specific': '手動執行(指定季度)',
      'scheduled':       '排程自動執行'
    };
    return map[mode] || mode;
  }
}
