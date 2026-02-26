const ExportBar = (() => {
  const mount = document.getElementById('export-bar-mount');

  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('toast--visible');
    });

    setTimeout(() => {
      toast.classList.remove('toast--visible');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  function render() {
    const posts = Store.getProcessed();
    const disabled = posts.length === 0;

    mount.innerHTML = `
      <div class="export-bar">
        <button class="btn btn--secondary btn--sm" id="export-csv" ${disabled ? 'disabled' : ''}>
          CSV
        </button>
        <button class="btn btn--secondary btn--sm" id="export-json" ${disabled ? 'disabled' : ''}>
          JSON
        </button>
        <button class="btn btn--secondary btn--sm" id="export-clipboard" ${disabled ? 'disabled' : ''}>
          Copiar
        </button>
      </div>
    `;

    mount.querySelector('#export-csv')?.addEventListener('click', () => {
      Export.downloadCSV(posts);
      showToast('CSV exportado!');
    });

    mount.querySelector('#export-json')?.addEventListener('click', () => {
      Export.downloadJSON(posts);
      showToast('JSON exportado!');
    });

    mount.querySelector('#export-clipboard')?.addEventListener('click', async () => {
      try {
        await Export.copyToClipboard(posts);
        showToast('Copiado!');
      } catch {
        showToast('Erro ao copiar', 'error');
      }
    });
  }

  function init() {
    render();
    Store.on('posts', render);
    Store.on('filters', render);
  }

  return { init, render };
})();
