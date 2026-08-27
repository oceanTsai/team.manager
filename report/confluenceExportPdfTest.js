// // =============================
// // PDF 匯出 - 圖片顯示為名稱+連結(放棄內嵌)
// // =============================

// const PDF_BASE_URL = "https://104corp.atlassian.net/wiki";
// const PDF_EMAIL = "ocean.tsai@104.com.tw";
// const PDF_API_TOKEN = PropertiesService.getScriptProperties()
//     .getProperty('APPS_SCRIPT_JIRA_TOKEN_2027_5_16');
// const PDF_ROOT_PAGE_ID = "34275329";
// const PDF_PARENT_FOLDER_ID = "1guxSg2R6UmsGQgQiX5eAuw0563pj_WMb";

// // === 認證 ===
// function getPdfAuthHeader() {
//   if (!PDF_API_TOKEN) {
//     throw new Error("找不到 API token");
//   }
//   const token = Utilities.base64Encode(`${PDF_EMAIL}:${PDF_API_TOKEN}`);
//   return {
//     "Authorization": `Basic ${token}`,
//     "Accept": "application/json"
//   };
// }

// // === 主程式 ===
// function exportRootTreeToPdf() {
//   const rootPage = fetchPageContentForPdf(PDF_ROOT_PAGE_ID);
//   if (!rootPage) throw new Error(`抓不到 root 頁面 ${PDF_ROOT_PAGE_ID}`);
//   Logger.log(`Root 頁面: ${rootPage.title}`);
  
//   const parent = DriveApp.getFolderById(PDF_PARENT_FOLDER_ID);
//   const timestamp = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyyMMdd_HHmm");
//   const safeTitle = rootPage.title.replace(/[\\/:*?"<>|]/g, "_");
//   const folder = parent.createFolder(`${safeTitle}_${timestamp}`);
//   Logger.log(`建立資料夾: ${folder.getName()}`);
//   Logger.log(`資料夾連結: ${folder.getUrl()}\n`);
  
//   const allIds = [PDF_ROOT_PAGE_ID];
//   collectChildIds(PDF_ROOT_PAGE_ID, allIds);
//   Logger.log(`共找到 ${allIds.length} 頁,開始匯出...\n`);
  
//   let success = 0, failed = 0;
//   for (let i = 0; i < allIds.length; i++) {
//     const pageId = allIds[i];
//     try {
//       const content = (pageId === PDF_ROOT_PAGE_ID) ? rootPage : fetchPageContentForPdf(pageId);
//       if (content) {
//         savePageAsPdf(folder, content, pageId);
//         success++;
//         Logger.log(`[${i + 1}/${allIds.length}] ✅ ${content.title}`);
//       } else {
//         failed++;
//         Logger.log(`[${i + 1}/${allIds.length}] ❌ 抓不到 ${pageId}`);
//       }
//     } catch (e) {
//       failed++;
//       Logger.log(`[${i + 1}/${allIds.length}] ❌ ${pageId} - ${e}`);
//     }
//     Utilities.sleep(300);
//   }
  
//   Logger.log(`\n✅ 完成! 成功 ${success} / 失敗 ${failed}`);
//   Logger.log(`資料夾連結: ${folder.getUrl()}`);
// }

// // === 遞迴抓子頁面 ===
// function collectChildIds(pageId, accumulator) {
//   let url = `${PDF_BASE_URL}/api/v2/pages/${pageId}/children?limit=250`;
//   while (url) {
//     const response = UrlFetchApp.fetch(url, {
//       method: "get", headers: getPdfAuthHeader(), muteHttpExceptions: true
//     });
//     if (response.getResponseCode() !== 200) return;
//     const data = JSON.parse(response.getContentText());
//     const children = data.results || [];
//     for (const child of children) {
//       accumulator.push(child.id);
//       collectChildIds(child.id, accumulator);
//     }
//     const nextLink = data._links && data._links.next;
//     url = nextLink ? `${PDF_BASE_URL}${nextLink}` : null;
//   }
// }

// // === 抓單頁內容 ===
// function fetchPageContentForPdf(pageId) {
//   const url = `${PDF_BASE_URL}/api/v2/pages/${pageId}?body-format=export_view`;
//   const response = UrlFetchApp.fetch(url, {
//     method: "get", headers: getPdfAuthHeader(), muteHttpExceptions: true
//   });
//   if (response.getResponseCode() !== 200) return null;
//   const data = JSON.parse(response.getContentText());
//   return {
//     id: data.id, title: data.title,
//     html: data.body.export_view.value, spaceId: data.spaceId
//   };
// }

// // === 抓 attachment 對照表(只用 metadata,不下載檔案)===
// function getAttachmentMap(pageId) {
//   const map = {};
//   let url = `${PDF_BASE_URL}/api/v2/pages/${pageId}/attachments?limit=250`;
//   while (url) {
//     const response = UrlFetchApp.fetch(url, {
//       method: "get", headers: getPdfAuthHeader(), muteHttpExceptions: true
//     });
//     if (response.getResponseCode() !== 200) return map;
//     const data = JSON.parse(response.getContentText());
//     const attachments = data.results || [];
//     for (const att of attachments) {
//       const title = att.title;
//       const webuiLink = att.webuiLink || (att._links && att._links.webui);
//       if (title && webuiLink) {
//         const fullUrl = webuiLink.startsWith("http") ? webuiLink : PDF_BASE_URL + webuiLink;
//         map[title] = fullUrl;
//         try { map[decodeURIComponent(title)] = fullUrl; } catch (e) {}
//       }
//     }
//     const nextLink = data._links && data._links.next;
//     url = nextLink ? `${PDF_BASE_URL}${nextLink}` : null;
//   }
//   return map;
// }

