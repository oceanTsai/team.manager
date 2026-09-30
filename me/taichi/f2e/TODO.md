# 待處理清單

> 這份文件是**自足的**——新開一個對話直接讀這裡就能接手，不需要先前的對話記錄。
> 最後更新：2026-09-30
>
> **範圍**：只列 `me/` 底下的任務。repo 根目錄的舊資料夾（`bugAssignment/`、`envLib/`、`infraLib/`、`jiraLogMigrate/`、`notifyLib/`、`report/`）屬於另一個 Google 空間、線上還在跑，不在這次重構範圍內，不列入。

## 現況

- B、A、C、N、H 項目已修好並已提交，`scrum/retrospective` 的測試也已補齊並跟上新介面
- `library/notify-webhook-lib`（原 `notify-env-lib`，已改名避免跟 `notify-lib` 搞混）：命名問題（`testNotifyEnvLib()`、`envKeys` 缺 `_`）已修好；`_getRequired()` 死碼已刪除，I（跟 jira-identity-lib 重複實作）因此一併解決；沒有實際效益的單例快取也已拿掉（class 封裝本身保留，只拿掉快取邏輯）。這個資料夾這輪全部處理完
- 四個 library（`infra-lib`／`jira-identity-lib`／`notify-lib`／`notify-webhook-lib`）已於 2026-09-10 全部複查完畢並處理完：共 14 項發現，修好 8 項（含 `jira-identity-lib` 的獨體快取、命名一致性、`SheetClient` 欄位與防呆等）、評估後決定不改 3 項（都是查證過情境後判斷風險低或本來就該是這樣）、擱置不當死碼處理 3 項（`SheetClient`/`DriveClient`/`FormClient` 的零呼叫方法、9 個具名 sugar method——都是預先開發的 library API，不是錯誤）。細節不再列出，已是定案
- `scrum/retrospective` 已完成重構：拆成單一職責的類別、依賴由建構子注入
- `node me/taichi/f2e/test/run.js` 全部通過，共 99 個檢查（4 組，含新加的 `test/retrospective/prepareRetro.test.js`，覆蓋 B 的過期檢查與 A 的查詢次數）
- **尚未部署**——`me/` 底下沒有任何 `.clasp.json`
- G 項目（通知失敗處理）已盤查並修好唯一的真正 bug（`FailureNotifier` 安全網本身失敗時謊報成功），其餘延伸想法列成 4 個 ISSUE 延後處理（見下方一、G 段落）
- 5 個未審查專案（`bug-triage`／`jira/worklog-migrate`／`jira/quarterly-tickets`／`library/infra-lib`／`library/notify-lib`，共約 3700 行）已於 2026-09-30 全部複查完畢，共 24 項確認缺陷列成 ISSUE2（見下方三），延後到 `scrum/retrospective` 部署到 GAS 能運作後再處理；其中 `jira/worklog-migrate` 有 2 項是實際的資料正確性/可用性風險，`bug-triage` 整專案沒有 class 是規模較大的結構性問題，其餘多是「guard clause 違反單一出口」的風格類問題
- M 項目（建構子欄位存放方式）已定案並處理完：`SprintFolderBuilder`、`QuarterlyTicketCreator`、`WorklogMigrator` 這 3 個建構子參數超過 3 個的類別，統一改成 `constructor(option) { this._option = {...} }`（逐欄位明寫，不用展開語法）；順便發現並修掉 `QuarterlyTicketCreator` 的 `jiraEnv` 是死欄位（只用到 `getJiraUrl()`），改成呼叫端直接傳 `domain` 字串進來，不用整個 `jiraEnv` 服務物件。`WorklogMigrator` 的 `jiraEnv` 因為有動態呼叫 `getUser()`，維持整包注入。詳細討論記錄見下方「已定案的設計決策」第 10 條

---

## 一、`library`（跨專案）

### G. 通知發送失敗被吞掉

盤查過整條通知失敗路徑後，判斷原則是：**錯誤如果是「webhook 呼叫本身失敗」，就只能記 log（沒有別的管道可以通知這件事）；如果是其他原因（業務邏輯、外部 API 等），才需要視情境決定，但本質上都可以是「log + Chat 通知說明發生什麼錯誤」。**

照這個原則盤查 4 條路徑，只有 1 條是真正的 bug，已修好：

