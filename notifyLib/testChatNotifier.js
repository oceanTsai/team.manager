/**
 * 測試 ChatNotifier 是否正常運作
 * 執行後去 Google Chat 確認有沒有收到測試訊息
 */
function testChatNotifier() {
  // 1. 拿 webhook URL(從環境變數)
  const webhookUrl = PropertiesService.getScriptProperties().getProperty('CHAT_DEVLOP_WEBHOOK_URL');

  if (!webhookUrl) {
    Logger.log('✗ 未設定 CHAT_DEVLOP_WEBHOOK_URL');
    return;
  }

  // 2. 建立 notifier
  const notifier = createChatNotifier(webhookUrl);

  // 3. 測試 send():純文字
  Logger.log('--- 測試 send() ---');
  const sendOk = notifier.send('🧪 ChatNotifier 測試訊息(純文字)');
  Logger.log(`send() 結果: ${sendOk ? '✓ 成功' : '✗ 失敗'}`);

  // 4. 測試 sendCard():完整 message 結構
  Logger.log('--- 測試 sendCard() ---');
  const sendCardOk = notifier.sendCard({
    title: '🧪 ChatNotifier 測試卡片',
    subtitle: '這是副標題',
    fields: [
      { label: '欄位 A', value: '值 A' },
      { label: '欄位 B(有連結)', value: '值 B', link: 'https://104corp.atlassian.net' },
      { label: '欄位 C(無連結)', value: '值 C' }
    ],
    actions: [
      { text: '開啟 Jira', url: 'https://104corp.atlassian.net' }
    ]
  });
  Logger.log(`sendCard() 結果: ${sendCardOk ? '✓ 成功' : '✗ 失敗'}`);
}