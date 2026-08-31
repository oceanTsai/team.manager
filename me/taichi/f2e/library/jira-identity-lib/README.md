# JiraIdentityLib

規劃中，尚未遷移。對應封存的 `envLib/JiraEnv.js`（Jira 網域、admin 認證、各成員 email/token 管理）。

名稱從 `JiraEnv` 改為 `JiraIdentityLib`：核心價值不是認證機制本身（Basic Auth 只是 base64 編碼），而是管理一群具名使用者、讓呼叫端能選一個人的身份去操作 Jira（`getOcean()`/`getBrian()`/`getUser(userKey)`），對應 `jiraLogMigrate` 用它保留原作者身份的需求。
