# quarterly-tickets

> 依賴 Library：**`JiraIdentityLib`**（Jira 認證）、**`NotifyEnvLib`**（webhook 設定）、**`Notify`**（發送）

每季在指定 Epic 底下建立固定的會議記工時單，建立完透過通知器發送結果通知。

## 檔案

| 檔案 | 功能 |
|---|---|
| `建立每季工時單核心.js` | `QuarterlyTicketCreator` class — 建單核心邏輯 |
| `建立每季記工時單的主程序.js` | 執行入口:可執行函式清單、相依物件組裝 |
| `每季工時訊息通知樣板.js` | `TicketCreationTemplate` — 通知訊息格式 |

## 部署狀態

規劃中，尚未建立對應的 Apps Script 專案（需要新 scriptId）。`appsscript.json` 裡 `JiraIdentityLib`、`NotifyEnvLib` 兩個 library 的 `libraryId` 先放了 `TODO_...` 佔位字串，等 [[jira-identity-lib]] 和 [[notify-env-lib]] 都部署出真正的 scriptId 之後要回來補上，否則這個專案掛載不到依賴。
