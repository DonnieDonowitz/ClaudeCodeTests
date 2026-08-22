import { getStatus, STATUS_META, PRIORITIES } from '../constants.js';

const PRIORITY_LABEL = Object.fromEntries(PRIORITIES.map((p) => [p.value, p.label]));

export default function FeatureCard({ feature, onEdit, onDelete, onProgressDelta }) {
  const status = getStatus(feature.progress);
  const meta = STATUS_META[status];

  return (
    <div className="feature-card">
      <div className="feature-card-head">
        <div className="feature-title-row">
          <h4 className="feature-title">{feature.title}</h4>
          <span className={`priority-tag priority-${feature.priority}`}>{PRIORITY_LABEL[feature.priority]}</span>
        </div>
        <span className="status-badge" style={{ color: meta.color, borderColor: meta.color }}>
          {meta.label}
        </span>
      </div>

      <div className="feature-meta-row">
        {feature.epicLink ? (
          <a className="epic-link-badge" href={feature.epicLink} target="_blank" rel="noopener noreferrer">
            Apri EPIC in Jira ↗
          </a>
        ) : (
          <span className="epic-link-badge epic-link-badge-none">Nessun link EPIC</span>
        )}
        <span className="sp-badge">{feature.storyPoints} SP</span>
      </div>

      {feature.description && <p className="feature-description">{feature.description}</p>}

      <div className="feature-progress-row">
        <div className="bar-track bar-track-lg">
          <div className="bar-fill" style={{ width: `${feature.progress}%`, background: meta.color }} />
        </div>
        <span className="feature-progress-value">{feature.progress}%</span>
      </div>

      <div className="feature-card-actions">
        <div className="progress-buttons">
          <button
            className="btn btn-ghost btn-xs"
            disabled={feature.progress <= 0}
            onClick={() => onProgressDelta(feature, -10)}
            title="Rimuovi progresso"
          >
            − 10%
          </button>
          <button
            className="btn btn-ghost btn-xs"
            disabled={feature.progress >= 100}
            onClick={() => onProgressDelta(feature, 10)}
            title="Aggiungi progresso"
          >
            + 10%
          </button>
        </div>
        <div className="card-icon-actions">
          <button className="icon-btn" title="Modifica feature" onClick={() => onEdit(feature)}>✎</button>
          <button className="icon-btn" title="Elimina feature" onClick={() => onDelete(feature)}>✕</button>
        </div>
      </div>
    </div>
  );
}
