const Trends = (() => {
  const STOPWORDS_PT = new Set([
    'a','o','e','\u00e9','de','do','da','em','no','na','que','para','com','um','uma',
    'os','as','dos','das','nos','nas','por','se','mais','muito','j\u00e1','ou','quando',
    'ao','aos','n\u00e3o','isso','esse','essa','este','esta','eu','ele','ela','eles',
    'elas','n\u00f3s','voc\u00eas','voc\u00ea','seu','sua','seus','suas','meu','minha','nos',
    'me','te','lhe','nos','vos','lhes','foi','ser','ter','fazer','como','mas',
    'ent\u00e3o','at\u00e9','s\u00f3','tamb\u00e9m','bem','aqui','ali','l\u00e1','onde','quem','qual',
    'cada','todo','toda','todos','todas','num','numa','pelo','pela','sobre',
    'entre','depois','antes','sem','s\u00e3o','tem','vai','vou','pode','est\u00e1','era',
    'foram','h\u00e1','the','and','to','of','in','is','it','for','on','with','this',
    'that','are','was','be','at','from','have','has','you','i','my','your','we',
    'they','so','if','no','not','will','can','just','been','do','would','como',
    'pra','pro','t\u00e1','t\u00f4','vc','tb','q','tbm','ne','n\u00e9'
  ]);

  function tokenize(text) {
    return text
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[#@]\w+/g, ' ') // remove hashtags/mentions but keep for separate extraction
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOPWORDS_PT.has(w) && !/^\d+$/.test(w));
  }

  function extractHashtags(text) {
    const matches = text.match(/#[\w\u00C0-\u024F]+/gi) || [];
    return matches.map(h => h.toLowerCase());
  }

  function analyze(posts, topN = 20) {
    const wordFreq = new Map();
    const hashtagFreq = new Map();
    const wordScores = new Map();
    const hashtagScores = new Map();

    for (const post of posts) {
      const caption = post.caption || '';
      const score = post.score || post.views || 0;

      // Words
      const words = tokenize(caption);
      const uniqueWords = new Set(words);
      for (const w of uniqueWords) {
        wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
        wordScores.set(w, (wordScores.get(w) || 0) + score);
      }

      // Hashtags
      const tags = extractHashtags(caption);
      const uniqueTags = new Set(tags);
      for (const t of uniqueTags) {
        hashtagFreq.set(t, (hashtagFreq.get(t) || 0) + 1);
        hashtagScores.set(t, (hashtagScores.get(t) || 0) + score);
      }
    }

    // Sort by average score x frequency
    function rank(freq, scores) {
      return Array.from(freq.entries())
        .filter(([, count]) => count >= 2)
        .map(([term, count]) => ({
          term,
          count,
          totalScore: scores.get(term) || 0,
          avgScore: (scores.get(term) || 0) / count
        }))
        .sort((a, b) => b.avgScore * Math.log2(b.count + 1) - a.avgScore * Math.log2(a.count + 1))
        .slice(0, topN);
    }

    return {
      keywords: rank(wordFreq, wordScores),
      hashtags: rank(hashtagFreq, hashtagScores)
    };
  }

  return { analyze, tokenize, extractHashtags };
})();
