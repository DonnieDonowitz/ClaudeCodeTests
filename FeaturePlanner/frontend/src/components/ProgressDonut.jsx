import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export default function ProgressDonut({ completedPct, size = 200 }) {
  const pct = Math.max(0, Math.min(100, Math.round(completedPct || 0)));
  const data = [
    { name: 'Completato', value: pct || 0.0001 },
    { name: 'Rimanente', value: 100 - pct },
  ];
  const colors = ['#22c3a6', 'rgba(255,255,255,0.09)'];

  return (
    <div className="donut-wrap" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius="74%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            stroke="none"
            isAnimationActive
            animationDuration={600}
          >
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={colors[i]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-center">
        <span className="donut-value">{pct}%</span>
        <span className="donut-caption">completato</span>
      </div>
    </div>
  );
}
