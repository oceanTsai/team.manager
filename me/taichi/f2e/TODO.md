# 待處理清單

> 這份文件是**自足的**——新開一個對話直接讀這裡就能接手，不需要先前的對話記錄。
> 最後更新：2026-09-23
>
> **範圍**：只列 `me/` 底下的任務。repo 根目錄的舊資料夾（`bugAssignment/`、`envLib/`、`infraLib/`、`jiraLogMigrate/`、`notifyLib/`、`report/`）屬於另一個 Google 空間、線上還在跑，不在這次重構範圍內，不列入。

## 現況

- B、A、C、N、H 項目已修好並已提交，`scrum/retrospective` 的測試也已補齊並跟上新介面
- `library/notify-webhook-lib`（原 `notify-env-lib`，已改名避免跟 `notify-lib` 搞混）：命名問題（`testNotifyEnvLib()`、`envKeys` 缺 `_`）已修好；`_getRequired()` 死碼已刪除，I（跟 jira-identity-lib 重複實作）因此一併解決；沒有實際效益的單例快取也已拿掉（class 封裝本身保留，只拿掉快取邏輯）。這個資料夾這輪全部處理完
- 四個 library（`infra-lib`／`jira-identity-lib`／`notify-lib`／`notify-webhook-lib`）已於 2026-09-10 全部複查完畢並處理完：共 14 項發現，修好 8 項（含 `jira-identity-lib` 的獨體快取、命名一致性、`SheetClient` 欄位與防呆等）、評估後決定不改 3 項（都是查證過情境後判斷風險低或本來就該是這樣）、擱置不當死碼處理 3 項（`SheetClient`/`DriveClient`/`FormClient` 的零呼叫方法、9 個具名 sugar method——都是預先開發的 library API，不是錯誤）。細節不再列出，已是定案
- `scrum/retrospective` 已完成重構：拆成單一職責的類別、依賴由建構子注入
- `node me/taichi/f2e/test/run.js` 全部通過，共 99 個檢查（4 組，含新加的 `test/retrospective/prepareRetro.test.js`，覆蓋 B 的過期檢查與 A 的查詢次數）
- **尚未部署**——`me/` 底下沒有任何 `.clasp.json`

---

## 一、`library`（跨專案）

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

## 三、從未審查過的專案（約 3700 行）

| 專案 | 行數 |
|---|---|
| `bug-triage` | 1125 |
| `library/infra-lib` | 862 |
| `jira/worklog-migrate` | 677 |
| `jira/quarterly-tickets` | 548 |
| `library/notify-lib` | 467 |

只有 `scrum/retrospective`（1329 行）和舊的 `envLib` 做過完整審查。以 retrospective 找出 12 個問題的密度推估，**這 3700 行裡很可能還有一批未發現的問題**——這是推估，不是實測。

---

## 四、懸而未決的討論

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

9. **`SprintFinder`/`SprintFolderBuilder` 不用把 `Infra.DriveMime` 改成建構子注入。** `Infra` 本身在 GAS 就是掛載的 library，呼叫端本來就是用 `Infra.xxx` 這種全域方式在用；`DriveMime` 只是常數不是服務，注入它換不到測試或耦合上的實際好處。已經試著改過一輪（牽動 5 個檔案 11 個呼叫點）又復原，維持現狀。

---

## 建議的處理順序

1. **G**（影響最廣，通知靜默失敗）
2. **J → K**（部署設定，做完才能真的上線）
3. **M**（優先度較低）
4. **三**（未審查的專案，建議一個一個過）

## 怎麼跑測試

```bash
node me/taichi/f2e/test/run.js          # 全部
node me/taichi/f2e/test/run.js retro    # 只跑檔名含 retro 的
```
