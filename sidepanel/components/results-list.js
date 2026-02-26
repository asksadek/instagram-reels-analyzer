const ResultsList = (() => {
  const mount = document.getElementById('results-list-mount');
  let vs = null;

  function renderItem(post, index) {
    return PostCard.create(post, index + 1);
  }

  function update() {
    const posts = Store.getProcessed();

    if (posts.length === 0) {
      if (vs) {
        vs.destroy();
        vs = null;
      }
      mount.innerHTML = `
        <div class="results-list__empty">
          <div class="results-list__empty-icon">&#128270;</div>
          <div>Nenhum post encontrado</div>
          <div class="text-sm text-muted">
            ${Store.get('posts').length === 0
              ? 'Navegue até um perfil do Instagram e clique "Coletar"'
              : 'Tente ajustar os filtros'}
          </div>
        </div>
      `;
      return;
    }

    // Add count header
    const countEl = mount.querySelector('.results-list__count');
    if (!countEl) {
      const header = document.createElement('div');
      header.className = 'results-list__count';
      mount.prepend(header);
    }
    const countHeader = mount.querySelector('.results-list__count');
    countHeader.textContent = `Mostrando ${posts.length} de ${Store.get('posts').length} posts`;

    if (!vs) {
      // Clear empty state
      const empty = mount.querySelector('.results-list__empty');
      if (empty) empty.remove();

      // Create scroll container if needed
      let scrollContainer = mount.querySelector('.results-list__scroll');
      if (!scrollContainer) {
        scrollContainer = document.createElement('div');
        scrollContainer.className = 'results-list__scroll';
        scrollContainer.style.flex = '1';
        scrollContainer.style.overflow = 'auto';
        mount.appendChild(scrollContainer);
      }

      vs = VirtualScroll.create(scrollContainer, {
        itemHeight: 88,
        renderItem,
        overscan: 3
      });
    }

    vs.setItems(posts);
  }

  function init() {
    update();
    Store.on('posts', update);
    Store.on('sortBy', update);
    Store.on('sortAsc', update);
    Store.on('halfLifeDays', update);
    Store.on('filters', update);
  }

  return { init, update };
})();
