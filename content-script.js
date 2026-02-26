// Instagram Reels Analyzer — Content Script (ISOLATED World)
// Bridges MAIN world → background, handles auto-scroll.

(function() {
  'use strict';

  const CHANNEL = 'IG_REELS_ANALYZER';
  let scrolling = false;
  let scrollInterval = null;
  let noNewDataCount = 0;
  let lastPostCount = 0;

  console.log('[IG Analyzer CS] Content script loaded');

  // --- Bridge: MAIN world postMessage → background ---
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.channel !== CHANNEL) return;

    chrome.runtime.sendMessage(event.data).then(response => {
      if (response?.count) {
        lastPostCount = response.count;
      }
    }).catch(() => {});
  });

  // --- Commands from side panel ---
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log(`[IG Analyzer CS] Received command: ${msg.type}`);
    if (msg.type === 'START_SCROLL') {
      startScrolling();
      sendResponse({ ok: true });
    } else if (msg.type === 'STOP_SCROLL') {
      stopScrolling('stopped');
      sendResponse({ ok: true });
    }
    return true;
  });

  function startScrolling() {
    if (scrolling) return;
    scrolling = true;
    noNewDataCount = 0;
    lastPostCount = 0;

    let lastScrollHeight = 0;
    let sameHeightCount = 0;
    let scrollCount = 0;
    const MAX_SCROLLS = 300;

    console.log(`[IG Analyzer CS] Starting scroll on ${window.location.pathname}`);

    scrollInterval = setInterval(() => {
      if (!scrolling) return;

      scrollCount++;
      const currentHeight = document.documentElement.scrollHeight;

      // Check if page height changed (new content loaded)
      if (currentHeight === lastScrollHeight) {
        sameHeightCount++;
      } else {
        sameHeightCount = 0;
        lastScrollHeight = currentHeight;
      }

      // Auto-stop conditions
      if (sameHeightCount >= 4) {
        stopScrolling('complete');
        return;
      }
      if (scrollCount >= MAX_SCROLLS) {
        stopScrolling('complete');
        return;
      }

      window.scrollBy({ top: window.innerHeight * 2, behavior: 'smooth' });

      // Send progress every scroll
      chrome.runtime.sendMessage({
        type: 'SCROLL_STATUS',
        status: 'collecting',
        count: lastPostCount,
        scrollCount,
        noNewDataCount: sameHeightCount
      }).catch(() => {});

    }, 2000);

    chrome.runtime.sendMessage({
      type: 'SCROLL_STATUS',
      status: 'started',
      count: 0
    }).catch(() => {});
  }

  function stopScrolling(reason) {
    scrolling = false;
    if (scrollInterval) {
      clearInterval(scrollInterval);
      scrollInterval = null;
    }
    console.log(`[IG Analyzer CS] Stopped scrolling: ${reason}, collected ${lastPostCount} posts`);

    chrome.runtime.sendMessage({
      type: 'SCROLL_STATUS',
      status: reason,
      count: lastPostCount
    }).catch(() => {});
  }
})();
