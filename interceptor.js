// Instagram Reels Analyzer — MAIN World Interceptor v6

(function() {
  'use strict';

  const CHANNEL = 'IG_REELS_ANALYZER';
  let totalSent = 0;
  let interceptedUrls = 0;

  // Instagram PK encodes timestamp: (pk >> 23) / 1000 + epoch
  const IG_EPOCH = 1314220021;

  // Reserved Instagram paths (not profile usernames)
  const RESERVED_PATHS = new Set([
    'reels', 'explore', 'direct', 'stories', 'accounts', 'p', 'reel',
    'tv', 'about', 'legal', 'api', 'static', 'developer', 'graphql',
    'web', 'emails', 'challenge', 'oauth', 'session', 'nametag',
    'directory', 'lite', 'ar', 'topics', 'locations', ''
  ]);

  function getCurrentProfileUsername() {
    const match = window.location.pathname.match(/^\/([^/]+)/);
    if (match) {
      const name = match[1].toLowerCase();
      if (!RESERVED_PATHS.has(name)) return name;
    }
    return null;
  }

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
    if (obj.pk) return timestampFromPk(obj.pk);
    if (obj.id && /^\d+$/.test(String(obj.id).split('_')[0])) return timestampFromPk(String(obj.id).split('_')[0]);
    return 0;
  }

  function extractCaption(obj) {
    if (!obj || typeof obj !== 'object') return '';
    if (obj.edge_media_to_caption?.edges?.[0]?.node?.text) return obj.edge_media_to_caption.edges[0].node.text;
    if (obj.caption?.text) return obj.caption.text;
    if (obj.caption_text) return obj.caption_text;
    if (typeof obj.caption === 'string' && obj.caption) return obj.caption;
    if (obj.accessibility_caption) return obj.accessibility_caption;
    if (obj.title) return obj.title;
    return '';
  }

  function extractOwner(obj) {
    if (!obj || typeof obj !== 'object') return '';
    if (obj.user?.username) return obj.user.username.toLowerCase();
    if (obj.owner?.username) return obj.owner.username.toLowerCase();
    return '';
  }

  function normalizePost(obj, ctx) {
    const shortcode = obj.shortcode || obj.code;
    if (!shortcode) return null;
    if (typeof obj.code === 'number') return null;
    if (!obj.pk && !obj.id && !obj.media_type && !obj.is_video && !obj.display_url && !obj.image_versions2) return null;

    const timestamp = getTimestamp(obj);
    const views = obj.play_count || obj.video_play_count || obj.video_view_count || obj.view_count || 0;
    const likes = obj.edge_media_preview_like?.count ?? obj.edge_liked_by?.count ?? obj.like_count ?? 0;
    const comments = obj.edge_media_to_comment?.count ?? obj.edge_media_to_parent_comment?.count ?? obj.comment_count ?? 0;

    const caption = extractCaption(obj) || ctx.caption || '';
    const owner = extractOwner(obj) || ctx.owner || '';

    return {
      shortcode,
      timestamp: timestamp || Math.floor(Date.now() / 1000),
      views,
      likes,
      comments,
      caption,
      owner,
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
    const profileUsername = getCurrentProfileUsername();
    let debugged = false;

    function traverse(obj, depth, ctx) {
      if (!obj || typeof obj !== 'object' || depth > 25) return;

      const childCtx = { caption: ctx.caption, owner: ctx.owner };
      const captionHere = extractCaption(obj);
      if (captionHere) childCtx.caption = captionHere;
      const ownerHere = extractOwner(obj);
      if (ownerHere) childCtx.owner = ownerHere;

      const post = normalizePost(obj, childCtx);
      if (post && !seen.has(post.shortcode)) {
        // Debug: log structure info for first captionless post
        if (!post.caption && !debugged) {
          debugged = true;
          console.log('[IG Analyzer] DEBUG captionless post:');
          console.log('  keys:', Object.keys(obj).sort().join(', '));
          console.log('  obj.caption:', JSON.stringify(obj.caption)?.slice(0, 200));
          console.log('  obj.user:', JSON.stringify(obj.user)?.slice(0, 200));
          console.log('  ctx.caption:', childCtx.caption?.slice(0, 100) || '(empty)');
        }
        const belongsToProfile = !profileUsername || !post.owner || post.owner === profileUsername;
        if (belongsToProfile) {
          seen.add(post.shortcode);
          posts.push(post);
        }
      }

      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) traverse(obj[i], depth + 1, childCtx);
      } else {
        for (const k of Object.keys(obj)) {
          if (k === '__typename' || k === 'logging_page_id') continue;
          traverse(obj[k], depth + 1, childCtx);
        }
      }
    }

    traverse(data, 0, { caption: '', owner: '' });
    return posts;
  }

  function relay(posts, source) {
    if (posts.length === 0) return;
    totalSent += posts.length;
    const sample = posts[0];
    const captionPreview = sample.caption ? sample.caption.slice(0, 50) : '(sem legenda)';
    console.log(`[IG Analyzer] ✓ ${posts.length} posts (total: ${totalSent}) src=${source} owner=${sample.owner} views=${sample.views} caption="${captionPreview}"`);
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

  // Skip obvious non-API URLs (media, assets, CDN)
  function shouldIntercept(url) {
    if (!url) return false;
    if (/\.(jpg|jpeg|png|gif|webp|mp4|m4a|m3u8|css|woff2?|ttf|svg|ico)(\?|$)/i.test(url)) return false;
    if (url.includes('cdninstagram.com/v/') || url.includes('scontent')) return false;
    return true;
  }

  const origFetch = window.fetch;
  window.fetch = async function(input, init) {
    const url = getUrl(input);
    const response = await origFetch.apply(this, arguments);
    try {
      if (shouldIntercept(url)) {
        interceptedUrls++;
        const clone = response.clone();
        clone.text().then(text => tryParse(text, 'fetch')).catch(() => {});
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
        try { tryParse(this.responseText, 'xhr'); } catch(e) {}
      });
    }
    return origSend.apply(this, arguments);
  };

  // === Scan page for embedded/SSR data ===
  function scanPageData() {
    console.log('[IG Analyzer] Scanning page for embedded data...');
    let found = 0;

    // 1. Script tags with JSON data (Relay payloads)
    document.querySelectorAll('script[type="application/json"]').forEach(s => {
      try {
        const data = JSON.parse(s.textContent);
        const posts = extractPosts(data);
        if (posts.length > 0) { relay(posts, 'ssr-json'); found += posts.length; }
      } catch(e) {}
    });

    // 2. Script tags that contain JSON-like data (data-sjs, data-content-len)
    document.querySelectorAll('script[data-sjs]').forEach(s => {
      try {
        const data = JSON.parse(s.textContent);
        const posts = extractPosts(data);
        if (posts.length > 0) { relay(posts, 'ssr-sjs'); found += posts.length; }
      } catch(e) {}
    });

    // 3. Common Instagram global variables
    const globals = [
      '_sharedData', '__additionalDataLoaded', '__initialData',
      '__relay_store'
    ];
    for (const g of globals) {
      try {
        if (window[g]) {
          const posts = extractPosts(window[g]);
          if (posts.length > 0) { relay(posts, `global:${g}`); found += posts.length; }
        }
      } catch(e) {}
    }

    // 4. Look for require("ScheduledServerJS").handle calls in inline scripts
    document.querySelectorAll('script:not([src])').forEach(s => {
      const text = s.textContent;
      if (!text || text.length < 100 || text.length > 5000000) return;
      // Find JSON blobs that look like they contain media data
      const matches = text.match(/\{"(?:shortcode|code|media|clips|edge_)[^}]{50,}/g);
      if (matches) {
        for (const m of matches) {
          // Try to find a complete JSON object
          try {
            // Find the matching closing brace
            const startIdx = text.indexOf(m);
            let braceCount = 0;
            let endIdx = startIdx;
            for (let i = startIdx; i < text.length && i < startIdx + 500000; i++) {
              if (text[i] === '{') braceCount++;
              if (text[i] === '}') braceCount--;
              if (braceCount === 0) { endIdx = i + 1; break; }
            }
            if (endIdx > startIdx) {
              const jsonStr = text.slice(startIdx, endIdx);
              const data = JSON.parse(jsonStr);
              const posts = extractPosts(data);
              if (posts.length > 0) { relay(posts, 'ssr-inline'); found += posts.length; }
            }
          } catch(e) {}
        }
      }
    });

    console.log(`[IG Analyzer] Page scan complete: ${found} posts found, ${interceptedUrls} URLs intercepted`);
  }

  // Run page scan after DOM is ready
  if (document.readyState === 'complete') {
    setTimeout(scanPageData, 500);
  } else {
    window.addEventListener('load', () => setTimeout(scanPageData, 500));
  }

  console.log('[IG Analyzer] ✓ Interceptor v6 — broadened intercept + page scan');
})();
