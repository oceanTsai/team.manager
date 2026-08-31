# quarterly-tickets

規劃中，尚未遷移。對應封存的 `report/` 裡「季度會議工時單建立」的部分。

目前跟 Sprint 回顧共用同一個 scriptId，已決定拆成獨立的 Apps Script 專案（原因：兩者共用 scriptId 的話，`clasp push` 會用本地資料夾內容整批同步遠端，只 push 其中一邊會把另一邊的檔案砍掉，無法真正獨立維護）。

遷移時要另外在 Apps Script 開一個新專案拿新 scriptId，並把相關的觸發器、指令碼屬性也搬過去。
