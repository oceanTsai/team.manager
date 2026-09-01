/**
 * ============================================================
 * SheetClient.gs - Google 試算表 API 客戶端
 * ============================================================
 * 📦 屬於 WorkspaceLib 函式庫
 *
 * 設計模式:Factory Function Pattern(帶參數)
 *   - 工廠函式接收 spreadsheetId,綁定該試算表
 *   - 同一份試算表只 openById 一次
 *
 * ⚠️ 跟其他 Client 不同:工廠函式需傳入 spreadsheetId
 *
 * 對外能力:
 *   📊 工作表:getSheet / getSheetNames / sheetExists / createSheet / deleteSheet / renameSheet
 *   📖 讀取:  getAllData / getValues / getRow / getColumn / getCell
 *   ✍️ 寫入:  setValues / setCell / appendRow / appendRows
 *   🧹 清除:  clearSheet / clearRange
 * ============================================================
 */


/* ========== 🏗️ 內部 Class 定義(不直接對外) ========== */

class SheetClient {

  /**
   * @param {string} spreadsheetId
   */
  constructor(spreadsheetId) {
    /** @type {string} */
    this.spreadsheetId = spreadsheetId;

    /** @type {GoogleAppsScript.Spreadsheet.Spreadsheet} */
    this.spreadsheet = SpreadsheetApp.openById(spreadsheetId);

    /** @private @type {Object<string, GoogleAppsScript.Spreadsheet.Sheet>} */
    this._sheetCache = {};
  }


  /* ========== 📊 工作表管理 ========== */

  /**
   * 取得指定工作表(有快取)
   * @param {string} sheetName
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  getSheet(sheetName) {
    if (!this._sheetCache[sheetName]) {
      const sheet = this.spreadsheet.getSheetByName(sheetName);
      if (!sheet) throw new Error(`找不到工作表「${sheetName}」`);
      this._sheetCache[sheetName] = sheet;
    }
    return this._sheetCache[sheetName];
  }

  /**
   * 列出所有工作表名稱
   * @returns {string[]}
   */
  getSheetNames() {
    return this.spreadsheet.getSheets().map((s) => s.getName());
  }

  /**
   * 檢查工作表是否存在
   * @param {string} sheetName
   * @returns {boolean}
   */
  sheetExists(sheetName) {
    return this.spreadsheet.getSheetByName(sheetName) !== null;
  }

  /**
   * 新增工作表
   * @param {string} sheetName
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  createSheet(sheetName) {
    const sheet = this.spreadsheet.insertSheet(sheetName);
    this._sheetCache[sheetName] = sheet;
    return sheet;
  }

  /**
   * 刪除工作表
   * @param {string} sheetName
   */
  deleteSheet(sheetName) {
    const sheet = this.spreadsheet.getSheetByName(sheetName);
    if (sheet) {
      this.spreadsheet.deleteSheet(sheet);
      delete this._sheetCache[sheetName];
    }
  }

  /**
   * 重新命名工作表
   * @param {string} oldName
   * @param {string} newName
   */
  renameSheet(oldName, newName) {
    const sheet = this.getSheet(oldName);
    sheet.setName(newName);
    delete this._sheetCache[oldName];
    this._sheetCache[newName] = sheet;
  }


  /* ========== 📖 讀取資料 ========== */

  /**
   * 取得整張工作表的所有資料
   * @param {string} sheetName
   * @returns {any[][]}
   */
  getAllData(sheetName) {
    return this.getSheet(sheetName).getDataRange().getValues();
  }

  /**
   * 取得指定範圍的資料
   * @param {string} sheetName
   * @param {string} a1Notation
   * @returns {any[][]}
   */
  getValues(sheetName, a1Notation) {
    return this.getSheet(sheetName).getRange(a1Notation).getValues();
  }

  /**
   * 取得某一列的資料
   * @param {string} sheetName
   * @param {number} rowNumber
   * @returns {any[]}
   */
  getRow(sheetName, rowNumber) {
    const sheet = this.getSheet(sheetName);
    return sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
  }

  /**
   * 取得某一欄的資料
   * @param {string} sheetName
   * @param {number} colNumber
   * @returns {any[]}
   */
  getColumn(sheetName, colNumber) {
    const sheet = this.getSheet(sheetName);
    return sheet
      .getRange(1, colNumber, sheet.getLastRow(), 1)
      .getValues()
      .map((row) => row[0]);
  }

  /**
   * 取得單一儲存格的值
   * @param {string} sheetName
   * @param {string} a1Notation
   * @returns {any}
   */
  getCell(sheetName, a1Notation) {
    return this.getSheet(sheetName).getRange(a1Notation).getValue();
  }


  /* ========== ✍️ 寫入資料 ========== */

  /**
   * 寫入二維陣列到指定範圍
   * @param {string} sheetName
   * @param {string} a1Notation
   * @param {any[][]} values
   */
  setValues(sheetName, a1Notation, values) {
    const sheet = this.getSheet(sheetName);
    const numRows = values.length;
    const numCols = values[0].length;
    const startRange = sheet.getRange(a1Notation);
    sheet
      .getRange(startRange.getRow(), startRange.getColumn(), numRows, numCols)
      .setValues(values);
  }

  /**
   * 設定單一儲存格的值
   * @param {string} sheetName
   * @param {string} a1Notation
   * @param {any} value
   */
  setCell(sheetName, a1Notation, value) {
    this.getSheet(sheetName).getRange(a1Notation).setValue(value);
  }

  /**
   * 在最後新增一列
   * @param {string} sheetName
   * @param {any[]} rowData
   */
  appendRow(sheetName, rowData) {
    this.getSheet(sheetName).appendRow(rowData);
  }

  /**
   * 在最後批次新增多列
   * @param {string} sheetName
   * @param {any[][]} rows
   */
  appendRows(sheetName, rows) {
    if (rows.length === 0) return;
    const sheet = this.getSheet(sheetName);
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
  }


  /* ========== 🧹 清除資料 ========== */

  /**
   * 清空整張工作表的內容
   * @param {string} sheetName
   */
  clearSheet(sheetName) {
    this.getSheet(sheetName).clearContents();
  }

  /**
   * 清除指定範圍的內容
   * @param {string} sheetName
   * @param {string} a1Notation
   */
  clearRange(sheetName, a1Notation) {
    this.getSheet(sheetName).getRange(a1Notation).clearContent();
  }
}


/* ========== 🏭 工廠函式(對外暴露給 Library 引用方) ========== */

/**
 * 建立 SheetClient 實例,並綁定指定的試算表
 *
 * @example
 *   const sheet = Workspace.createSheetClient(spreadsheetId);
 *   sheet.appendRow('Sheet1', [1, 2, 3]);
 *
 * @param {string} spreadsheetId - 試算表 ID
 * @returns {SheetClient}
 */
function createSheetClient(spreadsheetId) {
  return new SheetClient(spreadsheetId);
}