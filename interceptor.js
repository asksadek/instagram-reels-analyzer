// Instagram Reels Analyzer — MAIN World Interceptor

(function() {
  'use strict';

  const CHANNEL = 'IG_REELS_ANALYZER';
  let totalSent = 0;

  /**
   * Try to get a timestamp from any possible Instagram field name.
   */
  function getTimestamp(obj) {
    // Direct fields
    if (obj.taken_at_timestamp) return obj.taken_at_timestamp;
    if (obj.taken_at) return obj.taken_at;
    if (obj.device_timestamp) return Math.floor(obj.device_timestamp / (obj.device_timestamp > 1e12 ? 1000 : 1));
    if (obj.creation_time) return obj.creation_time;
    // Caption timestamp
    if (obj.caption?.created_at) return obj.caption.created_at;
    if (obj.caption?.created_at_utc) return obj.caption.created_at_utc;
    return 0;
  }

  function normalizePost(obj) {
    const shortcode = obj.shortcode || obj.code;
    if (!shortcode) return null;

    const timestamp = getTimestamp(obj);

    return {
      shortcode,
      timestamp: timestamp || Math.floor(Date.now() / 1000), // fallback to now
      views: obj.video_view_count || obj.play_count || obj.video_play_count || obj.view_count || 0,
      likes: obj.edge_media_preview_like?.count ?? obj.edge_liked_by?.count ?? obj.like_count ?? 0,
      comments: obj.edge_media_to_comment?.count ?? obj.edge_media_to_parent_comment?.count ?? obj.comment_count ?? 0,
      caption: obj.edge_media_to_caption?.edges?.[0]?.node?.text || obj.caption?.text || (typeof obj.caption === 'string' ? obj.caption : '') || '',
      thumbnail: obj.display_url || obj.thumbnail_url || obj.image_versions2?.candidates?.[0]?.url || obj.carousel_media?.[0]?.image_versions2?.candidates?.[0]?.url || '',
      isVideo: obj.is_video ?? (obj.media_type === 2) ?? (obj.product_type === 'clips') ?? false,
      type: obj.product_type || (obj.is_video ? 'clips' : (obj.media_type === 2 ? 'clips' : 'feed')),
      url: `https://www.instagram.com/reel/${shortcode}/`,
      _hasTimestamp: timestamp > 0,
      _keys: Object.keys(obj).slice(0, 20).join(',') // debug: show available keys
    };
  }

  function extractPosts(data) {
    const posts = [];
    const seen = new Set();

    function traverse(obj, depth) {
      if (!obj || typeof obj !== 'object' || depth > 25) return;

      const post = normalizePost(obj);
      if (post && !seen.has(post.shortcode)) {
        seen.add(post.shortcode);
        posts.push(post);
        // DON'T return — keep traversing children in case there are nested media
      }

      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) traverse(obj[i], depth + 1);
      } else {
        for (const k of Object.keys(obj)) {
          if (k === '__typename' || k === 'logging_page_id') continue;
          traverse(obj[k], depth + 1);
        }
      }
    }

    traverse(data, 0);
    return posts;
  }

  function relay(posts, source) {
    if (posts.length === 0) return;
    totalSent += posts.length;
    // Log first post keys for debugging
    const sample = posts[0];
    console.log(`[IG Analyzer] ✓ ${posts.length} posts from ${source} (total: ${totalSent}) | hasTimestamp=${sample._hasTimestamp} views=${sample.views} keys=${sample._keys}`);
    window.postMessage({ channel: CHANNEL, type: 'POSTS_DATA', posts }, '*');
  }

  function tryParse(text, source) {
    try {
      const data = JSON.parse(text);
      const posts = extractPosts(data);
      if (posts.length > 0) {
        relay(posts, source);
      }
    } catch(e) {}
  }

  function getUrl(input) {
    if (typeof input === 'string') return input;
    if (input instanceof Request) return input.url;
    if (input?.url) return input.url;
    return '';
  }

  // Check if URL is worth intercepting
  function shouldIntercept(url) {
    if (!url) return false;
    return url.includes('graphql') || url.includes('/api/') || url.includes('query') ||
           url.includes('feed') || url.includes('clips') || url.includes('reels') ||
           url.includes('media') || url.includes('user');
  }

  // --- Override fetch() ---
  const origFetch = window.fetch;
  window.fetch = async function(input, init) {
    const url = getUrl(input);
    const response = await origFetch.apply(this, arguments);
    try {
      if (shouldIntercept(url)) {
        const clone = response.clone();
        clone.text().then(text => tryParse(text, 'fetch:' + url.substring(0, 60))).catch(() => {});
      }
    } catch(e) {}
    return response;
  };

  // --- Override XMLHttpRequest ---
  const XHR = XMLHttpRequest.prototype;
  const origOpen = XHR.open;
  const origSend = XHR.send;

  XHR.open = function(method, url) {
    this._igUrl = typeof url === 'string' ? url : '';
    this._igMethod = method;
    return origOpen.apply(this, arguments);
  };

  XHR.send = function() {
    const url = this._igUrl;
    if (shouldIntercept(url)) {
      this.addEventListener('load', function() {
        try { tryParse(this.responseText, 'xhr:' + url.substring(0, 60)); } catch(e) {}
      });
    }
    return origSend.apply(this, arguments);
  };

  console.log('[IG Analyzer] ✓ Interceptor v3 active');
})();
