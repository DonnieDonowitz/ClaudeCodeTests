import { useMemo, useState } from 'react';
import FeatureCard from './FeatureCard.jsx';
import { getStatus, PRIORITY_WEIGHT } from '../constants.js';

export default function FeatureList({ features, onAdd, onEdit, onDelete, onProgressDelta }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');

  const filtered = useMemo(() => {
    let list = features.filter((f) => {
      if (search.trim() && !f.title.toLowerCase().includes(search.trim().toLowerCase())) return false;
      if (statusFilter !== 'all' && getStatus(f.progress) !== statusFilter) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === 'priority') return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
      if (sortBy === 'progress') return b.progress - a.progress;
      if (sortBy === 'points') return b.storyPoints - a.storyPoints;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return list;
  }, [features, search, statusFilter, sortBy]);

  return (
    <div className="panel feature-panel">
      <div className="panel-head">
        <div>
          <h3 className="panel-title">Feature</h3>
          <p className="panel-subtitle">{filtered.length} di {features.length}</p>
        </div>
        <button className="btn btn-primary" onClick={onAdd}>+ Nuova feature</button>
      </div>

      <div className="filters-row">
        <input
          className="input"
          placeholder="Cerca per titolo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Tutti gli stati</option>
          <option value="todo">Da iniziare</option>
          <option value="in-progress">In corso</option>
          <option value="done">Completate</option>
        </select>
        <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="recent">Più recenti</option>
          <option value="priority">Priorità</option>
          <option value="progress">Progresso</option>
          <option value="points">Story point</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-hint empty-hint-lg">
          {features.length === 0
            ? 'Nessuna feature inserita. Inizia aggiungendo la prima feature del progetto.'
            : 'Nessuna feature corrisponde ai filtri selezionati.'}
        </div>
      ) : (
        <div className="feature-grid">
          {filtered.map((f) => (
            <FeatureCard
              key={f.id}
              feature={f}
              onEdit={onEdit}
              onDelete={onDelete}
              onProgressDelta={onProgressDelta}
            />
          ))}
        </div>
      )}
    </div>
  );
}
