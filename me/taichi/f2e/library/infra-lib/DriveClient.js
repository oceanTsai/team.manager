/**
 * ============================================================
 * DriveClient.gs - Google Drive API 客戶端
 * ============================================================
 * 📦 屬於 WorkspaceLib 函式庫
 *
 * 設計模式:Factory Function Pattern
 *   - Class 定義在內部
 *   - 對外暴露 createDriveClient() 工廠函式
 *   - 此模式與 Google 官方 apps-script-oauth2 一致
 *
 * 為何用 Factory?
 *   Apps Script Library 跨專案呼叫時,ES6 class 不會被暴露為全域。
 *   透過工廠函式回傳實例,引用端可正常使用所有方法。
 *
 * 對外能力:
 *   📁 資料夾:createFolder / getFolder / findFolderByName / listFolders /
 *              folderExists / renameFolder / moveFolder / deleteFolder
 *   📄 檔案:  getFile / copyFile / findFileByName / listFiles /
 *              findFilesByMimeType / renameFile / moveFile / deleteFile
 *   🏷️ 常數:  DriveMime(全域常數)
 * ============================================================
 */


/* ========== 🏗️ 內部 Class 定義(不直接對外) ========== */

class DriveClient {

  constructor() {
    /** @private @type {Object<string, GoogleAppsScript.Drive.Folder>} */
    this._folderCache = {};

    /** @private @type {Object<string, GoogleAppsScript.Drive.File>} */
    this._fileCache = {};
  }


  /* ========== 📁 資料夾操作 ========== */

  /**
   * 依 ID 取得資料夾(有快取)
   * @param {string} folderId
   * @returns {GoogleAppsScript.Drive.Folder}
   */
  getFolder(folderId) {
    if (!this._folderCache[folderId]) {
      this._folderCache[folderId] = DriveApp.getFolderById(folderId);
    }
    return this._folderCache[folderId];
  }

  /**
   * 在指定父資料夾下建立子資料夾
   * @param {string} parentFolderId
   * @param {string} name
   * @param {boolean} [allowDuplicate=false]
   * @returns {GoogleAppsScript.Drive.Folder}
   */
  createFolder(parentFolderId, name, allowDuplicate = false) {
    const parent = this.getFolder(parentFolderId);
    if (!allowDuplicate && parent.getFoldersByName(name).hasNext()) {
      throw new Error(`資料夾「${name}」已存在於父資料夾`);
    }
    return parent.createFolder(name);
  }

  /**
   * 在父資料夾中尋找同名資料夾
   * @param {string} parentFolderId
   * @param {string} name
   * @returns {GoogleAppsScript.Drive.Folder|null}
   */
  findFolderByName(parentFolderId, name) {
    const parent = this.getFolder(parentFolderId);
    const folders = parent.getFoldersByName(name);
    return folders.hasNext() ? folders.next() : null;
  }

  /**
   * 檢查父資料夾中是否存在同名資料夾
   * @param {string} parentFolderId
   * @param {string} name
   * @returns {boolean}
   */
  folderExists(parentFolderId, name) {
    return this.getFolder(parentFolderId).getFoldersByName(name).hasNext();
  }

  /**
   * 列出父資料夾下所有子資料夾
   * @param {string} parentFolderId
   * @returns {GoogleAppsScript.Drive.Folder[]}
   */
  listFolders(parentFolderId) {
    const iter = this.getFolder(parentFolderId).getFolders();
    const result = [];
    while (iter.hasNext()) result.push(iter.next());
    return result;
  }

  /**
   * 重新命名資料夾
   * @param {string} folderId
   * @param {string} newName
   * @returns {GoogleAppsScript.Drive.Folder}
   */
  renameFolder(folderId, newName) {
    const folder = this.getFolder(folderId);
    folder.setName(newName);
    return folder;
  }

  /**
   * 將資料夾搬移到新的父資料夾
   * @param {string} folderId
   * @param {string} newParentFolderId
   * @returns {GoogleAppsScript.Drive.Folder}
   */
  moveFolder(folderId, newParentFolderId) {
    const folder = this.getFolder(folderId);
    const newParent = this.getFolder(newParentFolderId);
    folder.moveTo(newParent);
    return folder;
  }

