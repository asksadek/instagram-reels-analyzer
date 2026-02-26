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

    console.log(`[IG Analyzer CS] Received ${event.data.type} with ${event.data.posts?.length || 0} posts from interceptor`);

    chrome.runtime.sendMessage(event.data).then(response => {
      console.log(`[IG Analyzer CS] Background response:`, response);

      if (response) {
        const currentCount = response.count || 0;

        // Always update scroll status if we're scrolling
        if (scrolling) {
          if (currentCount === lastPostCount) {
            noNewDataCount++;
          } else {
            noNewDataCount = 0;
            lastPostCount = currentCount;
          }

          chrome.runtime.sendMessage({
            type: 'SCROLL_STATUS',
            status: 'collecting',
            count: currentCount,
            noNewDataCount
          }).catch(() => {});

          if (noNewDataCount >= 8) {
            stopScrolling('complete');
          }
        }
      }
    }).catch(err => {
      console.error('[IG Analyzer CS] Error sending to background:', err);
    });
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

    console.log('[IG Analyzer CS] Starting scroll on', window.location.pathname);

    // Navigate to profile's Reels tab if on profile root
    const profileMatch = window.location.pathname.match(/^\/([^/]+)\/?$/);
    if (profileMatch) {
      const username = profileMatch[1];
      const reelsTab = document.querySelector(`a[href="/${username}/reels/"]`);
      if (reelsTab) {
        console.log(`[IG Analyzer CS] Clicking reels tab for ${username}`);
        reelsTab.click();
      }
    }

    scrollInterval = setInterval(() => {
      if (!scrolling) return;
      window.scrollBy({ top: window.innerHeight * 2, behavior: 'smooth' });
    }, 1500);

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
