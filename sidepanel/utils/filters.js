const Filters = (() => {
  function apply(posts, filters) {
    return posts.filter(post => {
      // Type filter
      if (filters.type === 'reels' && !post.isVideo) return false;
      if (filters.type === 'photos' && post.isVideo) return false;

      // View range
      if (filters.minViews && post.views < filters.minViews) return false;
      if (filters.maxViews && filters.maxViews !== Infinity && post.views > filters.maxViews) return false;

      // Date range
      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom).getTime() / 1000;
        if (post.timestamp < from) return false;
      }
      if (filters.dateTo) {
        const to = new Date(filters.dateTo).getTime() / 1000 + 86400;
        if (post.timestamp > to) return false;
      }

      // Search in caption
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!post.caption.toLowerCase().includes(q)) return false;
      }

      return true;
    });
  }

  return { apply };
})();
