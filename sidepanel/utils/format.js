const Format = (() => {
  const numFmt = new Intl.NumberFormat('pt-BR');
  const compactFmt = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
  const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  function number(n) {
    if (n == null) return '\u2014';
    return numFmt.format(Math.round(n));
  }

  function compact(n) {
    if (n == null) return '\u2014';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.', ',') + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.', ',') + 'K';
    return String(Math.round(n));
  }

  function date(ts) {
    if (!ts) return '\u2014';
    return dateFmt.format(new Date(ts * 1000));
  }

  function dateTime(ts) {
    if (!ts) return '\u2014';
    return dateTimeFmt.format(new Date(ts * 1000));
  }

  function ago(ts) {
    if (!ts) return '\u2014';
    const days = Math.floor((Date.now() / 1000 - ts) / 86400);
    if (days === 0) return 'hoje';
    if (days === 1) return 'ontem';
    if (days < 30) return `${days}d atr\u00e1s`;
    if (days < 365) return `${Math.floor(days / 30)}m atr\u00e1s`;
    return `${(days / 365).toFixed(1).replace('.', ',')}a atr\u00e1s`;
  }

  function score(n) {
    if (n == null) return '\u2014';
    return compact(n);
  }

  function percent(n) {
    if (n == null) return '\u2014';
    return (n * 100).toFixed(1).replace('.', ',') + '%';
  }

  return { number, compact, date, dateTime, ago, score, percent };
})();
