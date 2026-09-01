# worklog-migrate

> 依賴 Library：**`JiraIdentityLib`**（Jira 認證，唯一依賴）

把某張 Jira 工單的 worklog 依條件搬到另一張工單，搬移時用原作者本人的身份在目標單建立新紀錄，藉此保留原作者身份，再從來源單刪除。

## 檔案

| 檔案 | 功能 |
|---|---|
| `MigrateWorklogs.js` | `WorklogMigrator` class — 搬移核心邏輯 |
| `migrateSorklogEntry.js` | 執行用主程式：任務清單、使用者對應表、可執行函式 |

## 部署狀態

規劃中，尚未建立對應的 Apps Script 專案（需要新 scriptId）。`appsscript.json` 裡 `JiraIdentityLib` 的 `libraryId` 先放了 `TODO_...` 佔位字串，等 [[jira-identity-lib]] 部署出真正的 scriptId 之後要回來補上。
