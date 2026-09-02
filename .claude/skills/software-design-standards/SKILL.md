---
name: software-design-standards
description: Use when writing or refactoring code in any language — creating a new module, class, method, or restructuring existing code. Also applies when reviewing code for structure.
---

# Software Design Standards

物件導向優先、遵循 SOLID。這些是硬性要求，不是偏好。

## 結構：每個檔案一個 class

**散裝的 function 集合不算模組。** 邏輯放進 class，檔案名稱 = class 名稱。

只有在執行環境限制下（例如 Google Apps Script 的觸發器與函式選單只認全域函式）才寫全域函式，而且必須是**一行薄包裝**：

```js
class RetroPreparer {
  run() { /* 邏輯全在這 */ }
}

function prepareRetro(e) {          // 環境要求的入口，只轉呼叫
  return new RetroPreparer(OPTIONS).run();
}
```

## 命名

| 對象 | 規則 | ✅ | ❌ |
|---|---|---|---|
| class | 名詞或形容詞，大駝峰 | `SprintPlanner` `DateFormat` | `PlanSprint` `Utils` |
| 方法 | **動詞開頭** | `findLatest` `calcPublishDate` `renderCard` | `latestSprint` `publishDateFor` `card` |
| 私有 | 前綴 `_`，且**只有**私有加 | `_loadTemplates` `this._drive` | `loadTemplates`（私有卻沒標） |
| 公開欄位 | 不存在。所有實例欄位一律 `this._x` | `this._options` | `this.options` |

「事件名」不是動詞：`sprintCreated` → `renderSprintCreated`。

## SOLID

**S — 一個 class 一件事。** 一個方法同時做「找資料、算日期、建檔案、發通知」就是該拆的訊號。

**D — 依賴由建構子注入，不在 class 內部自己建立。**

```js
// ❌ 自己建立具體依賴 —— 無法測試，換實作要改內部
class SprintFinder {
  constructor() { this._drive = Infra.createDriveClient(); }
}

// ✅ 注入 —— 測試直接傳假物件
class SprintFinder {
  constructor(drive, rootId) {
    this._drive  = drive;
    this._rootId = rootId;
  }
}
```

具體依賴只在**組裝根**（entry point / factory）建立一次。

**I — 參數只要真正用到的。** 方法只用 `list[0]` 就別要求整個 list——那會逼呼叫端多做一次昂貴的查詢。

**O — 用資料表或策略取代分支蔓延**，新增類型時不改既有邏輯。

## 單一出口

不使用預先 return（guard clause）。用變數承接結果，`if/else` 包住主邏輯，最後統一 return。

```js
// ❌
function parse(input) {
  if (!input) return null;
  return { value: input.trim() };
}

// ✅
function parse(input) {
  let result = null;
  if (input) { result = { value: input.trim() }; }
  return result;
}
```

**例外**：`throw`（是例外處理不是回傳）、`switch` 分派表。

## 動手前先確認

改動既有程式碼前**先提方案徵詢**，不要直接編輯檔案。即使方向已討論過、即使問題很明確。

## 常見違規

| 症狀 | 該做什麼 |
|---|---|
| 寫了一組 `export function` 就交差 | 收進 class |
| class 裡 `new SomeClient()` / `SomeLib.create()` | 改成建構子注入 |
| `this.foo = x` | 改成 `this._foo = x` |
| 方法叫 `userData` / `configFor` | 改成 `getUserData` / `calcConfig` |
| 函式開頭一排 `if (...) return` | 改成單一出口 |
| 直接開始改檔案 | 停下來，先提方案 |
