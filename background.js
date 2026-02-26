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

// Tabs pending scroll after navigation
const pendingScrollTabs = new Set();

// Reserved Instagram paths (not profile usernames)
const RESERVED_PATHS = new Set([
  'reels', 'explore', 'direct', 'stories', 'accounts', 'p', 'reel',
  'tv', 'about', 'legal', 'api', 'static', 'developer', 'graphql',
  'web', 'emails', 'challenge', 'oauth', 'session', 'nametag',
  'directory', 'lite', 'ar', 'topics', 'locations', ''
]);

// Smart merge: prefer non-zero numbers and non-empty strings
function mergePost(existing, incoming) {
  for (const [key, val] of Object.entries(incoming)) {
    if (key === 'shortcode') continue;
    // Don't overwrite good numbers with 0
    if (typeof val === 'number' && val === 0 && typeof existing[key] === 'number' && existing[key] > 0) continue;
    // Don't overwrite good strings with empty
    if (typeof val === 'string' && val === '' && typeof existing[key] === 'string' && existing[key] !== '') continue;
    existing[key] = val;
  }
}

// Navigate to reels tab and start scrolling
function startScrollOnTab(tabId) {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab || !tab.url) {
      console.error('[IG Analyzer BG] Cannot get tab', tabId);
      return;
    }

    try {
      const url = new URL(tab.url);
      const path = url.pathname;

      const profileMatch = path.match(/^\/([^/]+)/);
      if (!profileMatch || RESERVED_PATHS.has(profileMatch[1].toLowerCase())) {
        // Not on a profile page — just scroll wherever we are
        chrome.tabs.sendMessage(tabId, { type: 'START_SCROLL' }).catch(() => {});
        return;
      }

      const username = profileMatch[1];
      const isReelsPage = /^\/[^/]+\/reels\/?$/.test(path);

      // Notify sidepanel
      chrome.runtime.sendMessage({
        type: 'SCROLL_STATUS', status: 'collecting', count: 0
      }).catch(() => {});

      if (isReelsPage) {
        // Already on reels — start scrolling directly
        console.log(`[IG Analyzer BG] Already on reels, starting scroll...`);
        chrome.tabs.sendMessage(tabId, { type: 'START_SCROLL' }).catch(() => {});
      } else {
        // Navigate to reels page, then start scrolling when loaded
        console.log(`[IG Analyzer BG] Navigating to /${username}/reels/...`);
        pendingScrollTabs.add(tabId);
        chrome.tabs.update(tabId, { url: `https://www.instagram.com/${username}/reels/` });
      }
    } catch (e) {
      console.error('[IG Analyzer BG] Error in startScrollOnTab:', e);
    }
  });
}

// Handle navigation completions
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== 'complete') return;

  // Reels page loaded → start scrolling
  if (pendingScrollTabs.has(tabId)) {
    pendingScrollTabs.delete(tabId);
    console.log(`[IG Analyzer BG] Reels loaded, starting scroll in 1.5s...`);
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, { type: 'START_SCROLL' }).catch(err => {
        console.error(`[IG Analyzer BG] Failed to send START_SCROLL:`, err);
      });
    }, 1500);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab?.id || msg.tabId;

  if (msg.type === "POSTS_DATA") {
    if (!tabId) { sendResponse({ ok: false }); return true; }

    if (!collectedPosts[tabId]) collectedPosts[tabId] = {};

    let added = 0;
    let updated = 0;
    for (const post of (msg.posts || [])) {
      if (!post.shortcode) continue;
      if (!collectedPosts[tabId][post.shortcode]) {
        collectedPosts[tabId][post.shortcode] = post;
        added++;
      } else {
        mergePost(collectedPosts[tabId][post.shortcode], post);
        updated++;
      }
    }

    const totalCount = Object.keys(collectedPosts[tabId]).length;
    console.log(`[IG Analyzer BG] +${added} new, ~${updated} updated (total: ${totalCount}) from tab ${tabId}`);

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
  else if (msg.type === "START_SCROLL") {
    console.log(`[IG Analyzer BG] START_SCROLL requested for tab ${msg.tabId}`);
    startScrollOnTab(msg.tabId);
    sendResponse({ ok: true });
  }
  else if (msg.type === "STOP_SCROLL") {
    console.log(`[IG Analyzer BG] Forwarding STOP_SCROLL to tab ${msg.tabId}`);
    pendingScrollTabs.delete(msg.tabId);
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
  pendingScrollTabs.delete(tabId);
});
