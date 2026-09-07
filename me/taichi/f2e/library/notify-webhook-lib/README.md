# NotifyWebhookLib

> 掛載識別碼：**`NotifyWebhookLib`**

集中管理「通知管道」相關的機密設定（目前只有 Google Chat webhook URL）。

Jira 身份認證相關的設定另外在 [[jira-identity-lib]]。

## 環境變數命名規則

放在**這個 library 自己**的指令碼屬性——GAS 的指令碼屬性是不共用資源，library 跟使用它的主專案各自有各自獨立的一份，不會互通：

| 屬性 | 說明 |
|---|---|
| `JIRA_MESSAGE_WEBHOOK_URL` | Google Chat webhook URL(Jira 相關通知,選填) |

## 使用範例

```js
const notify = NotifyWebhookLib.notifyWebhookLib();
const url = notify.getJiraMessageWebhookUrl();
notify.printStatus();
```

## 部署狀態

規劃中，尚未建立對應的 Apps Script 專案（需要新 scriptId）。
