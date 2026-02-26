const Header = (() => {
  const mount = document.getElementById('header-mount');

  function render() {
    const state = Store.get();
    const posts = state.posts;
    const reels = posts.filter(p => p.isVideo).length;
    const photos = posts.length - reels;

    mount.innerHTML = `
      <div class="header">
        <div class="header__title">
          <span class="header__title-icon">&#9654;</span>
          IG Reels Analyzer
        </div>
        <div class="header__stats">
          <span>Total: <span class="header__stat-value">${posts.length}</span></span>
          <span>Reels: <span class="header__stat-value">${reels}</span></span>
          <span>Fotos: <span class="header__stat-value">${photos}</span></span>
        </div>
      </div>
    `;
  }

  function init() {
    render();
    Store.on('posts', render);
  }

  return { init, render };
})();
