const express = require('express');
const cors = require('cors');
const { v4: uuid } = require('uuid');
const db = require('./db');

const PORT = process.env.PORT || 4001;
const app = express();

app.use(cors());
app.use(express.json());

const nowIso = () => new Date().toISOString();
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const isValidLink = (link) => /^https?:\/\/.+/i.test(link);

function serializeFeature(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    epicLink: row.epic_link || '',
    storyPoints: row.story_points,
    progress: row.progress,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------- Features ----------

app.get('/api/features', async (req, res, next) => {
  try {
    const rows = await db.all('SELECT * FROM features ORDER BY created_at DESC');
    res.json(rows.map(serializeFeature));
  } catch (err) { next(err); }
});

app.post('/api/features', async (req, res, next) => {
  try {
    const { title, description = '', epicLink = '', storyPoints = 0, progress = 0, priority = 'media' } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Il titolo della feature è obbligatorio' });
    if (epicLink && !isValidLink(epicLink)) {
      return res.status(400).json({ error: 'Il link alla EPIC deve essere un URL valido (es. https://...)' });
    }
    const id = uuid();
    const ts = nowIso();
    const sp = Math.max(0, Number(storyPoints) || 0);
    const pr = clamp(Math.round(Number(progress) || 0), 0, 100);
    await db.run(
      `INSERT INTO features (id, title, description, epic_link, story_points, progress, priority, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title.trim(), description, epicLink.trim(), sp, pr, priority, ts, ts]
    );
    const row = await db.get('SELECT * FROM features WHERE id = ?', [id]);
    res.status(201).json(serializeFeature(row));
  } catch (err) { next(err); }
});

app.put('/api/features/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await db.get('SELECT * FROM features WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Feature non trovata' });

    const title = req.body.title !== undefined ? req.body.title.trim() : existing.title;
    if (!title) return res.status(400).json({ error: 'Il titolo della feature è obbligatorio' });
    const description = req.body.description !== undefined ? req.body.description : existing.description;
    const epicLink = req.body.epicLink !== undefined ? req.body.epicLink.trim() : existing.epic_link;
    if (epicLink && !isValidLink(epicLink)) {
      return res.status(400).json({ error: 'Il link alla EPIC deve essere un URL valido (es. https://...)' });
    }
    const storyPoints = req.body.storyPoints !== undefined ? Math.max(0, Number(req.body.storyPoints) || 0) : existing.story_points;
    const progress = req.body.progress !== undefined ? clamp(Math.round(Number(req.body.progress) || 0), 0, 100) : existing.progress;
    const priority = req.body.priority !== undefined ? req.body.priority : existing.priority;

    await db.run(
      `UPDATE features SET title = ?, description = ?, epic_link = ?, story_points = ?, progress = ?, priority = ?, updated_at = ?
       WHERE id = ?`,
      [title, description, epicLink, storyPoints, progress, priority, nowIso(), id]
    );
    const row = await db.get('SELECT * FROM features WHERE id = ?', [id]);
    res.json(serializeFeature(row));
  } catch (err) { next(err); }
});

app.patch('/api/features/:id/progress', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { delta } = req.body;
    if (typeof delta !== 'number') return res.status(400).json({ error: 'delta numerico obbligatorio' });
    const existing = await db.get('SELECT * FROM features WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Feature non trovata' });
    const progress = clamp(Math.round(existing.progress + delta), 0, 100);
    await db.run('UPDATE features SET progress = ?, updated_at = ? WHERE id = ?', [progress, nowIso(), id]);
    const row = await db.get('SELECT * FROM features WHERE id = ?', [id]);
    res.json(serializeFeature(row));
  } catch (err) { next(err); }
});

app.delete('/api/features/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await db.get('SELECT * FROM features WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Feature non trovata' });
    await db.run('DELETE FROM features WHERE id = ?', [id]);
    res.status(204).end();
  } catch (err) { next(err); }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Errore interno del server' });
});

db.init()
  .then(() => {
    app.listen(PORT, () => console.log(`FeaturePlanner API in ascolto su http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Impossibile inizializzare il database', err);
    process.exit(1);
  });
