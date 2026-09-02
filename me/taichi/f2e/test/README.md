# test

Apps Script 專案的單元測試。用 Node 直接跑，不需要部署、不會碰到真的 Drive 或 Chat。

## 怎麼跑

```bash
node me/taichi/f2e/test/run.js          # 全部
node me/taichi/f2e/test/run.js retro    # 只跑檔名含 retro 的
```

任何一組失敗就以非 0 結束，之後要接 CI 直接用這個指令。

## 為什麼放在這裡，不放各專案資料夾裡

`clasp push` 會把**專案資料夾內的所有檔案**同步到 Apps Script。測試檔放進去會被一起推上雲端，變成 GAS 專案的一部分——它們用了 `require`、`module.exports` 這些 GAS 不支援的東西，會直接壞掉。

放在 `test/` 這個獨立資料夾（不是任何 clasp 專案的根目錄）就不會被推上去。

## 怎麼在沒有 Google 服務的情況下測

`helpers.js` 模擬了 GAS 的執行環境：

| 模擬對象 | 說明 |
|---|---|
| `Logger` | 收集 log 到陣列，測試可以斷言「有沒有印出某段訊息」 |
| `ScriptApp` | 用陣列模擬排程清單，可以斷言「排定後剩幾個」「刪對了沒」 |
| `Infra` | 只保留測試需要的 `DriveMime` 常數 |
| `fakeDrive()` | 用純物件模擬資料夾/檔案樹，支援建立、複製、查詢 |
| `fakeFormClient()` | 用 `Set` 記錄哪些表單已發布 |

這能做到，是因為 `scrum/retrospective` 的類別**依賴都由建構子注入**——測試直接把假物件傳進去就好，不用去覆寫全域的 `Infra`。

```js
const finder = new SprintFinder(fakeDrive(tree), 'ROOT');
const plan   = new SprintPlanner(11).planNext(sprints);   // 完全不需要 Drive
```

## 測試檔

| 檔案 | 測什麼 |
|---|---|
| `retrospective/classes.test.js` | 每個類別的行為：跨年 Sprint、日期推算、可重複執行的建立、排程管理 |
| `retrospective/notify.test.js` | 三張通知卡片的內容與頻道、失敗通知「絕不拋錯」 |
| `retrospective/conventions.test.js` | 命名與架構規範（見下） |

## conventions.test.js 在把關什麼

這組測試不驗行為，驗的是**架構不會被破壞**：

- class 一律大駝峰名詞、公開方法一律動詞開頭
- 沒有公開欄位（所有 `this.xxx` 都是 `this._xxx`）
- 底層類別不呼叫 `Infra.create*`，依賴一律注入
- `SprintPlanner` 完全不碰 Drive
- 只有編排層與手動入口建立具體依賴（組裝根）
- 排程與選單入口是全域函式（GAS 的硬限制）
- 沒有重複的全域宣告（GAS 共用全域，撞名會被靜默覆蓋）
- 沒有預先 return
- 名為 `test*` 但實為正式執行的函式不存在

改壞了會直接紅燈，不用等 code review 才發現。

## 新增測試

在 `test/<專案名>/` 底下建 `*.test.js`，`run.js` 會自動找到。

慣例：印出 `✅`／`❌` 逐項結果，最後一行 `========== N 通過 / M 失敗 ==========`，失敗時 `process.exit(1)`。`run.js` 靠這行統計總數。
