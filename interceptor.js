// Instagram Reels Analyzer — MAIN World Interceptor
// Runs in the page's MAIN world to intercept fetch() and XHR responses
// containing Instagram GraphQL/API data, extracts post metadata,
// and relays it via postMessage to the content script bridge.

(function() {
  'use strict';

  const CHANNEL = 'IG_REELS_ANALYZER';

  /**
   * Recursively traverses a JSON response object looking for media nodes.
   * A media node is identified by having a shortcode and a timestamp field.
   * Returns an array of normalized post objects.
   */
  function extractPosts(data) {
    const posts = [];

    function traverse(obj) {
      if (!obj || typeof obj !== 'object') return;

      // Check if this object looks like an Instagram media node
      if (obj.shortcode && (obj.taken_at_timestamp || obj.taken_at)) {
        const post = {
          shortcode: obj.shortcode,
          timestamp: obj.taken_at_timestamp || obj.taken_at,
          views: obj.video_view_count || obj.play_count || obj.video_play_count || 0,
          likes: obj.edge_media_preview_like?.count ?? obj.like_count ?? 0,
          comments: obj.edge_media_to_comment?.count ?? obj.comment_count ?? 0,
          caption: obj.edge_media_to_caption?.edges?.[0]?.node?.text || obj.caption?.text || '',
          thumbnail: obj.display_url || obj.image_versions2?.candidates?.[0]?.url || '',
          isVideo: obj.is_video ?? obj.media_type === 2,
          type: obj.product_type || (obj.is_video ? 'clips' : 'feed'),
          url: `https://www.instagram.com/p/${obj.shortcode}/`
        };
        posts.push(post);
        return; // Don't traverse deeper into this node's children
      }

      // Recurse into arrays and objects
      if (Array.isArray(obj)) {
        obj.forEach(traverse);
      } else {
        for (const key of Object.keys(obj)) {
          if (key === '__typename') continue;
          traverse(obj[key]);
        }
      }
    }

    traverse(data);
    return posts;
  }

  /**
   * Checks if a URL is an Instagram API/GraphQL endpoint we want to intercept.
   */
  function isInstagramApiUrl(url) {
    return url.includes('/graphql') ||
           url.includes('/api/v1/users/') ||
           url.includes('/api/v1/feed/');
  }

  // --- Override window.fetch ---
  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await origFetch.apply(this, args);

    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      if (isInstagramApiUrl(url)) {
        const clone = response.clone();
        clone.json().then(data => {
          const posts = extractPosts(data);
          if (posts.length > 0) {
            window.postMessage({ channel: CHANNEL, type: 'POSTS_DATA', posts }, '*');
          }
        }).catch(() => {});
      }
    } catch(e) {
      // Silently ignore errors — don't break the page
    }

    return response;
  };

  // --- Override XMLHttpRequest ---
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._igUrl = url;
    return origOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    if (this._igUrl && isInstagramApiUrl(this._igUrl)) {
      this.addEventListener('load', function() {
        try {
          const data = JSON.parse(this.responseText);
          const posts = extractPosts(data);
          if (posts.length > 0) {
            window.postMessage({ channel: CHANNEL, type: 'POSTS_DATA', posts }, '*');
          }
        } catch(e) {
          // Silently ignore parse errors
        }
      });
    }
    return origSend.apply(this, args);
  };

  console.log('[IG Reels Analyzer] Interceptor active');
})();
