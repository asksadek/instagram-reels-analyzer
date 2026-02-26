const CollectionControls = (() => {
  const mount = document.getElementById('collection-controls-mount');

  function render() {
    const status = Store.get('scrollStatus');
    const count = Store.get('collectedCount');
    const isCollecting = status === 'started' || status === 'collecting';

    mount.innerHTML = `
      <div class="collection-controls">
        ${isCollecting ? `
          <button class="btn btn--danger" id="btn-stop">
            &#9632; Parar
          </button>
        ` : `
          <button class="btn btn--primary" id="btn-collect">
            &#9654; Coletar
          </button>
        `}
        <button class="btn btn--secondary" id="btn-clear" ${Store.get('posts').length === 0 ? 'disabled' : ''}>
          Limpar
        </button>
        <div class="collection-status">
          ${isCollecting ? `
            <span class="collection-status__dot collection-status__dot--active"></span>
            Coletando... ${count}
          ` : status === 'complete' ? `
            Coleta completa
          ` : status === 'stopped' ? `
            Parada
          ` : ''}
        </div>
      </div>
    `;

    // Event listeners
    const btnCollect = mount.querySelector('#btn-collect');
    const btnStop = mount.querySelector('#btn-stop');
    const btnClear = mount.querySelector('#btn-clear');

    if (btnCollect) {
      btnCollect.addEventListener('click', () => {
        const tabId = Store.get('activeTabId');
        if (!tabId) return;
        chrome.runtime.sendMessage({ type: 'START_SCROLL', tabId });
        Store.set('scrollStatus', 'started');
      });
    }

    if (btnStop) {
      btnStop.addEventListener('click', () => {
        const tabId = Store.get('activeTabId');
        if (!tabId) return;
        chrome.runtime.sendMessage({ type: 'STOP_SCROLL', tabId });
        Store.set('scrollStatus', 'stopped');
      });
    }

    if (btnClear) {
      btnClear.addEventListener('click', () => {
        const tabId = Store.get('activeTabId');
        if (!tabId) return;
        chrome.runtime.sendMessage({ type: 'CLEAR_POSTS', tabId });
        Store.clearPosts();
        Store.set('scrollStatus', 'idle');
        Store.set('collectedCount', 0);
      });
    }
  }

  function init() {
    render();
    Store.on('scrollStatus', render);
    Store.on('collectedCount', render);
    Store.on('posts', render);
  }

  return { init, render };
})();