  /**
   * 刪除資料夾(移到垃圾桶)
   * @param {string} folderId
   */
  deleteFolder(folderId) {
    this.getFolder(folderId).setTrashed(true);
    delete this._folderCache[folderId];
  }


  /* ========== 📄 檔案操作 ========== */

  /**
   * 依 ID 取得檔案(有快取)
   * @param {string} fileId
   * @returns {GoogleAppsScript.Drive.File}
   */
  getFile(fileId) {
    if (!this._fileCache[fileId]) {
      this._fileCache[fileId] = DriveApp.getFileById(fileId);
    }
    return this._fileCache[fileId];
  }

  /**
   * 複製檔案到指定資料夾
   * @param {string} fileId
   * @param {string} newName
   * @param {string} targetFolderId
   * @returns {GoogleAppsScript.Drive.File}
   */
  copyFile(fileId, newName, targetFolderId) {
    const source = this.getFile(fileId);
    const target = this.getFolder(targetFolderId);
    return source.makeCopy(newName, target);
  }

  /**
   * 在資料夾中尋找同名檔案
   * @param {string} folderId
   * @param {string} name
   * @returns {GoogleAppsScript.Drive.File|null}
   */
  findFileByName(folderId, name) {
    const files = this.getFolder(folderId).getFilesByName(name);
    return files.hasNext() ? files.next() : null;
  }

  /**
   * 列出資料夾下所有檔案
   * @param {string} folderId
   * @returns {GoogleAppsScript.Drive.File[]}
   */
  listFiles(folderId) {
    const iter = this.getFolder(folderId).getFiles();
    const result = [];
    while (iter.hasNext()) result.push(iter.next());
    return result;
  }

  /**
   * 依 MIME 類型過濾資料夾內的檔案
   * @param {string} folderId
   * @param {string|string[]} mimeTypes
   * @returns {GoogleAppsScript.Drive.File[]}
   */
  findFilesByMimeType(folderId, mimeTypes) {
    const list = Array.isArray(mimeTypes) ? mimeTypes : [mimeTypes];
    return this.listFiles(folderId).filter((file) =>
      list.includes(file.getMimeType())
    );
  }

  /**
   * 重新命名檔案
   * @param {string} fileId
   * @param {string} newName
   * @returns {GoogleAppsScript.Drive.File}
   */
  renameFile(fileId, newName) {
    const file = this.getFile(fileId);
    file.setName(newName);
    return file;
  }

  /**
   * 將檔案搬移到新資料夾
   * @param {string} fileId
   * @param {string} newFolderId
   * @returns {GoogleAppsScript.Drive.File}
   */
  moveFile(fileId, newFolderId) {
    const file = this.getFile(fileId);
    const target = this.getFolder(newFolderId);
    file.moveTo(target);
    return file;
  }

  /**
   * 刪除檔案(移到垃圾桶)
   * @param {string} fileId
   */
  deleteFile(fileId) {
    this.getFile(fileId).setTrashed(true);
    delete this._fileCache[fileId];
  }

  /**
   * 取得檔案 MIME 類型
   * @param {string} fileId
   * @returns {string}
   */
  getMimeType(fileId) {
    return this.getFile(fileId).getMimeType();
  }
}


/* ========== 🏭 工廠函式(對外暴露給 Library 引用方) ========== */

/**
 * 建立 DriveClient 實例
 *
 * @example
 *   const drive = Workspace.createDriveClient();
 *   drive.copyFile(fileId, newName, targetFolderId);
 *
 * @returns {DriveClient}
 */
function createDriveClient() {
  return new DriveClient();
}


/* ========== 🏷️ MIME 類型常數(全域,Library 可見) ========== */

/**
 * 常用 MIME 類型常數
 *
 * @example
 *   Workspace.DriveMime.FORM
 *   Workspace.DriveMime.PRESENTATION
 */
var DriveMime = {
  FOLDER:       'application/vnd.google-apps.folder',
  FORM:         'application/vnd.google-apps.form',
  SPREADSHEET:  'application/vnd.google-apps.spreadsheet',
  DOCUMENT:     'application/vnd.google-apps.document',
  PRESENTATION: 'application/vnd.google-apps.presentation',
  PPTX:         'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  XLSX:         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  DOCX:         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  PDF:          'application/pdf',
};