- ✅ **`FailureNotifier.notify()`（`scrum/retrospective/FailureNotifier.js`）——已修**。原本不管 `sendCard()` 回傳什麼都寫死 `sent = true`，log 也騙人說已發送；改成老實接住回傳值，依實際結果分開記 log。這個類別是整個回顧流程的安全網（所有 catch 區塊失敗都靠它通知），原本的 bug 會導致「安全網本身失效時，沒有任何痕跡能看出安全網也壞了」。已補測試(`test/retrospective/notify.test.js`，模擬 `sendCard` 回傳 `false` 但不拋錯的情況，這正是原本沒被測到的分支)
- ✅ `ReminderNotifier`（送失敗）——已經只記 log，行為正確，符合原則
- ✅ `ReminderNotifier`（webhook 沒設定）——會 `throw`，被外層 catch 轉給 `FailureNotifier`，`FailureNotifier` 讀到同一個屬性仍未設定時只記 log、不重試，不會循環
- ✅ `QuarterlyTicketCreator._notify()`——webhook 失敗記 log、業務邏輯失敗也是「log + Chat 通知」，符合原則

**其餘延伸想法列為 ISSUE，先不處理，等 J/K（部署設定）完成、程式能實際運作後再回頭補：**

| ISSUE | 位置 | 內容 |
|---|---|---|
| 1 | `scrum/retrospective/ReminderNotifier.js` | `notifyCreated`/`notifyPublished`/`notifyReminder` 沒有 `return` 送出結果，呼叫端拿不到「有沒有發送成功」 |
| 2 | 跨專案 | 失敗記錄目前只靠 `Logger.log`，執行完就查不到，考慮記到 Google Sheet 才能持久保存、事後查詢 |
| 3 | 跨專案 | 失敗時目前只有 Chat 一個管道，webhook 本身失效時沒有備援（email 或 Slack），要另外設計 |
| 4 | `jira/quarterly-tickets` | 沒有像 `FailureNotifier` 這樣的安全網，webhook 失效時比 retrospective 少一層保護 |

---

## 二、部署設定

### J. `me/` 底下沒有任何 `.clasp.json` 🔴

**所有修正目前都無法部署。** 需要在新的 Google 帳號建立 Apps Script 專案，取得 scriptId 後才能設定。

要建立的專案（各自獨立 scriptId）：

| 資料夾 | 說明 |
|---|---|
| `library/infra-lib` | 可沿用原 scriptId `17AFWXtq5xxqn8SDmL4ovnaGXCBvpInEPDzIf8Te_gFXik0qKOViI13Oi`（內容沒改名） |
| `library/notify-lib` | 可沿用原 scriptId `1P0w2KWO77JiugnqrcjyRJn6wxDSWmHuazzFUL2446vb2VISYWrluYpib` |
| `library/jira-identity-lib` | **需要新的**（從 envLib 拆出來的） |
| `library/notify-webhook-lib` | **需要新的**（從 envLib 拆出來的） |
| `scrum/retrospective` | **需要新的**（原 report 拆成兩個） |
| `jira/quarterly-tickets` | **需要新的**（原 report 拆成兩個） |
| `jira/worklog-migrate` | 可沿用原 scriptId `1ZhNq7TIwB-s2h7rpP_q9hl5v0BvGRDTtNw2N--2k0oFU34CZ-cAppgPF` |
| `bug-triage` | 可沿用原 scriptId `1XlDq-zsUxxCzR4vyJo2NIkfXtC_IZbn6HQlfQxPNXB-NGXx4Th0LwuD9` |

> ⚠️ `test/` 資料夾**不要**放進任何 clasp 專案根目錄——`clasp push` 會把整個資料夾同步上去，測試檔用了 `require`／`module.exports`，GAS 不支援。

---

### K. `appsscript.json` 有 3 處 `TODO_` 佔位 🔴

等 J 取得 scriptId 後要補上，否則專案掛載不到依賴：

| 檔案 | 行 | 待補 |
|---|---|---|
| `jira/worklog-migrate/appsscript.json` | 8 | `jira-identity-lib` 的 scriptId |
| `jira/quarterly-tickets/appsscript.json` | 9 | `jira-identity-lib` 的 scriptId |
| `jira/quarterly-tickets/appsscript.json` | 14 | `notify-webhook-lib` 的 scriptId |

---

## 三、未審查專案複查發現（ISSUE2 —— 延後處理）

5 個資料夾（約 3700 行）已於 2026-09-30 全部複查完畢，純讀取分析，未修改任何檔案。**這些發現先不處理，等 `scrum/retrospective` 部署到 GAS 且能實際運作後再回頭補**，以下只列「確認是缺陷」的項目，評估後判斷沒問題或屬於預留 API 的項目不列出（已個別確認過，不是遺漏）。

### `jira/worklog-migrate`（680 行）—— 2 個風險最高，優先看

