# notifyLib — 跨平台通知 Library

> 掛載識別碼：**`Notify`**
> Script ID：`1P0w2KWO77JiugnqrcjyRJn6wxDSWmHuazzFUL2446vb2VISYWrluYpib`

提供「訊息內容」與「發送管道」互相解耦的通知能力。業務層只依賴抽象介面，不需要知道訊息實際上是送到 Google Chat 還是別的地方。

## 檔案

| 檔案 | 功能 |
|---|---|
| `Notifier.js` | 通知器抽象基底，定義 `send` / `sendCard` 介面 + 共用 HTTP POST |
| `ChatNotifier.js` | Google Chat 實作，把通用 Message 轉成 Card v2 payload |
| `MessageTemplate.js` | 訊息樣板抽象基底（策略模式），業務層繼承後實作 `render()` |
| `testChatNotifier.js` | 測試：實際發一則純文字 + 一則 Card 到 Chat |

尚未實作但已規劃：`SlackNotifier`、`TeamsNotifier`、`EmailNotifier`。

## 核心概念：通用 Message 結構

這是整個 Library 的樞紐。`MessageTemplate` 產出它，`Notifier` 消費它，兩邊都不需要認識對方。

```js
{
  title:    string,        // 標題（必填）
  subtitle: string,        // 副標題（選填）
  fields: [                // 結構化欄位（選填）
    { label: string, value: string, link?: string }   // 有 link 就自動長出「開啟」按鈕
  ],
  actions: [               // 底部按鈕（選填）
    { text: string, url: string }
  ]
}
```

```
   業務資料 ──render()──▶ 通用 Message ──sendCard()──▶ 平台格式（Card v2 / Slack blocks / …）
            MessageTemplate              Notifier
```

## API

### 發送

```js
const notifier = Notify.createChatNotifier(webhookUrl);

notifier.send('純文字訊息');           // → boolean
notifier.sendCard({                    // → boolean
  title: '✅ 處理完成',
  subtitle: '共 3 筆',
  fields:  [{ label: '狀態', value: '成功', link: 'https://...' }],
  actions: [{ text: '開啟', url: 'https://...' }]
});
```

**回傳 `boolean` 而不是拋例外**——通知失敗只寫 log，不會讓主流程跟著炸掉。想知道有沒有送成功就檢查回傳值。

### 自訂樣板

```js
const _MessageTemplate = Notify.getMessageTemplateClass();   // 取得基底 class

class MyTemplate extends _MessageTemplate {
  render(data) {
    return {
      title:   '處理結果',
      fields:  data.items.map(i => ({ label: i.name, value: i.status })),
      actions: [{ text: '查看', url: data.url }]
    };
  }
}

notifier.sendCard(new MyTemplate().render(myData));
```

`getMessageTemplateClass()` 是為了繞過「Library 不 export class」的限制——它回傳 class 本身，讓引用方可以 `extends`。

實際範例可以看 `report/RetroMessageTemplate.js` 和 `report/每季工時訊息通知樣板.js`。

## Google Chat Card v2 對應

`ChatNotifier` 的轉換規則：

| 通用 Message | Google Chat Card v2 |
|---|---|
| `title` / `subtitle` | `card.header.title` / `card.header.subtitle` |
| `fields[]` | 一個 section，每個 field 變成 `decoratedText` widget（`topLabel` + `text`） |
| `fields[].link` | 該 widget 右側多一顆「開啟」按鈕 |
| `actions[]` | 另一個 section，包成 `buttonList` widget |

## 設定

Webhook URL **請存在引用方專案的指令碼屬性**，不要寫死在程式碼。取得方式：進 Chat 聊天室 → 應用程式與整合 → 新增 Webhook。

`testChatNotifier.js` 讀的是 `CHAT_DEVLOP_WEBHOOK_URL`（開發測試用）。各應用專案自己用的屬性名不同，見各專案 README。

## ⚠️ 使用注意

1. Webhook 只能**單向發送**，Card 上的按鈕點了沒人接收；要做互動需要部署成 Chat App。
2. 改完 Library 要重新部署版本，引用方才看得到變更。
3. 發送失敗不拋例外，需要確認結果的話自己檢查回傳值。
