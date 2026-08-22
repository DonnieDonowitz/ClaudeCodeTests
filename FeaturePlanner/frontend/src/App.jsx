import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { getStatus } from './constants.js';
import StatCards from './components/StatCards.jsx';
import OverviewPanel from './components/OverviewPanel.jsx';
import FeatureList from './components/FeatureList.jsx';
import FeatureModal from './components/FeatureModal.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';

export default function App() {
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [featureModal, setFeatureModal] = useState(null); // null | 'add' | feature object
  const [confirmState, setConfirmState] = useState(null); // { type, item }

  useEffect(() => {
    (async () => {
      try {
        const fe = await api.getFeatures();
        setFeatures(fe);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = useMemo(() => {
    const totalStoryPoints = features.reduce((s, f) => s + f.storyPoints, 0);
    const completedStoryPoints = features.reduce((s, f) => s + (f.storyPoints * f.progress) / 100, 0);
    const remainingStoryPoints = totalStoryPoints - completedStoryPoints;
    const overallCompletion = totalStoryPoints > 0 ? (completedStoryPoints / totalStoryPoints) * 100 : 0;
    const statusCounts = { todo: 0, 'in-progress': 0, done: 0 };
    features.forEach((f) => { statusCounts[getStatus(f.progress)]++; });
    return { totalFeatures: features.length, totalStoryPoints, completedStoryPoints, remainingStoryPoints, overallCompletion, statusCounts };
  }, [features]);

  // ---------- Feature handlers ----------

  const saveFeature = async (payload) => {
    if (featureModal && featureModal !== 'add') {
      const updated = await api.updateFeature(featureModal.id, payload);
      setFeatures((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    } else {
      const created = await api.createFeature(payload);
      setFeatures((prev) => [created, ...prev]);
    }
    setFeatureModal(null);
  };

  const deleteFeature = async (feature) => {
    await api.deleteFeature(feature.id);
    setFeatures((prev) => prev.filter((f) => f.id !== feature.id));
    setConfirmState(null);
  };

  const progressDelta = async (feature, delta) => {
    const target = Math.min(100, Math.max(0, feature.progress + delta));
    setFeatures((prev) => prev.map((f) => (f.id === feature.id ? { ...f, progress: target } : f)));
    try {
      const updated = await api.patchProgress(feature.id, delta);
      setFeatures((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    } catch (err) {
      setFeatures((prev) => prev.map((f) => (f.id === feature.id ? feature : f)));
      setError(err.message);
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>FeaturePlanner</h1>
          <p>Pianificazione feature &amp; avanzamento — progetto automotive</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => setFeatureModal('add')}>+ Nuova feature</button>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button className="icon-btn" onClick={() => setError('')}>✕</button>
        </div>
      )}

      {loading ? (
        <div className="loading-state">Caricamento dati…</div>
      ) : (
        <>
          <StatCards stats={stats} />
          <div className="main-grid">
            <FeatureList
              features={features}
              onAdd={() => setFeatureModal('add')}
              onEdit={(f) => setFeatureModal(f)}
              onDelete={(f) => setConfirmState({ type: 'feature', item: f })}
              onProgressDelta={progressDelta}
            />
            <aside className="sidebar">
              <OverviewPanel overallCompletion={stats.overallCompletion} statusCounts={stats.statusCounts} />
            </aside>
          </div>
        </>
      )}

      {featureModal && (
        <FeatureModal
          feature={featureModal === 'add' ? null : featureModal}
          onClose={() => setFeatureModal(null)}
          onSave={saveFeature}
        />
      )}

      {confirmState && confirmState.type === 'feature' && (
        <ConfirmDialog
          title="Eliminare la feature?"
          message={`"${confirmState.item.title}" verrà eliminata definitivamente.`}
          confirmLabel="Elimina"
          danger
          onCancel={() => setConfirmState(null)}
          onConfirm={() => deleteFeature(confirmState.item)}
        />
      )}
    </div>
  );
}
