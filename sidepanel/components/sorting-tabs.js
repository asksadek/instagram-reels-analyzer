const SortingTabs = (() => {
  const mount = document.getElementById('sorting-tabs-mount');
  const TABS = [
    { key: 'score', label: 'Score' },
    { key: 'views', label: 'Views' },
    { key: 'likes', label: 'Likes' },
    { key: 'comments', label: 'Comentários' },
    { key: 'date', label: 'Data' }
  ];

  function render() {
    const sortBy = Store.get('sortBy');
    const sortAsc = Store.get('sortAsc');

    mount.innerHTML = `
      <div class="sorting-tabs">
        ${TABS.map(tab => `
          <button class="sorting-tabs__tab ${tab.key === sortBy ? 'sorting-tabs__tab--active' : ''}"
                  data-sort="${tab.key}">
            ${tab.label}
            ${tab.key === sortBy ? `<span class="sorting-tabs__arrow">${sortAsc ? '&#9650;' : '&#9660;'}</span>` : ''}
          </button>
        `).join('')}
      </div>
    `;

    mount.querySelectorAll('.sorting-tabs__tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.sort;
        if (key === Store.get('sortBy')) {
          Store.set('sortAsc', !Store.get('sortAsc'));
        } else {
          Store.set('sortBy', key);
          Store.set('sortAsc', false);
        }
      });
    });
  }

  function init() {
    render();
    Store.on('sortBy', render);
    Store.on('sortAsc', render);
  }

  return { init, render };
})();
