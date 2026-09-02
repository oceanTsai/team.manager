/**
 * ============================================================
 * DateFormat.gs - 日期格式化
 * ============================================================
 * 📦 屬於 retrospective
 *
 * 職責:
 *   只做 Date → 字串的轉換,不含任何業務邏輯,也不碰 Drive 或排程。
 *
 * 全部是靜態方法,不需要建立實例:
 *   DateFormat.formatDate(new Date())
 * ============================================================
 */


class DateFormat {

  /**
   * 2026/06/19
   * @param {Date} date
   * @returns {string}
   */
  static formatDate(date) {
    const year  = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day   = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  }

  /**
   * 0619 —— Sprint 資料夾命名用
   * @param {Date} date
   * @returns {string}
   */
  static formatMMDD(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day   = String(date.getDate()).padStart(2, '0');
    return `${month}${day}`;
  }

  /**
   * 2026/06/19 10:00 —— 通知卡片顯示排程時間用
   * @param {Date} date
   * @returns {string}
   */
  static formatDateTime(date) {
    const hour   = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${DateFormat.formatDate(date)} ${hour}:${minute}`;
  }

  /**
   * 週五 —— log 裡確認算出來的日期落在預期的星期
   * @param {Date} date
   * @returns {string}
   */
  static formatWeekday(date) {
    const names = ['日', '一', '二', '三', '四', '五', '六'];
    return `週${names[date.getDay()]}`;
  }
}
