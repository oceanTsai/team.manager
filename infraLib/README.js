/**
 * ============================================================
 * WorkspaceLib - Google Workspace API 客戶端函式庫
 * ============================================================
 *
 * 📦 專案名稱:InfraLib
 * 🆔 建議識別碼:Infra
 *
 * 📍 用途
 *   封裝 Google Workspace 各服務的 API,供其他 Apps Script
 *   專案共用,避免重複實作底層程式碼。
 *
 * ────────────────────────────────────────────────────────────
 * 📚 模組列表
 * ────────────────────────────────────────────────────────────
 *   ► DriveClient   - Google Drive 檔案/資料夾操作
 *   ► FormClient    - Google Form 操作
 *   ► SheetClient   - Google Spreadsheet 操作
 *
 * ────────────────────────────────────────────────────────────
 * 🚀 引用方式
 * ────────────────────────────────────────────────────────────
 *
 * 1️⃣ 在其他 Apps Script 專案的「程式庫」加入:
 *    - Script ID:(從本專案「專案設定」取得)
 *    - 版本:選擇穩定版本
 *    - 識別碼:Infra
 *
 * 2️⃣ 在引用方專案中呼叫:
 *
 *    // Drive 操作
 *    const drive = Infra.createDriveClient();
 *    drive.copyFile(fileId, newName, targetFolderId);
 *    drive.createFolder(parentId, '新資料夾');
 *
 *    // Form 操作
 *    const form = Infra.createFormClient();
 *    form.setTitle(formId, '新標題');
 *
 *    // Sheet 操作(需指定試算表 ID)
 *    const sheet = Infra.createSheetClient(spreadsheetId);
 *    sheet.appendRow('Sheet1', [1, 2, 3]);
 *
 *    // MIME 常數
 *    Infra.DriveMime.FORM
 *    Infra.DriveMime.PRESENTATION
 *
 * ────────────────────────────────────────────────────────────
 * 💡 設計原則
 * ────────────────────────────────────────────────────────────
 *   ► Factory Function Pattern
 *     - 對外暴露 createXxxClient() 工廠函式
 *     - 內部 Class 不直接 export(Apps Script Library 限制)
 *     - 此模式與 Google 官方 apps-script-oauth2 一致
 *
 *   ► Instance + Cache
 *     - 每個 Client 是 instance,內建快取避免重複呼叫 API
 *     - 適合批次操作場景
 *
 *   ► 純技術封裝
 *     - 不含業務邏輯
 *     - 失敗即拋例外
 *
 * ────────────────────────────────────────────────────────────
 * 📋 版本記錄
 * ────────────────────────────────────────────────────────────
 *   v1.0 (2026/05) - 初始版本
 *     ► DriveClient:資料夾與檔案 CRUD、MIME 常數
 *     ► FormClient:標題、說明、回應、試算表連結
 *     ► SheetClient:工作表 CRUD、讀寫、清除
 *
 * ────────────────────────────────────────────────────────────
 * ⚠️ 使用注意事項
 * ────────────────────────────────────────────────────────────
 *   1. 修改 Library 後須重新部署版本,引用方才會看到變更
 *   2. 引用方建議綁定特定版本而非 HEAD,避免改動影響正式環境
 *   3. Library 跨專案呼叫比直接呼叫慢 2-3 倍,大量迴圈場景請考慮
 *      把程式碼複製到本地專案
 *   4. ES6 class 不會被 Library export,因此使用 Factory Function
 *      工廠函式回傳 instance
 *
 * ============================================================
 */