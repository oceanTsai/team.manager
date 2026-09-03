# 待處理清單

> 這份文件是**自足的**——新開一個對話直接讀這裡就能接手，不需要先前的對話記錄。
> 最後更新：2026-09-03

## 現況

- B 項目已修好（`prepareRetro.js` 的 `RetroPreparer._createNext()` 加了過期檢查），**尚未 commit**
- 其餘程式碼已提交並 push（最新 commit `d8b3927`）
- `scrum/retrospective` 已完成重構：拆成單一職責的類別、依賴由建構子注入
- 測試 88 個全過：`node me/taichi/f2e/test/run.js`
- **尚未部署**——`me/` 底下沒有任何 `.clasp.json`

---

## 一、`scrum/retrospective` 核心程式碼

### A. `planNext()` 介面要求過多，導致重複抓 Drive 🟠

**位置**：`SprintPlanner.js` 的 `planNext(recentSprints)`、`prepareRetro.js` 的 `RetroPreparer`

`planNext()` 只用到 `recentSprints[0]`，卻要求呼叫端傳整個清單。於是 `RetroPreparer.run()` 呼叫 `findLatest()`（內部含 `listRecent()`），`_createNext()` 又呼叫一次 `listRecent()`。

實測一次 `prepareRetro` 打 **8 次** Drive 呼叫，實際只需 4 次。

**修法**：把參數改成 `planNext(latestSprint)`（可為 null）。呼叫端就不用多抓一次。同時解掉介面隔離的問題。

呼叫點：`prepareRetro.js` 的 `_createNext()`、`手動操作.js` 的 `showNextSprint()` 與 `_resolveSprintSpec()`。

---

### C. `ReminderNotifier` 要求兩個 webhook 都設定 🟡

**位置**：`ReminderNotifier.js` 建構子

```js
if (!personalUrl) throw ...
if (!teamUrl) throw ...     // 建構子就擋，即使這次只發個人頻道
```

只設定個人頻道（`RETRO_CHAT_WEBHOOK_URL`）就完全不能發任何通知，連 `notifyCreated()` 這種只用個人頻道的也被擋。

**修法**：把檢查從建構子移到各個 `notifyXXX()` 方法——用到哪個才檢查哪個。

---

### D. 依賴注入只做了一半 🟡

**位置**：`SprintFinder.js`、`SprintFolderBuilder.js`

兩者仍直接引用全域 `Infra.DriveMime`。不過這是**常數**不是服務，可以主張是可接受的例外——優先度最低。

若決定不改，應該把 `test/retrospective/conventions.test.js` 的斷言訊息改成誠實反映例外（見 F）。

---

## 二、`scrum/retrospective` 測試

### E. 編排層零測試覆蓋 🔴

`RetroPreparer`、`FormPublishTask`、`TeamReminderTask` 在測試裡出現 **0 次**。88 個測試全在測底層類別。

三條流程手動探測過都能正常跑（建立 → 發布 → 提醒，卡片發到正確頻道），但沒有自動化測試守著。

**難點**：這三個類別是組裝根，自己呼叫 `Infra.createDriveClient()`，測試需要 stub 全域 `Infra`。可參考先前的探測腳本做法。

---

### F. 規範測試的斷言比它宣稱的弱 🟠

**位置**：`test/retrospective/conventions.test.js` 第 27–36 行

訊息寫「類別不自己去拿 Infra」，但實際只檢查 `Infra.create*`：

```js
check(`${f} 不呼叫 Infra.create*`, /Infra\.create/.test(...), false);
```

所以 D 提到的 `Infra.DriveMime` 溜過去了。**這比程式碼本身的問題更值得修——它會給人錯誤的安全感。**

---

## 三、`library`（跨專案）

### G. 通知發送失敗被吞掉 🔴

**位置**：`library/notify-lib/Notifier.js` 第 88 行

```js
} catch (e) {
  Logger.log(...);
  return false;    // 只寫 log，不拋錯
}
```

webhook 失效時流程照常走完，但**沒有人收到通知，也不會有錯誤**。

**影響範圍**：`notify-lib` 是共用 library，牽動 `scrum/retrospective` 與 `jira/quarterly-tickets`。要改就是跨專案改動。

