// Bootstrap: initialize all components, connect to background
(async function() {
  'use strict';

  // 1. Get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    Store.set('activeTabId', tab.id);
  }

  // 2. Load existing posts from background
  if (tab) {
    chrome.runtime.sendMessage({ type: 'GET_POSTS', tabId: tab.id }, (response) => {
      if (response?.posts?.length) {
        Store.addPosts(response.posts);
      }
    });
  }

  // 3. Listen for updates from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'POSTS_UPDATE') {
      const added = Store.addPosts(msg.posts);
      if (added > 0) {
        Store.set('collectedCount', Store.get('posts').length);
      }
    }
    else if (msg.type === 'SCROLL_STATUS') {
      Store.set('scrollStatus', msg.status);
      Store.set('collectedCount', msg.count || Store.get('collectedCount'));
    }
  });

  // 4. Initialize all components
  Header.init();
  CollectionControls.init();
  SortingTabs.init();
  HalflifeSlider.init();
  FiltersPanel.init();
  ResultsList.init();
  ExportBar.init();
  TrendDetector.init();
  PerformanceChart.init();

  // 5. Advanced tabs switching
  const advancedTabs = document.getElementById('advanced-tabs');
  const trendMount = document.getElementById('trend-detector-mount');
  const chartMount = document.getElementById('performance-chart-mount');
  let activePanel = 'none';

  function updateAdvancedTabs() {
    advancedTabs.querySelectorAll('.advanced-tabs__tab').forEach(tab => {
      const panel = tab.dataset.panel;
      tab.classList.toggle('advanced-tabs__tab--active', panel === activePanel);
    });

    trendMount.style.display = activePanel === 'trends' ? 'block' : 'none';
    chartMount.style.display = activePanel === 'chart' ? 'block' : 'none';

    // Re-render when showing
    if (activePanel === 'trends') TrendDetector.render();
    if (activePanel === 'chart') PerformanceChart.render();
  }

  advancedTabs.querySelectorAll('.advanced-tabs__tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const panel = tab.dataset.panel;
      activePanel = (activePanel === panel) ? 'none' : panel;
      updateAdvancedTabs();
    });
  });

  // Initial state: hide advanced panels
  updateAdvancedTabs();

  // 6. Tab change detection
  chrome.tabs.onActivated?.addListener(async (activeInfo) => {
    Store.set('activeTabId', activeInfo.tabId);
    chrome.runtime.sendMessage({ type: 'GET_POSTS', tabId: activeInfo.tabId }, (response) => {
      Store.clearPosts();
      if (response?.posts?.length) {
        Store.addPosts(response.posts);
      }
    });
  });

  console.log('[IG Reels Analyzer] Side panel initialized');
})();
