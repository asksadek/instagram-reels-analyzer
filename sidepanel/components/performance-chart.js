const PerformanceChart = (() => {
  const mount = document.getElementById('performance-chart-mount');
  let chartInstance = null;

  function render() {
    const posts = Store.getProcessed();
    if (posts.length < 3) {
      mount.innerHTML = `
        <div class="performance-chart">
          <div class="performance-chart__title">Desempenho ao Longo do Tempo</div>
          <div class="text-sm text-muted">Colete pelo menos 3 posts para ver o gráfico</div>
        </div>
      `;
      return;
    }

    // Ensure canvas exists
    if (!mount.querySelector('canvas')) {
      mount.innerHTML = `
        <div class="performance-chart">
          <div class="performance-chart__title">Desempenho ao Longo do Tempo</div>
          <canvas id="perf-chart" class="performance-chart__canvas"></canvas>
        </div>
      `;
    }

    const canvas = mount.querySelector('#perf-chart');
    if (!canvas) return;

    // Sort by date for chart
    const sorted = [...posts].sort((a, b) => a.timestamp - b.timestamp);

    // Group by month
    const monthly = new Map();
    for (const p of sorted) {
      const d = new Date(p.timestamp * 1000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthly.has(key)) monthly.set(key, { views: 0, count: 0, score: 0 });
      const m = monthly.get(key);
      m.views += p.views || 0;
      m.count++;
      m.score += p.score || 0;
    }

    const labels = Array.from(monthly.keys());
    const viewsData = Array.from(monthly.values()).map(m => m.views);
    const scoreData = Array.from(monthly.values()).map(m => m.score / m.count);

    if (chartInstance) chartInstance.destroy();

    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
      mount.querySelector('.performance-chart').innerHTML += `
        <div class="text-sm text-muted">Chart.js não carregado</div>
      `;
      return;
    }

    chartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Views',
            data: viewsData,
            backgroundColor: 'rgba(225, 48, 108, 0.3)',
            borderColor: 'rgba(225, 48, 108, 1)',
            borderWidth: 1,
            yAxisID: 'y'
          },
          {
            label: 'Score Médio',
            data: scoreData,
            type: 'line',
            borderColor: '#4caf50',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            borderWidth: 2,
            pointRadius: 3,
            fill: true,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: {
            labels: { color: '#a8a8a8', font: { size: 11 } }
          }
        },
        scales: {
          x: {
            ticks: { color: '#666', font: { size: 10 } },
            grid: { color: 'rgba(255,255,255,0.05)' }
          },
          y: {
            position: 'left',
            ticks: { color: '#a8a8a8', font: { size: 10 }, callback: v => Format.compact(v) },
            grid: { color: 'rgba(255,255,255,0.05)' }
          },
          y1: {
            position: 'right',
            ticks: { color: '#4caf50', font: { size: 10 }, callback: v => Format.compact(v) },
            grid: { display: false }
          }
        }
      }
    });
  }

  function init() {
    render();
    Store.on('posts', render);
    Store.on('halfLifeDays', render);
    Store.on('filters', render);
  }

  return { init, render };
})();
