// Instagram Reels Analyzer — MAIN World Interceptor
// Intercepts fetch() and XHR to capture Instagram API responses.
// Supports both GraphQL (/api/graphql, /graphql/query) and REST v1 (/api/v1/) endpoints.

(function() {
  'use strict';

  const CHANNEL = 'IG_REELS_ANALYZER';
  let totalSent = 0;

  /**
   * Normalize a media node from any Instagram API format into a unified post object.
   * Handles GraphQL (edge_*, taken_at_timestamp, shortcode) and REST v1 (code, taken_at, like_count).
   */
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
      isVideo: obj.is_video ?? (obj.media_type === 2) ?? (obj.product_type === 'clips'),
      type: obj.product_type || (obj.is_video ? 'clips' : (obj.media_type === 2 ? 'clips' : 'feed')),
      url: `https://www.instagram.com/p/${shortcode}/`
    };
  }

  /**
   * Recursively extract all post/media nodes from any JSON structure.
   */
  function extractPosts(data) {
    const posts = [];
    const seen = new Set();

    function traverse(obj, depth) {
      if (!obj || typeof obj !== 'object' || depth > 15) return;

      // Try to normalize this object as a post
      const post = normalizePost(obj);
      if (post && !seen.has(post.shortcode)) {
        seen.add(post.shortcode);
        posts.push(post);
        return; // Don't go deeper into this node
      }

      // Recurse
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          traverse(obj[i], depth + 1);
        }
      } else {
        const keys = Object.keys(obj);
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          if (k === '__typename' || k === 'logging_page_id') continue;
          traverse(obj[k], depth + 1);
        }
      }
    }

    traverse(data, 0);
    return posts;
  }

  /**
   * Check if a URL is an Instagram API endpoint worth intercepting.
   */
  function isIgApi(url) {
    if (!url) return false;
    return url.includes('/api/graphql') ||
           url.includes('/graphql/query') ||
           url.includes('/api/v1/') ||
           url.includes('__a=1');
  }

  /**
   * Process intercepted response data — extract posts and relay to content script.
   */
  function processResponse(url, text) {
    try {
      const data = JSON.parse(text);
      const posts = extractPosts(data);
      if (posts.length > 0) {
        totalSent += posts.length;
        console.log(`[IG Reels Analyzer] Intercepted ${posts.length} posts from ${url.substring(0, 80)}... (total: ${totalSent})`);
        window.postMessage({ channel: CHANNEL, type: 'POSTS_DATA', posts }, '*');
      }
    } catch(e) {
      // Not JSON or parse error — ignore silently
    }
  }

  // --- Override fetch() ---
  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await origFetch.apply(this, args);

    try {
      const req = args[0];
      const url = typeof req === 'string' ? req : (req?.url || '');
      if (isIgApi(url)) {
        const clone = response.clone();
        clone.text().then(text => processResponse(url, text)).catch(() => {});
      }
    } catch(e) {}

    return response;
  };

  // --- Override XMLHttpRequest ---
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._igUrl = typeof url === 'string' ? url : '';
    return origOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    if (this._igUrl && isIgApi(this._igUrl)) {
      const capturedUrl = this._igUrl;
      this.addEventListener('load', function() {
        try {
          processResponse(capturedUrl, this.responseText);
        } catch(e) {}
      });
    }
    return origSend.apply(this, args);
  };

  console.log('[IG Reels Analyzer] Interceptor active — monitoring /api/graphql, /graphql/query, /api/v1/');
})();
