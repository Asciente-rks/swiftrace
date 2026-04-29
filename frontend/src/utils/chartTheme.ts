// Helper to derive chart colors from CSS variables (dark-mode aware)
export function getChartTheme() {
  if (typeof window === 'undefined' || !window.getComputedStyle) {
    return {
      color: '#111',
      backgroundColor: '#fff',
      gridColor: '#e6e6e6',
      tickColor: '#6d655b',
      tooltipBg: 'rgba(0,0,0,0.8)',
      tooltipTitleColor: '#fff',
    };
  }

  const styles = getComputedStyle(document.documentElement);
  const color = styles.getPropertyValue('--ink').trim() || '#111';
  const backgroundColor = styles.getPropertyValue('--surface').trim() || '#fff';
  const gridColor = styles.getPropertyValue('--stroke').trim() || '#e6e6e6';
  const tickColor = styles.getPropertyValue('--muted').trim() || '#6d655b';
  const tooltipBg = styles.getPropertyValue('--surface-92').trim() || 'rgba(0,0,0,0.8)';

  return {
    color,
    backgroundColor,
    gridColor,
    tickColor,
    tooltipBg,
    tooltipTitleColor: color,
  };
}

// Example small helper to build Chart.js options (if using Chart.js v3+)
export function buildChartOptions() {
  const t = getChartTheme();
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: t.color } },
      tooltip: {
        backgroundColor: t.tooltipBg,
        titleColor: t.tooltipTitleColor,
        bodyColor: t.color,
      },
    },
    scales: {
      x: { ticks: { color: t.tickColor }, grid: { color: t.gridColor } },
      y: { ticks: { color: t.tickColor }, grid: { color: t.gridColor } },
    },
  };
}
