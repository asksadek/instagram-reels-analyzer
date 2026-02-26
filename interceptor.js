// Instagram Reels Analyzer — MAIN World Interceptor v4

(function() {
  'use strict';

  const CHANNEL = 'IG_REELS_ANALYZER';
  let totalSent = 0;

  // Instagram PK encodes timestamp: (pk >> 23) / 1000 + epoch
  const IG_EPOCH = 1314220021;

  function timestampFromPk(pk) {
    try {
      const id = BigInt(String(pk));
      const shifted = Number(id >> 23n);
      return Math.floor(shifted / 1000) + IG_EPOCH;
    } catch(e) {
      return 0;
    }
  }

  function getTimestamp(obj) {
    if (obj.taken_at_timestamp) return obj.taken_at_timestamp;
    if (obj.taken_at) return obj.taken_at;
    if (obj.caption?.created_at) return obj.caption.created_at;
    // Derive from pk (Instagram snowflake ID)
    if (obj.pk) return timestampFromPk(obj.pk);
    if (obj.id && /^\d+$/.test(String(obj.id).split('_')[0])) return timestampFromPk(String(obj.id).split('_')[0]);
    return 0;
  }

  function normalizePost(obj) {
    const shortcode = obj.shortcode || obj.code;
    if (!shortcode) return null;
    // Filter out error responses that have a "code" field (numeric error codes)
    if (typeof obj.code === 'number') return null;
    // Must have at least one media indicator
    if (!obj.pk && !obj.id && !obj.media_type && !obj.is_video && !obj.display_url && !obj.image_versions2) return null;

    const timestamp = getTimestamp(obj);

    const views = obj.play_count || obj.video_play_count || obj.video_view_count || obj.view_count || 0;
    const likes = obj.edge_media_preview_like?.count ?? obj.edge_liked_by?.count ?? obj.like_count ?? 0;
    const comments = obj.edge_media_to_comment?.count ?? obj.edge_media_to_parent_comment?.count ?? obj.comment_count ?? 0;

    return {
      shortcode,
      timestamp: timestamp || Math.floor(Date.now() / 1000),
      views,
      likes,
      comments,
      caption: obj.edge_media_to_caption?.edges?.[0]?.node?.text || obj.caption?.text || obj.caption_text || (typeof obj.caption === 'string' ? obj.caption : '') || '',
      thumbnail: obj.display_url || obj.thumbnail_url || obj.thumbnail_src || obj.media_preview_url || obj.image_versions2?.candidates?.[0]?.url || obj.carousel_media?.[0]?.image_versions2?.candidates?.[0]?.url || '',
      engagementRate: views > 0 ? (likes + comments) / views : 0,
      isVideo: obj.is_video ?? (obj.media_type === 2) ?? (obj.product_type === 'clips') ?? false,
      type: obj.product_type || (obj.is_video ? 'clips' : (obj.media_type === 2 ? 'clips' : 'feed')),
      url: `https://www.instagram.com/reel/${shortcode}/`
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
    console.log(`[IG Analyzer] ✓ ${posts.length} posts (total: ${totalSent}) views=${posts[0].views} ts=${posts[0].timestamp} date=${new Date(posts[0].timestamp*1000).toLocaleDateString()}`);
    window.postMessage({ channel: CHANNEL, type: 'POSTS_DATA', posts }, '*');
  }

  function tryParse(text, source) {
    try {
      const data = JSON.parse(text);
      const posts = extractPosts(data);
      if (posts.length > 0) relay(posts, source);
    } catch(e) {}
  }

  function getUrl(input) {
    if (typeof input === 'string') return input;
    if (input instanceof Request) return input.url;
    if (input?.url) return input.url;
    return '';
  }

  function shouldIntercept(url) {
    if (!url) return false;
    return url.includes('graphql') || url.includes('/api/') || url.includes('query') ||
           url.includes('feed') || url.includes('clips') || url.includes('reels') ||
           url.includes('media') || url.includes('user');
  }

  const origFetch = window.fetch;
  window.fetch = async function(input, init) {
    const url = getUrl(input);
    const response = await origFetch.apply(this, arguments);
    try {
      if (shouldIntercept(url)) {
        const clone = response.clone();
        clone.text().then(text => tryParse(text, url)).catch(() => {});
      }
    } catch(e) {}
    return response;
  };

  const XHR = XMLHttpRequest.prototype;
  const origOpen = XHR.open;
  const origSend = XHR.send;

  XHR.open = function(method, url) {
    this._igUrl = typeof url === 'string' ? url : '';
    return origOpen.apply(this, arguments);
  };

  XHR.send = function() {
    const url = this._igUrl;
    if (shouldIntercept(url)) {
      this.addEventListener('load', function() {
        try { tryParse(this.responseText, url); } catch(e) {}
      });
    }
    return origSend.apply(this, arguments);
  };

  console.log('[IG Analyzer] ✓ Interceptor v4 — pk timestamp derivation');
})();
