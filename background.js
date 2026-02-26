// Instagram Reels Analyzer — Background Service Worker

// Register MAIN world script to intercept Instagram API responses
chrome.runtime.onInstalled.addListener(() => {
  chrome.scripting.registerContentScripts([{
    id: "ig-interceptor",
    matches: ["https://www.instagram.com/*"],
    js: ["interceptor.js"],
    world: "MAIN",
    runAt: "document_start"
  }]);
});

// Open side panel on extension icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// In-memory store of collected posts, keyed by tab ID
let collectedPosts = {};

// Message routing between content script, interceptor, and side panel
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "POSTS_DATA") {
    // Incoming post data from content script (bridged from MAIN world interceptor)
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ ok: false, error: "No tab ID" });
      return true;
    }

    if (!collectedPosts[tabId]) collectedPosts[tabId] = {};

    // Merge new posts with existing, deduplicating by shortcode
    for (const post of msg.posts) {
      collectedPosts[tabId][post.shortcode] = post;
    }

    const totalCount = Object.keys(collectedPosts[tabId]).length;

    // Forward updated post list to side panel
    chrome.runtime.sendMessage({
      type: "POSTS_UPDATE",
      posts: Object.values(collectedPosts[tabId])
    }).catch(() => {});

    sendResponse({ ok: true, count: totalCount });
  }
  else if (msg.type === "GET_POSTS") {
    // Side panel requesting current collected data
    const tabId = msg.tabId;
    sendResponse({ posts: Object.values(collectedPosts[tabId] || {}) });
  }
  else if (msg.type === "CLEAR_POSTS") {
    // Side panel requesting to clear all collected data for a tab
    const tabId = msg.tabId;
    collectedPosts[tabId] = {};
    sendResponse({ ok: true });
  }
  else if (msg.type === "START_SCROLL" || msg.type === "STOP_SCROLL") {
    // Forward scroll commands from side panel to the content script in the active tab
    chrome.tabs.sendMessage(msg.tabId, msg).catch(() => {});
    sendResponse({ ok: true });
  }
  else if (msg.type === "SCROLL_STATUS") {
    // Forward scroll status from content script to side panel
    chrome.runtime.sendMessage(msg).catch(() => {});
  }

  return true; // Keep message channel open for async sendResponse
});

// Clean up stored data when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  delete collectedPosts[tabId];
});
