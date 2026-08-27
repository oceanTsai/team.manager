function testAdminLead() {

    const jira = new JiraEnv();


  // 印出讀到的 email，確認環境變數有讀到
  Logger.log(`JIRA_EMAIL_OCEAN: ${jira.getAdminLead().email}`);
  Logger.log(`JIRA_TOKEN_OCEAN: ${jira.getAdminLead().token ? '有值' : '空的'}`);

  // 直接打 /myself 確認 token 有效
  const headers = jira.getAdminLead().authHeaders;
  const response = UrlFetchApp.fetch('https://104corp.atlassian.net/rest/api/3/myself', {
    method: 'get',
    headers: headers,
    muteHttpExceptions: true
  });

  Logger.log(`HTTP 狀態碼: ${response.getResponseCode()}`);

  if (response.getResponseCode() === 200) {
    const data = JSON.parse(response.getContentText());
    Logger.log(`✓ 認證成功`);
    Logger.log(`displayName: ${data.displayName}`);
    Logger.log(`email: ${data.emailAddress}`);
  } else {
    Logger.log(`✗ 認證失敗: ${response.getContentText()}`);
  }
}