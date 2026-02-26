const Export = (() => {
  function toCSV(posts) {
    const headers = ['Shortcode', 'URL', 'Tipo', 'Views', 'Likes', 'Coment\u00e1rios', 'Score', 'Data', 'Caption'];
    const rows = posts.map(p => [
      p.shortcode,
      p.url,
      p.isVideo ? 'Reel' : 'Foto',
      p.views,
      p.likes,
      p.comments,
      Math.round(p.score || 0),
      new Date(p.timestamp * 1000).toISOString(),
      `"${(p.caption || '').replace(/"/g, '""').replace(/\n/g, ' ').slice(0, 200)}"`
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  function toJSON(posts) {
    return JSON.stringify(posts.map(p => ({
      shortcode: p.shortcode,
      url: p.url,
      type: p.isVideo ? 'reel' : 'photo',
      views: p.views,
      likes: p.likes,
      comments: p.comments,
      score: Math.round(p.score || 0),
      timestamp: p.timestamp,
      date: new Date(p.timestamp * 1000).toISOString(),
      caption: p.caption
    })), null, 2);
  }

  function download(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadCSV(posts) {
    const ts = new Date().toISOString().slice(0, 10);
    download(toCSV(posts), `ig-analysis-${ts}.csv`, 'text/csv;charset=utf-8');
  }

  function downloadJSON(posts) {
    const ts = new Date().toISOString().slice(0, 10);
    download(toJSON(posts), `ig-analysis-${ts}.json`, 'application/json');
  }

  async function copyToClipboard(posts) {
    const text = posts.map((p, i) =>
      `${i + 1}. ${p.url} \u2014 ${Format.compact(p.views)} views \u2014 Score: ${Format.compact(p.score || 0)} \u2014 ${Format.ago(p.timestamp)}`
    ).join('\n');
    await navigator.clipboard.writeText(text);
  }

  return { toCSV, toJSON, downloadCSV, downloadJSON, copyToClipboard };
})();
