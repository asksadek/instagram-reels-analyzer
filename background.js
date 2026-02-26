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

// Navigate tab to reels page if needed, then start scroll
function startScrollOnTab(tabId) {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab || !tab.url) {
      console.error('[IG Analyzer BG] Cannot get tab', tabId);
      return;
    }

    try {
      const url = new URL(tab.url);
      const path = url.pathname;

      // Already on reels page — start scrolling directly
      if (path.match(/^\/[^/]+\/reels\/?$/)) {
        console.log(`[IG Analyzer BG] Already on reels, sending START_SCROLL to tab ${tabId}`);
        chrome.tabs.sendMessage(tabId, { type: 'START_SCROLL' }).catch(err => {
          console.error(`[IG Analyzer BG] Failed to send START_SCROLL:`, err);
        });
        return;
      }

      // On a profile page — navigate to reels first
      const profileMatch = path.match(/^\/([^/]+)/);
      if (profileMatch && !RESERVED_PATHS.has(profileMatch[1].toLowerCase())) {
        const username = profileMatch[1];
        const reelsUrl = `https://www.instagram.com/${username}/reels/`;
        console.log(`[IG Analyzer BG] Navigating tab ${tabId} to ${reelsUrl}`);
        pendingScrollTabs.add(tabId);
        chrome.tabs.update(tabId, { url: reelsUrl });
        // SCROLL_STATUS navigating
        chrome.runtime.sendMessage({
          type: 'SCROLL_STATUS',
          status: 'collecting',
          count: 0,
          message: 'Navegando para Reels...'
        }).catch(() => {});
        return;
      }

      // Fallback: just try to scroll wherever we are
      chrome.tabs.sendMessage(tabId, { type: 'START_SCROLL' }).catch(err => {
        console.error(`[IG Analyzer BG] Failed to send START_SCROLL:`, err);
      });
    } catch (e) {
      console.error('[IG Analyzer BG] Error in startScrollOnTab:', e);
    }
  });
}

// Wait for tab to finish loading after navigation, then start scroll
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (pendingScrollTabs.has(tabId) && changeInfo.status === 'complete') {
    pendingScrollTabs.delete(tabId);
    console.log(`[IG Analyzer BG] Tab ${tabId} loaded after nav, sending START_SCROLL in 1.5s`);
    // Delay to ensure content script is injected and ready
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, { type: 'START_SCROLL' }).catch(err => {
        console.error(`[IG Analyzer BG] Failed to send START_SCROLL after nav:`, err);
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
    pendingScrollTabs.delete(msg.tabId); // Cancel pending nav if any
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
