const TrendDetector = (() => {
  const mount = document.getElementById('trend-detector-mount');

  function render() {
    const posts = Store.getProcessed();
    if (posts.length < 5) {
      mount.innerHTML = `
        <div class="trend-detector">
          <div class="trend-detector__title">Tendências</div>
          <div class="text-sm text-muted">Colete pelo menos 5 posts para ver tendências</div>
        </div>
      `;
      return;
    }

    const analysis = Trends.analyze(posts, 15);
    const maxKeywordScore = analysis.keywords[0]?.avgScore || 1;
    const maxHashtagScore = analysis.hashtags[0]?.avgScore || 1;

    mount.innerHTML = `
      <div class="trend-detector">
        <div class="trend-detector__title">Tendências</div>

        ${analysis.keywords.length > 0 ? `
          <div class="trend-detector__section">
            <div class="trend-detector__section-title">Palavras-chave</div>
            <div class="trend-detector__tags">
              ${analysis.keywords.map(k => `
                <div class="trend-detector__tag" data-search="${k.term}" title="Score médio: ${Format.compact(k.avgScore)}">
                  ${k.term}
                  <span class="trend-detector__tag-count">${k.count}x</span>
                  <div class="trend-detector__bar" style="width:40px">
                    <div class="trend-detector__bar-fill" style="width:${(k.avgScore / maxKeywordScore * 100).toFixed(0)}%"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${analysis.hashtags.length > 0 ? `
          <div class="trend-detector__section">
            <div class="trend-detector__section-title">Hashtags</div>
            <div class="trend-detector__tags">
              ${analysis.hashtags.map(h => `
                <div class="trend-detector__tag" data-search="${h.term}" title="Score médio: ${Format.compact(h.avgScore)}">
                  ${h.term}
                  <span class="trend-detector__tag-count">${h.count}x</span>
                  <div class="trend-detector__bar" style="width:40px">
                    <div class="trend-detector__bar-fill" style="width:${(h.avgScore / maxHashtagScore * 100).toFixed(0)}%"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    // Click tag to filter
    mount.querySelectorAll('.trend-detector__tag').forEach(tag => {
      tag.addEventListener('click', () => {
        Store.setFilter('search', tag.dataset.search);
      });
    });
  }

  function init() {
    render();
    Store.on('posts', render);
    Store.on('halfLifeDays', render);
    Store.on('filters', render);
  }

  return { init, render };
})();
