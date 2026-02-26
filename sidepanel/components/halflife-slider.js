const HalflifeSlider = (() => {
  const mount = document.getElementById('halflife-slider-mount');
  const PRESETS = [7, 14, 30, 60, 90, 180, 365];
  let rafId = null;

  function render() {
    const value = Store.get('halfLifeDays');

    mount.innerHTML = `
      <div class="halflife-slider">
        <div class="halflife-slider__label">
          <span>Meia-vida do score</span>
          <span class="halflife-slider__value" id="hl-display">${value} dias</span>
        </div>
        <input type="range" class="halflife-slider__input" id="hl-input"
               min="1" max="365" value="${value}" step="1">
        <div class="halflife-slider__presets">
          ${PRESETS.map(p => `
            <button class="halflife-slider__preset ${p === value ? 'halflife-slider__preset--active' : ''}"
                    data-value="${p}">${p}d</button>
          `).join('')}
        </div>
      </div>
    `;

    const input = mount.querySelector('#hl-input');
    const display = mount.querySelector('#hl-display');

    input.addEventListener('input', (e) => {
      const v = parseInt(e.target.value);
      display.textContent = `${v} dias`;

      // Debounce store update with rAF
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        Store.set('halfLifeDays', v);
        rafId = null;
      });
    });

    mount.querySelectorAll('.halflife-slider__preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = parseInt(btn.dataset.value);
        input.value = v;
        display.textContent = `${v} dias`;
        Store.set('halfLifeDays', v);
      });
    });
  }

  function init() {
    render();
    // Don't re-render on halfLifeDays change (we control it)
  }

  return { init, render };
})();
