// Virtual scrolling for large lists
const VirtualScroll = (() => {
  function create(container, { itemHeight = 120, renderItem, overscan = 5 }) {
    let items = [];
    let scrollTop = 0;
    let containerHeight = 0;
    let raf = null;

    // Create inner spacer
    const spacer = document.createElement('div');
    spacer.className = 'vs-spacer';
    spacer.style.position = 'relative';
    container.appendChild(spacer);

    // Pool of rendered DOM elements
    const pool = [];

    function getTotalHeight() {
      return items.length * itemHeight;
    }

    function getVisibleRange() {
      const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
      const visibleCount = Math.ceil(containerHeight / itemHeight) + overscan * 2;
      const end = Math.min(items.length, start + visibleCount);
      return { start, end };
    }

    function render() {
      raf = null;
      const totalHeight = getTotalHeight();
      spacer.style.height = totalHeight + 'px';

      const { start, end } = getVisibleRange();

      // Clear existing items
      while (pool.length > 0) {
        const el = pool.pop();
        el.remove();
      }

      // Render visible items
      for (let i = start; i < end; i++) {
        const el = renderItem(items[i], i);
        el.style.position = 'absolute';
        el.style.top = (i * itemHeight) + 'px';
        el.style.left = '0';
        el.style.right = '0';
        spacer.appendChild(el);
        pool.push(el);
      }
    }

    function scheduleRender() {
      if (raf) return;
      raf = requestAnimationFrame(render);
    }

    function onScroll() {
      scrollTop = container.scrollTop;
      scheduleRender();
    }

    function setItems(newItems) {
      items = newItems;
      scheduleRender();
    }

    function updateContainerHeight() {
      containerHeight = container.clientHeight;
      scheduleRender();
    }

    // Setup
    container.style.overflow = 'auto';
    container.addEventListener('scroll', onScroll, { passive: true });

    // ResizeObserver for dynamic container sizing
    const ro = new ResizeObserver(() => updateContainerHeight());
    ro.observe(container);

    updateContainerHeight();

    function destroy() {
      container.removeEventListener('scroll', onScroll);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      spacer.remove();
    }

    return { setItems, render: scheduleRender, destroy };
  }

  return { create };
})();