| 編號 | 位置 | 內容 |
|---|---|---|
| 1 | `MigrateWorklogs.js:265-286`（`migrate()`） | **資料正確性風險**：worklog 新增到目標單成功後，若接著從來源刪除失敗，這筆會同時留在來源與目標兩邊，且沒有任何記錄可追蹤是哪一筆。模組靠「刪除來源」防止重複的假設在此被打破，重跑只會持續疊加重複工時 |
| 2 | `migrateSorklogEntry.js:105-133`（`runTasks()`） | **可用性風險**：沒有包 try/catch，一筆格式正確但實際不存在/無權限的工單會讓整批任務（`QUARTER_TASKS`/`ANNUAL_TASKS`）全部卡死在那一筆，後面任務都不會執行，連進度總結 log 都不會印 |
| 3 | `MigrateWorklogs.js:356-369`（`_findUserKey()`） | 單一出口違規：guard clause + 迴圈內 3 處 `return` |
| 4 | `MigrateWorklogs.js:440-453`（`_extractCommentText()`） | 單一出口違規：3 個 `return` 分散各處 |
| 5 | `MigrateWorklogs.js:459-466`（`_logSkippedDetails()`） | 單一出口違規：guard clause |
| 6 | `migrateSorklogEntry.js:154-165`（`_validateTask()`） | 單一出口違規：guard-clause 鏈 |
| 7 | `migrateSorklogEntry.js:177-186`（`_isValidIssueKey()`） | 單一出口違規：guard-clause 鏈 |
| 8 | `migrateSorklogEntry.js:192-205`（`_formatTaskLabel()`） | 單一出口違規：`if...return` 三路分派，非 `switch` |
| 9 | `MigrateWorklogs.js:339`（`_elapsedSeconds()`） | 命名不符「方法動詞開頭」，應類似 `calcElapsedSeconds()` |
| 10 | `migrateSorklogEntry.js`（檔名） | 檔名錯字：`Sorklog` 應為 `Worklog` |

### `bug-triage`（1125 行）—— 規模不同，是否重寫要先討論

| 編號 | 位置 | 內容 |
|---|---|---|
| 1 | 全檔（`BugTriageAssignment.js`/`ScheduleTask.js`/`Test.js`） | **整個專案沒有任何 class**，全部是操作 Drive/PropertiesService/外部 API 的頂層全域函式，違反「每個檔案一個 class」。修正規模等同整專案重寫（類似當初 `scrum/retrospective` 的拆解工程量），不是局部修補 |
| 2 | `BugTriageAssignment.js:259-361`（`doPost()`） | 單一函式做 token 驗證、tag 比對、Jira 解析、找試算表、AI 分析、挑派工、寫入、組回應共 8 步，與項目 1 同根因 |
| 3 | `BugTriageAssignment.js:358-360` | `catch` 只回傳錯誤訊息給呼叫端，沒有任何 `Logger.log()`，GAS 執行紀錄裡沒有主動留下的痕跡 |
| 4 | `BugTriageAssignment.js:452-453` | JSDoc 註解「D 欄：領域」與程式碼實際讀取的 `row[4]`（E 欄）前後矛盾，文件錯字會誤導維護欄位的人 |
| 5 | `BugTriageAssignment.js`（`WEIGHTS` 等）、`config.js`（`CONFIG_*`） | 全部是扁平頂層 `const`，沒有命名空間包裝，與項目 1 同根因 |
| 6 | `BugTriageAssignment.js:602-604` | 圖片下載失敗 `catch (_) {}` 靜默吞掉，沒有 log（影響輕微，建議補但不強制） |

### `jira/quarterly-tickets`（549 行）

| 編號 | 位置 | 內容 |
|---|---|---|
| 1 | `每季工時訊息通知樣板.js:71-75`（`_headerEmoji()`） | 單一出口違規：guard-clause 連續 `if...return` |
| 2 | `每季工時訊息通知樣板.js:110-124`（`_buildResultField()`） | 對固定的 4 種 `status` 用 `if...return` 分派，建議改成物件字面量查表 |
| 3 | `建立每季記工時單的主程序.js:63-66`（`quarterlyMeetingTicketCreator()`） | 單一出口違規：guard clause |
| 4 | `建立每季記工時單的主程序.js:94-98`（`manualCreateSpecificQuarter()`） | 單一出口違規：guard clause |

### `library/infra-lib`（866 行）