---

### H. `notify-env-lib._getRequired()` 是死碼 🟡

**位置**：`library/notify-env-lib/NotifyEnvLib.js`

零呼叫者。唯一註冊的 key（`JIRA_MESSAGE_WEBHOOK_URL`）是 `required: false`，所有路徑都走 `_getOptional()`。

---

### I. `_getRequired()` 在兩個 library 各有一份 🟡

`library/jira-identity-lib/` 與 `library/notify-env-lib/` 各有一份幾乎相同的實作。

**注意**：兩者是**獨立的 GAS 專案**，要共用得讓其中一個依賴另一個——不是單純抽函式就能解決。修不修要權衡。

---

## 四、部署設定

### J. `me/` 底下沒有任何 `.clasp.json` 🔴

**所有修正目前都無法部署。** 需要在新的 Google 帳號建立 Apps Script 專案，取得 scriptId 後才能設定。

要建立的專案（各自獨立 scriptId）：

| 資料夾 | 說明 |
|---|---|
| `library/infra-lib` | 可沿用原 scriptId `17AFWXtq5xxqn8SDmL4ovnaGXCBvpInEPDzIf8Te_gFXik0qKOViI13Oi`（內容沒改名） |
| `library/notify-lib` | 可沿用原 scriptId `1P0w2KWO77JiugnqrcjyRJn6wxDSWmHuazzFUL2446vb2VISYWrluYpib` |
| `library/jira-identity-lib` | **需要新的**（從 envLib 拆出來的） |
| `library/notify-env-lib` | **需要新的**（從 envLib 拆出來的） |
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
| `jira/quarterly-tickets/appsscript.json` | 14 | `notify-env-lib` 的 scriptId |

---

### L. 封存的 `report/` 仍綁著線上 scriptId 🟠

`report/.clasp.json` 指向 `1mc9eivKYBtllCbZi4sHuJuVKoZVszpvfxt9H-3lXxqQflr4uLn7o_gCm`，而 `report/` 裡是**舊的壞版本**（`tm.cancel()` 無差別刪排程、引用不存在的 `SPRINT_OPTIONS.parentFolderId`、只搜尋當年度資料夾）。

**風險**：有人誤從 `report/` 執行 `clasp push`，會把線上專案覆蓋回壞的版本。

考慮的處理方式：把封存資料夾的 `.clasp.json` 移除或改名，讓它們無法被 push。

---

## 五、從未審查過的專案（約 3700 行）

| 專案 | 行數 |
|---|---|
| `bug-triage` | 1125 |
| `library/infra-lib` | 862 |
| `jira/worklog-migrate` | 677 |
| `jira/quarterly-tickets` | 548 |
| `library/notify-lib` | 467 |

只有 `scrum/retrospective`（1329 行）和舊的 `envLib` 做過完整審查。以 retrospective 找出 12 個問題的密度推估，**這 3700 行裡很可能還有一批未發現的問題**——這是推估，不是實測。

---

## 六、懸而未決的討論

### M. 建構子要不要改用 `this.options`

先前討論過但沒結論。整包 repo 目前有三種風格：

| 類別 | 寫法 |
|---|---|
| `SprintFolderBuilder` 等 | 攤平成獨立欄位 |
| `QuarterlyTicketCreator` | `this.config = config`（整包存） |
| `WorklogMigrator` | 解構參數帶預設值 |

若要統一成 `this.options`，注意 **GAS 沒有物件展開 `{...x}` 的前例**（封存版程式碼中沒有用過），建議用明確列欄位的寫法。

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

---

## 建議的處理順序

1. **A**（同一個檔案，順手做掉）
2. **G**（影響最廣，通知靜默失敗）
3. **J → K → L**（部署設定，做完才能真的上線）
4. **E / F**（測試缺口）
5. **C / D / H / I / M**（優先度較低）
6. **五**（未審查的專案，建議一個一個過）

## 怎麼跑測試

```bash
node me/taichi/f2e/test/run.js          # 全部
node me/taichi/f2e/test/run.js retro    # 只跑檔名含 retro 的
```
