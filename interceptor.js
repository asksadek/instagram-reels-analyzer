// Instagram Reels Analyzer — MAIN World Interceptor
// Intercepts ALL fetch/XHR to find Instagram media data.

(function() {
  'use strict';

  const CHANNEL = 'IG_REELS_ANALYZER';
  let totalSent = 0;

  function normalizePost(obj) {
    const shortcode = obj.shortcode || obj.code;
    const timestamp = obj.taken_at_timestamp || obj.taken_at;
    if (!shortcode || !timestamp) return null;

    return {
      shortcode,
      timestamp,
      views: obj.video_view_count || obj.play_count || obj.video_play_count || obj.view_count || 0,
      likes: obj.edge_media_preview_like?.count ?? obj.edge_liked_by?.count ?? obj.like_count ?? 0,
      comments: obj.edge_media_to_comment?.count ?? obj.edge_media_to_parent_comment?.count ?? obj.comment_count ?? 0,
      caption: obj.edge_media_to_caption?.edges?.[0]?.node?.text || obj.caption?.text || (typeof obj.caption === 'string' ? obj.caption : '') || '',
      thumbnail: obj.display_url || obj.thumbnail_url || obj.image_versions2?.candidates?.[0]?.url || '',
      isVideo: obj.is_video ?? (obj.media_type === 2) ?? false,
      type: obj.product_type || (obj.is_video ? 'clips' : (obj.media_type === 2 ? 'clips' : 'feed')),
      url: `https://www.instagram.com/p/${shortcode}/`
    };
  }

  function extractPosts(data) {
    const posts = [];
    const seen = new Set();

    function traverse(obj, depth) {
      if (!obj || typeof obj !== 'object' || depth > 20) return;

      const post = normalizePost(obj);
      if (post && !seen.has(post.shortcode)) {
        seen.add(post.shortcode);
        posts.push(post);
        return;
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
    console.log(`[IG Analyzer] ✓ ${posts.length} posts from ${source} (total: ${totalSent})`);
    window.postMessage({ channel: CHANNEL, type: 'POSTS_DATA', posts }, '*');
  }

  function tryParse(text, source) {
    try {
      const data = JSON.parse(text);
      const posts = extractPosts(data);
      if (posts.length > 0) {
        relay(posts, source);
      } else {
        // Log structure so we can see what Instagram returns
        const topKeys = Object.keys(data).join(',');
        const dataKeys = data.data ? Object.keys(data.data).join(',') : '-';
        // Find any arrays with objects that have 'code' or 'shortcode' or 'media'
        const sample = JSON.stringify(data).substring(0, 300);
        console.log(`[IG Analyzer] 0 posts | ${source} | top:[${topKeys}] data:[${dataKeys}] sample:${sample}`);
      }
    } catch(e) {}
  }

  // Helper: get URL string from any fetch input
  function getUrl(input) {
    if (typeof input === 'string') return input;
    if (input instanceof Request) return input.url;
    if (input?.url) return input.url;
    return '';
  }

  // --- Override fetch() ---
  const origFetch = window.fetch;
  window.fetch = async function(input, init) {
    const url = getUrl(input);
    const response = await origFetch.apply(this, arguments);

    try {
      // Log ALL instagram API calls for debugging
      if (url.includes('graphql') || url.includes('/api/') || url.includes('query')) {
        console.log(`[IG Analyzer] FETCH ${response.status} ${(init?.method || 'GET')} ${url.substring(0, 120)}`);
      }

      // Try to extract posts from ANY instagram API response
      if (url.includes('instagram.com') || url.startsWith('/')) {
        if (url.includes('graphql') || url.includes('/api/') || url.includes('query') || url.includes('feed') || url.includes('clips') || url.includes('reels') || url.includes('media') || url.includes('user')) {
          const clone = response.clone();
          clone.text().then(text => tryParse(text, url.substring(0, 80))).catch(() => {});
        }
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
    if (url && (url.includes('graphql') || url.includes('/api/') || url.includes('query') || url.includes('feed') || url.includes('clips') || url.includes('reels') || url.includes('media'))) {
      console.log(`[IG Analyzer] XHR ${this._igMethod} ${url.substring(0, 120)}`);
      this.addEventListener('load', function() {
        try { tryParse(this.responseText, url.substring(0, 80)); } catch(e) {}
      });
    }
    return origSend.apply(this, arguments);
  };

  console.log('[IG Analyzer] ✓ Interceptor active — monitoring all fetch/XHR');
})();
