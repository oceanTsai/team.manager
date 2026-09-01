# infraLib — Google Workspace API Library

> 掛載識別碼：**`Infra`**
> Script ID：`17AFWXtq5xxqn8SDmL4ovnaGXCBvpInEPDzIf8Te_gFXik0qKOViI13Oi`

把 Drive / Form / Sheet 的底層操作封裝成三個 Client，讓其他專案不用重複寫 `DriveApp.getFolderById(...)` 這類樣板碼。**純技術封裝，不含任何業務邏輯，失敗一律拋例外。**

## 檔案

| 檔案 | 功能 |
|---|---|
| `DriveClient.js` | Drive 資料夾 / 檔案 CRUD，另外提供 `DriveMime` MIME 常數 |
| `FormClient.js` | Google 表單的標題、發布狀態、試算表連結、回應管理 |
| `SheetClient.js` | 試算表的工作表管理與資料讀寫 |
| `README.js` | 程式碼內的說明文件（在 GAS 編輯器裡看得到） |

## DriveClient

```js
const drive = Infra.createDriveClient();
```

| 分類 | 方法 |
|---|---|
| 📁 資料夾 | `getFolder(id)`、`createFolder(parentId, name, allowDuplicate=false)`、`findFolderByName(parentId, name)`、`folderExists(parentId, name)`、`listFolders(parentId)`、`renameFolder(id, newName)`、`moveFolder(id, newParentId)`、`deleteFolder(id)` |
| 📄 檔案 | `getFile(id)`、`copyFile(fileId, newName, targetFolderId)`、`findFileByName(folderId, name)`、`listFiles(folderId)`、`findFilesByMimeType(folderId, mimeTypes)`、`renameFile(id, newName)`、`moveFile(id, newFolderId)`、`deleteFile(id)`、`getMimeType(id)` |

- `createFolder` 預設**不允許同名**，父資料夾已有同名會拋錯；要允許就傳 `allowDuplicate = true`。
- `deleteFolder` / `deleteFile` 是移到垃圾桶（`setTrashed(true)`），不是永久刪除。
- `findFilesByMimeType` 接受單一字串或陣列。

### DriveMime 常數

```js
Infra.DriveMime.FOLDER / FORM / SPREADSHEET / DOCUMENT
Infra.DriveMime.PRESENTATION / PPTX / XLSX / DOCX / PDF
```

## FormClient

```js
const form = Infra.createFormClient();
```

| 分類 | 方法 |
|---|---|
| 📝 取得 | `open(formId)`、`getTitle`、`getDescription`、`getEditUrl`、`getPublishedUrl` |
| ✏️ 編輯 | `setTitle(formId, title)`、`setDescription(formId, desc)` |
| 🌐 發布 | `publish(formId)`、`unpublish(formId)`、`isPublished(formId)` |
| ⚙️ 接收 | `setAcceptingResponses(formId, bool)`、`isAcceptingResponses(formId)` |
| 🔗 試算表 | `linkToSheet(formId, spreadsheetId)`、`unlinkSheet(formId)`、`getLinkedSheetId(formId)` |
| 📊 回應 | `getResponses(formId)`、`getResponseCount(formId)`、`deleteAllResponses(formId)` |

「發布」（`publish`）對應表單 UI 上的發布按鈕；「接受回應」（`setAcceptingResponses`）是另一個開關，兩者互相獨立。

## SheetClient

```js
const sheet = Infra.createSheetClient(spreadsheetId);   // ⚠️ 這個工廠要傳 ID
```

| 分類 | 方法 |
|---|---|
| 📊 工作表 | `getSheet(name)`、`getSheetNames()`、`sheetExists(name)`、`createSheet(name)`、`deleteSheet(name)`、`renameSheet(old, new)` |
| 📖 讀取 | `getAllData(name)`、`getValues(name, a1)`、`getRow(name, rowNum)`、`getColumn(name, colNum)`、`getCell(name, a1)` |
| ✍️ 寫入 | `setValues(name, a1, values2D)`、`setCell(name, a1, value)`、`appendRow(name, rowArray)`、`appendRows(name, rows2D)` |
| 🧹 清除 | `clearSheet(name)`、`clearRange(name, a1)` |

`appendRows` 是批次寫入（一次 `setValues`），大量資料時比迴圈呼叫 `appendRow` 快很多。

## 設計說明

- **Factory Function Pattern**：Apps Script Library 不會把 ES6 class 暴露到引用端，所以 class 定義在內部，對外只給 `createXxxClient()`。這跟 Google 官方 `apps-script-oauth2` 的做法一致。
- **Instance + 快取**：每個 Client 內部有 `_folderCache` / `_fileCache` / `_formCache` / `_sheetCache`，同一個 ID 只會呼叫一次 API，適合批次操作。快取只存在於單一 instance 的生命週期內。
- **SheetClient 綁定單一試算表**：`spreadsheetId` 在建構時就 `openById` 一次，之後所有方法只需要傳工作表名稱。

## ⚠️ 使用注意

1. 改完 Library 要**重新部署版本**，引用方才看得到變更。
2. 引用方建議綁定特定版本而不是 HEAD，避免改動直接影響正式環境。
3. Library 跨專案呼叫比本地呼叫慢 2–3 倍，大量迴圈的場景考慮把程式碼複製到本地專案。