// // === URL 抽出檔名 ===
// function extractFilename(url) {
//   const noQuery = url.split("?")[0];
//   const parts = noQuery.split("/");
//   let name = parts[parts.length - 1];
//   try { name = decodeURIComponent(name); } catch (e) {}
//   return name;
// }

// // === 判斷該跳過的圖片 ===
// function shouldSkipImage(src) {
//   if (!src) return true;
//   if (src.indexOf("/plugins/servlet/confluence/placeholder") !== -1) return true;
//   if (src.indexOf("placeholder/error") !== -1) return true;
//   if (src.indexOf("/images/icons/emoticons/") !== -1) return true;
//   return false;
// }

// // === HTML entity decode ===
// function decodeHtmlEntities(str) {
//   return str.replace(/&amp;/g, "&").replace(/&lt;/g, "<")
//     .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
// }

// // === 把 HTML 內的圖片全部換成「📎 檔名 + 連結」說明框 ===
// function replaceImagesWithLinks(html, pageId) {
//   const attachmentMap = getAttachmentMap(pageId);
//   const imgRegex = /<img\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*?)>/gi;
//   let imgCount = 0, linkCount = 0, skipCount = 0;
  
//   const result = html.replace(imgRegex, function(match, before, src, after) {
//     imgCount++;
//     const cleanSrc = decodeHtmlEntities(src);
    
//     // data: URI 直接保留(內嵌的小圖示)
//     if (cleanSrc.startsWith("data:")) return match;
    
//     // placeholder 直接拿掉
//     if (shouldSkipImage(cleanSrc)) {
//       skipCount++;
//       return "";
//     }
    
//     // 抽檔名,查 attachment 連結
//     const filename = extractFilename(cleanSrc);
//     let decoded = filename;
//     try { decoded = decodeURIComponent(filename); } catch (e) {}
    
//     const webuiLink = attachmentMap[filename] || attachmentMap[decoded] || cleanSrc;
//     linkCount++;
    
//     return `<div style="border:1px dashed #999;padding:10px;margin:10px 0;background:#f9f9f9;border-radius:4px;">
//       📎 <strong>圖片:</strong> ${decoded}<br>
//       <span style="font-size:0.9em;color:#666;">🔗 <a href="${webuiLink}" target="_blank">在 Confluence 開啟</a></span>
//     </div>`;
//   });
  
//   if (imgCount > 0) {
//     Logger.log(`  📷 圖片處理: 轉連結 ${linkCount},跳過 ${skipCount} (共 ${imgCount})`);
//   }
//   return result;
// }

// // === HTML → PDF 存檔 ===
// function savePageAsPdf(folder, page, pageId) {
//   const safeTitle = page.title.replace(/[\\/:*?"<>|]/g, "_");
//   const filename = `${safeTitle}.pdf`;
//   const htmlProcessed = replaceImagesWithLinks(page.html, pageId);
  
//   const fullHtml = `<!DOCTYPE html>
// <html><head><meta charset="utf-8"><title>${page.title}</title>
// <style>
//   body { font-family: -apple-system, "Microsoft JhengHei", sans-serif; max-width: 900px; margin: 2em auto; padding: 0 1em; }
//   table { border-collapse: collapse; }
//   table, th, td { border: 1px solid #ccc; padding: 6px; }
//   img { max-width: 100%; }
//   code { background: #f4f4f4; padding: 2px 4px; }
//   pre { background: #f4f4f4; padding: 1em; overflow: auto; }
// </style></head>
// <body>
// <h1>${page.title}</h1>
// <p style="color:#888;font-size:0.9em">
//   Page ID: ${page.id} | 
//   <a href="${PDF_BASE_URL}/spaces/Bteam/pages/${page.id}">原始連結</a>
// </p>
// <hr>
// ${htmlProcessed}
// </body></html>`;
  
//   const existing = folder.getFilesByName(filename);
//   while (existing.hasNext()) existing.next().setTrashed(true);
  
//   const blob = Utilities.newBlob(fullHtml, "text/html", `${safeTitle}.html`).getAs("application/pdf");
//   blob.setName(filename);
//   folder.createFile(blob);
// }

// // === 列頁面樹 ===
// function testListTree() {
//   const rootPage = fetchPageContentForPdf(PDF_ROOT_PAGE_ID);
//   Logger.log(`Root: ${rootPage.title}\n`);
//   const allIds = [PDF_ROOT_PAGE_ID];
//   collectChildIds(PDF_ROOT_PAGE_ID, allIds);
//   Logger.log(`共 ${allIds.length} 頁:\n`);
//   for (let i = 0; i < allIds.length; i++) {
//     const p = fetchPageContentForPdf(allIds[i]);
//     if (p) Logger.log(`  [${i + 1}] [${p.id}] ${p.title}`);
//     Utilities.sleep(100);
//   }
// }