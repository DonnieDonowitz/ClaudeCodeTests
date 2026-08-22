import { useState } from 'react';
import Modal from './Modal.jsx';
import { PRIORITIES } from '../constants.js';

const emptyForm = { title: '', description: '', epicLink: '', storyPoints: 3, progress: 0, priority: 'media' };

export default function FeatureModal({ feature, onClose, onSave }) {
  const [form, setForm] = useState(
    feature
      ? {
          title: feature.title,
          description: feature.description || '',
          epicLink: feature.epicLink || '',
          storyPoints: feature.storyPoints,
          progress: feature.progress,
          priority: feature.priority,
        }
      : emptyForm
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Il titolo è obbligatorio');
      return;
    }
    if (form.epicLink.trim() && !/^https?:\/\/.+/i.test(form.epicLink.trim())) {
      setError('Il link alla EPIC deve essere un URL valido (es. https://...)');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onSave({
        title: form.title.trim(),
        description: form.description,
        epicLink: form.epicLink.trim(),
        storyPoints: Number(form.storyPoints) || 0,
        progress: Number(form.progress) || 0,
        priority: form.priority,
      });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Modal title={feature ? 'Modifica feature' : 'Nuova feature'} onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <label className="field">
          <span>Titolo</span>
          <input
            className="input"
            autoFocus
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="Es. Riconoscimento segnali stradali"
          />
        </label>

        <label className="field">
          <span>Descrizione (opzionale)</span>
          <textarea
            className="input"
            rows={3}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Dettagli tecnici, note, riferimenti…"
          />
        </label>

        <label className="field">
          <span>Link EPIC (Jira, opzionale)</span>
          <input
            className="input"
            type="url"
            value={form.epicLink}
            onChange={(e) => update('epicLink', e.target.value)}
            placeholder="https://tuoteam.atlassian.net/browse/PROJ-123"
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span>Priorità</span>
            <select className="input" value={form.priority} onChange={(e) => update('priority', e.target.value)}>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Story point stimati</span>
            <input
              className="input"
              type="number"
              min="0"
              step="0.5"
              value={form.storyPoints}
              onChange={(e) => update('storyPoints', e.target.value)}
            />
          </label>
        </div>

        <label className="field">
          <span>Progresso: {form.progress}%</span>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={form.progress}
            onChange={(e) => update('progress', e.target.value)}
            className="range-input"
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annulla</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Salvataggio…' : feature ? 'Salva modifiche' : 'Crea feature'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
