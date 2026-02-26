// Centralized state with pub-sub and computed caching
const Store = (() => {
  const state = {
    posts: [],           // raw collected posts
    halfLifeDays: 30,    // default half-life
    sortBy: 'score',     // 'score' | 'views' | 'likes' | 'date' | 'comments'
    sortAsc: false,
    filters: {
      type: 'all',       // 'all' | 'reels' | 'photos'
      minViews: 0,
      maxViews: Infinity,
      dateFrom: null,
      dateTo: null,
      search: ''
    },
    scrollStatus: 'idle', // 'idle' | 'started' | 'collecting' | 'complete' | 'stopped'
    collectedCount: 0,
    activeTabId: null
  };

  const listeners = new Map(); // event -> Set<fn>
  let _cache = {};

  function on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event).delete(fn);
  }

  function emit(event, data) {
    _cache = {}; // invalidate computed cache
    if (listeners.has(event)) {
      listeners.get(event).forEach(fn => fn(data));
    }
    if (event !== '*' && listeners.has('*')) {
      listeners.get('*').forEach(fn => fn(event, data));
    }
  }

  function set(key, value) {
    if (state[key] === value) return;
    state[key] = value;
    emit(key, value);
    emit('*', key);
  }

  function setFilter(key, value) {
    state.filters[key] = value;
    emit('filters', state.filters);
    emit('*', 'filters');
    _cache = {};
  }

  function get(key) {
    return key ? state[key] : { ...state };
  }

  function getProcessed() {
    const cacheKey = JSON.stringify({
      postCount: state.posts.length,
      halfLife: state.halfLifeDays,
      sort: state.sortBy,
      asc: state.sortAsc,
      filters: state.filters
    });

    if (_cache.processed && _cache.processedKey === cacheKey) {
      return _cache.processed;
    }

    // Import scoring and filters dynamically — they'll be loaded by then
    const scored = state.posts.map(p => ({
      ...p,
      score: Scoring.calculate(p.views, p.timestamp, state.halfLifeDays)
    }));

    const filtered = Filters.apply(scored, state.filters);

    const sortKey = state.sortBy === 'date' ? 'timestamp' : state.sortBy;
    filtered.sort((a, b) => {
      const va = a[sortKey] ?? 0;
      const vb = b[sortKey] ?? 0;
      return state.sortAsc ? va - vb : vb - va;
    });

    _cache.processed = filtered;
    _cache.processedKey = cacheKey;
    return filtered;
  }

  function addPosts(newPosts) {
    const existing = new Map(state.posts.map(p => [p.shortcode, p]));
    let added = 0;
    for (const p of newPosts) {
      if (!existing.has(p.shortcode)) {
        existing.set(p.shortcode, p);
        added++;
      }
    }
    if (added > 0) {
      state.posts = Array.from(existing.values());
      _cache = {};
      emit('posts', state.posts);
      emit('*', 'posts');
    }
    return added;
  }

  function clearPosts() {
    state.posts = [];
    _cache = {};
    emit('posts', state.posts);
    emit('*', 'posts');
  }

  return { on, emit, set, setFilter, get, getProcessed, addPosts, clearPosts, state };
})();
