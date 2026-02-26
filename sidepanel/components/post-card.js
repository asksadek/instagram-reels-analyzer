// PostCard renders a single post card DOM element
const PostCard = (() => {
  function create(post, rank) {
    const el = document.createElement('div');
    el.className = 'post-card';
    el.dataset.shortcode = post.shortcode;

    const caption = (post.caption || '').slice(0, 100) || 'Sem legenda';
    const typeClass = post.isVideo ? 'post-card__type--reel' : '';
    const typeLabel = post.isVideo ? (post.type === 'clips' ? 'REEL' : 'VIDEO') : 'FOTO';
    const erPercent = ((post.engagementRate || 0) * 100);
    const erClass = erPercent > 5 ? 'post-card__er--high' : erPercent > 2 ? 'post-card__er--mid' : 'post-card__er--low';

    el.innerHTML = `
      <span class="post-card__rank">#${rank}</span>
      ${post.thumbnail
        ? `<img class="post-card__thumb" src="${post.thumbnail}" alt="" loading="lazy">`
        : `<div class="post-card__thumb post-card__thumb--placeholder">&#9654;</div>`
      }
      <div class="post-card__info">
        <div class="post-card__caption">${escapeHtml(caption)}</div>
        <div class="post-card__metrics">
          <span class="post-card__metric">
            <span class="post-card__metric-icon">&#9654;</span>
            ${Format.compact(post.views)}
          </span>
          <span class="post-card__metric">
            <span class="post-card__metric-icon">&#9829;</span>
            ${Format.compact(post.likes)}
          </span>
          <span class="post-card__metric">
            <span class="post-card__metric-icon">&#128172;</span>
            ${Format.compact(post.comments)}
          </span>
          <span class="post-card__metric ${erClass}">
            Engaj. ${erPercent.toFixed(1)}%
          </span>
        </div>
        <div class="post-card__meta">
          <span class="post-card__type ${typeClass}">${typeLabel}</span>
          <span>${Format.ago(post.timestamp)}</span>
        </div>
      </div>
      <div class="post-card__score">${Format.compact(post.score || 0)}</div>
    `;

    // Handle thumbnail load errors without inline handler (CSP compliance)
    const img = el.querySelector('.post-card__thumb');
    if (img && img.tagName === 'IMG') {
      img.addEventListener('error', () => {
        img.src = '';
        img.style.background = 'var(--bg-tertiary)';
      });
    }

    el.addEventListener('click', () => {
      window.open(post.url, '_blank');
    });

    return el;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { create };
})();