| 編號 | 位置 | 內容 |
|---|---|---|
| 1 | `FormClient.js:199-205`（`getLinkedSheetId()`） | `catch` 範圍過寬，不管是「本來沒連結」還是「存取失敗/權限問題」全部吞成同一個 `null`，跟本資料夾 README 自訂原則「失敗即拋例外」矛盾。目前零外部呼叫，暫不會踩到，但一有人開始用就會踩坑 |
| 2 | `SheetClient.js:213-218`（`appendRows()`） | 單一出口違規：guard clause |

### `library/notify-lib`（467 行）

| 編號 | 位置 | 內容 |
|---|---|---|
| 1 | `Notifier.js:82-87`（`_post()`） | 單一出口違規：guard clause |
| 2 | `testChatNotifier.js:5-37` | 名為「test」的全域函式，實際會真的發送 2 則訊息到 Chat webhook，跟已移除的 `testReminderNotifier()` 是同一種風險（出現在 GAS 函式選單，手滑就真的發送） |

---

## 已定案的設計決策（不要重新討論）

這些是先前討論後定案的，記錄原因避免重複來回：

1. **不做自動修復。** 失敗就發通知，人自己判斷缺哪一步，呼叫 `手動操作.gs` 裡對應的函式補上。理由：狀況比較好掌握，不會有「它幫我修了什麼我不知道」。

2. **不允許兩個 Sprint 並存。** GAS 一次性排程無法攜帶參數，觸發時只能現場找「結束日最晚的 Sprint」，兩個並存就會處理到錯的那個。實務上沒有同時跑兩個回顧的需求，直接擋掉最簡單。

3. **殘留排程會擋住 `prepareRetro`，這是刻意的。** 它強迫人先把問題處理完，那次回顧才不會被悄悄跳過。

4. **只搜尋「今年 + 去年」的年度資料夾。** Sprint 週期兩週，最新的一個只可能在這兩年。兩年都找不到就拋錯停下來——硬撈更舊的只會算出日期在過去的新 Sprint。

5. **Sprint 依「開始日」的年份歸檔。** 跨年 Sprint `1228-0108` 放在 `2026/`，解析時基準年取「所在的年度資料夾年份」，不是今天的年份。

6. **入口一定是全域函式。** GAS 的觸發器與函式選單只認全域函式，所以 `prepareRetro`／`publishTask`／`reminderTask` 與所有手動操作都是全域函式，但只是一行薄包裝。

7. **命名規範**：class 是名詞、方法是動詞、私有才加 `_`、資料夾用 kebab-case。有測試自動把關。

8. **不使用預先 return（guard clause）**，改用單一出口。`throw` 與 `switch` 分派表不算。

9. **`SprintFinder`/`SprintFolderBuilder` 不用把 `Infra.DriveMime` 改成建構子注入。** `Infra` 本身在 GAS 就是掛載的 library，呼叫端本來就是用 `Infra.xxx` 這種全域方式在用；`DriveMime` 只是常數不是服務，注入它換不到測試或耦合上的實際好處。已經試著改過一輪（牽動 5 個檔案 11 個呼叫點）又復原，維持現狀。

10. **建構子參數超過 3 個才需要統一存放方式，統一成 `constructor(option) { this._option = {...} }`。** 判斷標準：只有本身是完整值物件的參數（像 `config`）整包存才合理；性質不同的依賴各自攤平存，才看得出這個 class 依賴什麼。這次判斷下來，`QuarterlyTicketCreator`/`WorklogMigrator` 的建構子參數沒有一個符合「全域使用、不用注入」的條件（即使來自掛載的 library，工廠函式生出來的服務物件還是要注入，跟 `Infra.DriveMime` 這種純常數不同），所以全部維持注入，只是改成上述的存放方式。順便發現 `QuarterlyTicketCreator` 的 `jiraEnv` 欄位從沒被讀取過（只用到 `getJiraUrl()`），已改成呼叫端直接傳 `domain` 字串進來。GAS 沒有 `#field` 真正私有欄位的支援（會 parsing error），私有靠 `_` 前綴命名慣例即可，不用額外做 getter/setter。3 個參數以下（`SprintForm`、`SprintFinder`、`FailureNotifier` 等）不用處理。

---

## 建議的處理順序

1. **J → K**（部署設定，做完才能真的上線）
2. `scrum/retrospective` 部署到 GAS 並確認能實際運作
3. **三 的 ISSUE2**（未審查專案複查發現，24 項，建議先看 `jira/worklog-migrate` 的 2 個風險）
4. G 段落的 4 個 ISSUE

## 怎麼跑測試

```bash
node me/taichi/f2e/test/run.js          # 全部
node me/taichi/f2e/test/run.js retro    # 只跑檔名含 retro 的
```
