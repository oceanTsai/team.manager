# NotifyEnvLib

規劃中，尚未遷移。對應封存的 `envLib/NotifyEnv.js`（通知管道相關的機密設定，例如 webhook URL）。

原本 `envLib` 同時管理 Jira 與通知設定，這次重構把兩者拆開：Jira 部分獨立成 `JiraAuthLib`，通知部分改名為 `NotifyEnvLib`。
