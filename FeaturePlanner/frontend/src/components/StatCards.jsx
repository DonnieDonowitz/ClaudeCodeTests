const fmt = (n) => {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

export default function StatCards({ stats }) {
  const items = [
    { label: 'Feature totali', value: stats.totalFeatures },
    { label: 'Story point stimati', value: fmt(stats.totalStoryPoints) },
    { label: 'Story point completati', value: fmt(stats.completedStoryPoints) },
    { label: 'Da completare', value: fmt(stats.remainingStoryPoints) },
  ];

  return (
    <div className="stat-cards">
      {items.map((it) => (
        <div className="stat-card" key={it.label}>
          <span className="stat-value">{it.value}</span>
          <span className="stat-label">{it.label}</span>
        </div>
      ))}
    </div>
  );
}
