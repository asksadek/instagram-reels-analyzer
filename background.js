// Instagram Reels Analyzer — Background Service Worker

// Register MAIN world interceptor
chrome.runtime.onInstalled.addListener(() => {
  chrome.scripting.registerContentScripts([{
    id: "ig-interceptor",
    matches: ["https://www.instagram.com/*"],
    js: ["interceptor.js"],
    world: "MAIN",
    runAt: "document_start"
  }]).catch(err => {
    // Already registered — update it
    chrome.scripting.updateContentScripts([{
      id: "ig-interceptor",
      matches: ["https://www.instagram.com/*"],
      js: ["interceptor.js"],
      world: "MAIN",
      runAt: "document_start"
    }]).catch(() => {});
  });
});

// Open side panel on extension icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// In-memory store keyed by tab ID
let collectedPosts = {};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab?.id || msg.tabId;

  if (msg.type === "POSTS_DATA") {
    if (!tabId) { sendResponse({ ok: false }); return true; }

    if (!collectedPosts[tabId]) collectedPosts[tabId] = {};

    let added = 0;
    for (const post of (msg.posts || [])) {
      if (post.shortcode && !collectedPosts[tabId][post.shortcode]) {
        collectedPosts[tabId][post.shortcode] = post;
        added++;
      } else if (post.shortcode) {
        // Update existing with any new data
        Object.assign(collectedPosts[tabId][post.shortcode], post);
      }
    }

    const totalCount = Object.keys(collectedPosts[tabId]).length;
    console.log(`[IG Analyzer BG] Stored ${added} new posts (total: ${totalCount}) from tab ${tabId}`);

    // Forward to side panel
    chrome.runtime.sendMessage({
      type: "POSTS_UPDATE",
      posts: Object.values(collectedPosts[tabId]),
      tabId
    }).catch(() => {});

    sendResponse({ ok: true, count: totalCount });
  }
  else if (msg.type === "GET_POSTS") {
    const posts = Object.values(collectedPosts[msg.tabId] || {});
    console.log(`[IG Analyzer BG] GET_POSTS for tab ${msg.tabId}: ${posts.length} posts`);
    sendResponse({ posts });
  }
  else if (msg.type === "CLEAR_POSTS") {
    collectedPosts[msg.tabId] = {};
    sendResponse({ ok: true });
  }
  else if (msg.type === "START_SCROLL" || msg.type === "STOP_SCROLL") {
    console.log(`[IG Analyzer BG] Forwarding ${msg.type} to tab ${msg.tabId}`);
    chrome.tabs.sendMessage(msg.tabId, msg).catch(err => {
      console.error(`[IG Analyzer BG] Failed to send to tab:`, err);
    });
    sendResponse({ ok: true });
  }
  else if (msg.type === "SCROLL_STATUS") {
    chrome.runtime.sendMessage(msg).catch(() => {});
  }

  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete collectedPosts[tabId];
});
