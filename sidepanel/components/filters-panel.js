const FiltersPanel = (() => {
  const mount = document.getElementById('filters-panel-mount');
  let isOpen = false;

  function getActiveCount() {
    const f = Store.get('filters');
    let count = 0;
    if (f.type !== 'all') count++;
    if (f.minViews > 0) count++;
    if (f.maxViews < Infinity) count++;
    if (f.dateFrom) count++;
    if (f.dateTo) count++;
    if (f.search) count++;
    return count;
  }

  function render() {
    const f = Store.get('filters');
    const activeCount = getActiveCount();

    mount.innerHTML = `
      <div class="filters-panel">
        <div class="filters-panel__toggle" id="filters-toggle">
          <span>
            Filtros
            ${activeCount > 0 ? `<span class="filters-panel__active-count">${activeCount}</span>` : ''}
          </span>
          <span>${isOpen ? '&#9650;' : '&#9660;'}</span>
        </div>
        <div class="filters-panel__body ${isOpen ? 'filters-panel__body--open' : ''}">
          <div class="filters-panel__row">
            <span class="filters-panel__label">Tipo</span>
            <div class="filters-panel__type-btns">
              ${['all', 'reels', 'photos'].map(t => `
                <button class="filters-panel__type-btn ${f.type === t ? 'filters-panel__type-btn--active' : ''}"
                        data-type="${t}">
                  ${t === 'all' ? 'Todos' : t === 'reels' ? 'Reels' : 'Fotos'}
                </button>
              `).join('')}
            </div>
          </div>
          <div class="filters-panel__row">
            <span class="filters-panel__label">Views</span>
            <input type="number" class="filters-panel__input filters-panel__input--sm"
                   id="filter-min-views" placeholder="Min" value="${f.minViews || ''}">
            <span class="text-muted">a</span>
            <input type="number" class="filters-panel__input filters-panel__input--sm"
                   id="filter-max-views" placeholder="Max" value="${f.maxViews === Infinity ? '' : (f.maxViews || '')}">
          </div>
          <div class="filters-panel__row">
            <span class="filters-panel__label">Período</span>
            <input type="date" class="filters-panel__input" id="filter-date-from" value="${f.dateFrom || ''}">
            <span class="text-muted">a</span>
            <input type="date" class="filters-panel__input" id="filter-date-to" value="${f.dateTo || ''}">
          </div>
          <input type="text" class="filters-panel__search" id="filter-search"
                 placeholder="Buscar nas legendas..." value="${f.search || ''}">
          ${activeCount > 0 ? `
            <button class="btn btn--secondary btn--sm" id="filters-clear">Limpar filtros</button>
          ` : ''}
        </div>
      </div>
    `;

    // Events
    mount.querySelector('#filters-toggle').addEventListener('click', () => {
      isOpen = !isOpen;
      render();
    });

    mount.querySelectorAll('.filters-panel__type-btn').forEach(btn => {
      btn.addEventListener('click', () => Store.setFilter('type', btn.dataset.type));
    });

    const minViews = mount.querySelector('#filter-min-views');
    const maxViews = mount.querySelector('#filter-max-views');
    const dateFrom = mount.querySelector('#filter-date-from');
    const dateTo = mount.querySelector('#filter-date-to');
    const search = mount.querySelector('#filter-search');
    const clearBtn = mount.querySelector('#filters-clear');

    if (minViews) minViews.addEventListener('change', () => Store.setFilter('minViews', parseInt(minViews.value) || 0));
    if (maxViews) maxViews.addEventListener('change', () => Store.setFilter('maxViews', parseInt(maxViews.value) || Infinity));
    if (dateFrom) dateFrom.addEventListener('change', () => Store.setFilter('dateFrom', dateFrom.value || null));
    if (dateTo) dateTo.addEventListener('change', () => Store.setFilter('dateTo', dateTo.value || null));
    if (search) {
      let searchTimeout;
      search.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => Store.setFilter('search', search.value), 300);
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        Store.setFilter('type', 'all');
        Store.setFilter('minViews', 0);
        Store.setFilter('maxViews', Infinity);
        Store.setFilter('dateFrom', null);
        Store.setFilter('dateTo', null);
        Store.setFilter('search', '');
      });
    }
  }

  function init() {
    render();
    Store.on('filters', render);
  }

  return { init, render };
})();
