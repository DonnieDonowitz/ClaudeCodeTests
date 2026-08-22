import ProgressDonut from './ProgressDonut.jsx';
import { STATUS_META } from '../constants.js';

export default function OverviewPanel({ overallCompletion, statusCounts }) {
  return (
    <div className="panel overview-panel">
      <h3 className="panel-title">Avanzamento reale del progetto</h3>
      <p className="panel-subtitle">Ponderato sugli story point stimati per ogni feature</p>
      <div className="overview-body">
        <ProgressDonut completedPct={overallCompletion} />
        <ul className="status-legend">
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <li key={key}>
              <span className="dot" style={{ background: meta.color }} />
              <span className="legend-label">{meta.label}</span>
              <span className="legend-count">{statusCounts[key] || 0}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
