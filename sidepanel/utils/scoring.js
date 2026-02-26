// Score = views * 2^(-age/halfLife)
// age in days from now
const Scoring = (() => {
  const NOW = Date.now() / 1000; // unix seconds

  function calculate(views, timestamp, halfLifeDays) {
    if (!views || !timestamp) return 0;
    const ageDays = (NOW - timestamp) / 86400;
    if (ageDays < 0) return views; // future? just return views
    const decay = Math.pow(2, -ageDays / halfLifeDays);
    return views * decay;
  }

  function refreshNow() {
    // Can be called to update NOW if session is long
    // Not strictly needed since we recalculate
  }

  return { calculate };
})();
