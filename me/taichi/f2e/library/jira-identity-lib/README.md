# JiraIdentityLib

> 掛載識別碼：**`JiraIdentityLib`**

集中管理 Jira 相關的環境變數（URL、admin 認證、各成員 email/token），讓呼叫端能選一個具名使用者的身份去操作 Jira（`getOcean()`/`getBrian()`/`getUser(userKey)`）。`jira/worklog-migrate` 用它保留 worklog 原作者身份。

通知管道相關的設定另外在 [[notify-env-lib]]。

## 環境變數命名規則

放在**使用這個 library 的主專案**的指令碼屬性：

| 屬性 | 說明 |
|---|---|
| `JIRA_URL` | Jira 網域(全域共用) |
| `JIRA_EMAIL` / `JIRA_TOKEN` | Admin(部長)的認證 |
| `JIRA_EMAIL_OCEAN` / `JIRA_TOKEN_OCEAN` | AdminLead(課長)的認證 |
| `JIRA_EMAIL_{KEY}` / `JIRA_TOKEN_{KEY}` | 個別使用者的認證(`KEY` 見 `User` enum:`AGNES`/`BRIAN`/`ENYA`/`JUNE`/`PEDRO`/`SAMURA`/`STEVEN`/`WILLIAM`) |

## 使用範例

```js
const jira = JiraIdentityLib.jiraIdentityLib();

// 部長 admin
const admin = jira.getAdmin();
admin.email / admin.token / admin.authHeaders

// 課長 admin
const lead = jira.getAdminLead();

// 一般查詢
const token = jira.getToken('BRIAN');
const user  = jira.getUser('BRIAN'); // { email, token, authHeaders }

// 個人 getter
const brian = jira.getBrian();

// 診斷
jira.printStatus();
```

## 部署狀態

規劃中，尚未建立對應的 Apps Script 專案（需要新 scriptId）。
