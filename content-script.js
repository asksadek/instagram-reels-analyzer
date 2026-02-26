// Instagram Reels Analyzer — Content Script (ISOLATED World)
// Bridges messages from the MAIN world interceptor (via postMessage)
// to the background service worker (via chrome.runtime.sendMessage).
// Also handles auto-scroll functionality for collecting post data.

(function() {
  'use strict';

  const CHANNEL = 'IG_REELS_ANALYZER';
  let scrolling = false;
  let scrollInterval = null;
  let noNewDataCount = 0;
  let lastPostCount = 0;

  // --- Bridge: MAIN world postMessage → chrome.runtime background ---
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.channel !== CHANNEL) return;

    chrome.runtime.sendMessage(event.data).then(response => {
      if (response && scrolling) {
        const currentCount = response.count || 0;

        if (currentCount === lastPostCount) {
          noNewDataCount++;
        } else {
          noNewDataCount = 0;
          lastPostCount = currentCount;
        }

        // Send scroll progress update to side panel via background
        chrome.runtime.sendMessage({
          type: 'SCROLL_STATUS',
          status: 'collecting',
          count: currentCount,
          noNewDataCount
        }).catch(() => {});

        // Auto-stop if no new data for 5 consecutive scroll cycles
        if (noNewDataCount >= 5) {
          stopScrolling('complete');
        }
      }
    }).catch(() => {});
  });

  // --- Listen for commands from background (forwarded from side panel) ---
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'START_SCROLL') {
      startScrolling();
      sendResponse({ ok: true });
    } else if (msg.type === 'STOP_SCROLL') {
      stopScrolling('stopped');
      sendResponse({ ok: true });
    }
    return true;
  });

  /**
   * Starts the auto-scroll process.
   * Optionally navigates to the Reels tab if available and not already there.
   * Scrolls the page every 1.5 seconds to trigger Instagram to load more content.
   */
  function startScrolling() {
    if (scrolling) return;
    scrolling = true;
    noNewDataCount = 0;
    lastPostCount = 0;

    // Navigate to the profile's Reels tab if we're on a profile page
    // Match only profile-specific reels links like /username/reels/
    const profileMatch = window.location.pathname.match(/^\/([^/]+)\/?$/);
    if (profileMatch) {
      const username = profileMatch[1];
      const reelsTab = document.querySelector(`a[href="/${username}/reels/"]`);
      if (reelsTab) {
        reelsTab.click();
      }
    }

    // Scroll down by 2x viewport height every 1.5 seconds
    scrollInterval = setInterval(() => {
      if (!scrolling) return;
      window.scrollBy({ top: window.innerHeight * 2, behavior: 'smooth' });
    }, 1500);

    // Notify side panel that scrolling has started
    chrome.runtime.sendMessage({
      type: 'SCROLL_STATUS',
      status: 'started',
      count: 0
    }).catch(() => {});
  }

  /**
   * Stops the auto-scroll process.
   * @param {string} reason - 'complete' if auto-stopped, 'stopped' if manual
   */
  function stopScrolling(reason) {
    scrolling = false;
    if (scrollInterval) {
      clearInterval(scrollInterval);
      scrollInterval = null;
    }

    // Notify side panel that scrolling has stopped
    chrome.runtime.sendMessage({
      type: 'SCROLL_STATUS',
      status: reason,
      count: lastPostCount
    }).catch(() => {});
  }
})();
