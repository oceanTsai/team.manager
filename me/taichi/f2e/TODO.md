# 待處理清單

> 這份文件是**自足的**——新開一個對話直接讀這裡就能接手，不需要先前的對話記錄。
> 最後更新：2026-09-04
>
> **範圍**：只列 `me/` 底下的任務。repo 根目錄的舊資料夾（`bugAssignment/`、`envLib/`、`infraLib/`、`jiraLogMigrate/`、`notifyLib/`、`report/`）屬於另一個 Google 空間、線上還在跑，不在這次重構範圍內，不列入。
>
> **測試**：正在改設計流程中，測試先不個別列項目——等重構完畢後測試會整個重做一次。

## 現況

- B、A 項目已修好並已提交
- `scrum/retrospective` 已完成重構：拆成單一職責的類別、依賴由建構子注入
- **`node me/taichi/f2e/test/run.js` 目前會卡死跑不完**——`test/retrospective/classes.test.js` 裡還有一行用舊介面呼叫 `planNext()`（傳陣列),A 項目改介面後這行會讓迴圈跑不出來。先不修（見上方「測試」範圍說明),等重構完畢後測試整個重做
- **尚未部署**——`me/` 底下沒有任何 `.clasp.json`

---

## 一、`scrum/retrospective` 核心程式碼

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

---

## 二、`library`（跨專案）

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

## 三、部署設定

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

## 四、從未審查過的專案（約 3700 行）

| 專案 | 行數 |
|---|---|
| `bug-triage` | 1125 |
| `library/infra-lib` | 862 |
| `jira/worklog-migrate` | 677 |
| `jira/quarterly-tickets` | 548 |
| `library/notify-lib` | 467 |

只有 `scrum/retrospective`（1329 行）和舊的 `envLib` 做過完整審查。以 retrospective 找出 12 個問題的密度推估，**這 3700 行裡很可能還有一批未發現的問題**——這是推估，不是實測。

---

## 五、懸而未決的討論

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

1. **G**（影響最廣，通知靜默失敗）
2. **J → K**（部署設定，做完才能真的上線）
3. **C / D / H / I / M**（優先度較低）
4. **四**（未審查的專案，建議一個一個過）

## 怎麼跑測試

> ⚠️ 目前執行下面指令會卡死跑不完，見上方「現況」說明。

```bash
node me/taichi/f2e/test/run.js          # 全部
node me/taichi/f2e/test/run.js retro    # 只跑檔名含 retro 的
```
