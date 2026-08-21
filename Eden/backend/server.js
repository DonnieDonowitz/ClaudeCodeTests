const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'secret-key';

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `cert_${Date.now()}_${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/uploads', express.static(uploadDir));

function authMid(req, res, next) {
  const auth = req.headers.authorization?.split(' ')[1];
  if (!auth) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(auth, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

async function ensureAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}

async function ensureAuthorized(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

async function initDb() {
  await db.init();
  const user = await db.get('SELECT * FROM users WHERE email = ?', ['admin@eden.local']);
  if (!user) {
    const hashed = await bcrypt.hash('admin', 10);
    await db.run(
      'INSERT INTO users (name, surname, email, password, role, phone, via, numero, cap, città, provincia) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      ['Mario', 'Rossi', 'admin@eden.local', hashed, 'admin', '3391234567', 'Via Roma', '10', '61032', 'Fano', 'PU']
    );
  }
  
  await db.run('DELETE FROM courses', []);
  
  const courseColors = {
    'Pilates': '#3EC9C0', 'Medical Wellness': '#C090E0', 'Posturale': '#FF8FA0',
    'Silent Yoga': '#80B8F0', 'TRX': '#F0D080', 'GAG': '#E07070',
    'Total Body': '#70D0D0', 'Funzionale': '#C090E0', 'Corso Extra': '#E8C97A',
    'Acquagym': '#80B8F0', 'Acquabike': '#70D0D0', 'Acquasoft': '#3EC9C0',
    'Acqua Circuit': '#C090E0', 'Nuoto Bimbi': '#FF8FA0'
  };
  
  const courses = [
    // Fitness - Lunedì (day 0)
    { name: 'Pilates', category: 'Fitness', time: '09:00', day: 0 },
    { name: 'Posturale', category: 'Wellness', time: '17:00', day: 0 },
    { name: 'TRX', category: 'Fitness', time: '18:20', day: 0 },
    { name: 'Funzionale', category: 'Fitness', time: '19:10', day: 0 },
    // Fitness - Martedì (day 1)
    { name: 'Medical Wellness', category: 'Wellness', time: '09:00', day: 1 },
    { name: 'Silent Yoga', category: 'Yoga', time: '17:30', day: 1 },
    { name: 'GAG', category: 'Fitness', time: '18:20', day: 1 },
    { name: 'Total Body', category: 'Fitness', time: '19:10', day: 1 },
    // Fitness - Mercoledì (day 2)
    { name: 'Pilates', category: 'Fitness', time: '09:00', day: 2 },
    { name: 'Pilates', category: 'Fitness', time: '17:00', day: 2 },
    { name: 'Total Body', category: 'Fitness', time: '18:20', day: 2 },
    { name: 'Funzionale', category: 'Fitness', time: '19:10', day: 2 },
    // Fitness - Giovedì (day 3)
    { name: 'Medical Wellness', category: 'Wellness', time: '09:00', day: 3 },
    { name: 'Silent Yoga', category: 'Yoga', time: '17:30', day: 3 },
    { name: 'GAG', category: 'Fitness', time: '18:20', day: 3 },
    { name: 'TRX', category: 'Fitness', time: '19:10', day: 3 },
    // Fitness - Venerdì (day 4)
    { name: 'Posturale', category: 'Wellness', time: '09:00', day: 4 },
    { name: 'Posturale', category: 'Wellness', time: '16:00', day: 4 },
    { name: 'Funzionale', category: 'Fitness', time: '18:20', day: 4 },
    // Fitness - Sabato (day 5)
    { name: 'Corso Extra', category: 'Fitness', time: '10:00', day: 5 },
    { name: 'Pilates', category: 'Fitness', time: '17:00', day: 5 },
    // Piscina - Lunedì (day 0)
    { name: 'Acquagym', category: 'Piscina', time: '09:00', day: 0 },
    { name: 'Acquasoft', category: 'Piscina', time: '09:50', day: 0 },
    { name: 'Acquabike', category: 'Piscina', time: '13:30', day: 0 },
    { name: 'Nuoto Bimbi', category: 'Piscina', time: '15:30', day: 0 },
    { name: 'Acquagym', category: 'Piscina', time: '17:30', day: 0 },
    { name: 'Acquabike', category: 'Piscina', time: '18:20', day: 0 },
    // Piscina - Martedì (day 1)
    { name: 'Acquabike', category: 'Piscina', time: '09:00', day: 1 },
    { name: 'Acquagym', category: 'Piscina', time: '09:50', day: 1 },
    { name: 'Acquagym', category: 'Piscina', time: '13:30', day: 1 },
    { name: 'Nuoto Bimbi', category: 'Piscina', time: '15:30', day: 1 },
    { name: 'Acquagym', category: 'Piscina', time: '18:00', day: 1 },
    { name: 'Acquagym', category: 'Piscina', time: '18:20', day: 1 },
    // Piscina - Mercoledì (day 2)
    { name: 'Acquagym', category: 'Piscina', time: '09:00', day: 2 },
    { name: 'Acquasoft', category: 'Piscina', time: '09:50', day: 2 },
    { name: 'Acquabike', category: 'Piscina', time: '13:30', day: 2 },
    { name: 'Nuoto Bimbi', category: 'Piscina', time: '15:30', day: 2 },
    { name: 'Acquagym', category: 'Piscina', time: '17:30', day: 2 },
    { name: 'Acquabike', category: 'Piscina', time: '18:20', day: 2 },
    { name: 'Acqua Circuit', category: 'Piscina', time: '19:10', day: 2 },
    // Piscina - Giovedì (day 3)
    { name: 'Acquabike', category: 'Piscina', time: '09:00', day: 3 },
    { name: 'Acquagym', category: 'Piscina', time: '09:50', day: 3 },
    { name: 'Acquagym', category: 'Piscina', time: '13:30', day: 3 },
    { name: 'Nuoto Bimbi', category: 'Piscina', time: '15:30', day: 3 },
    { name: 'Acquagym', category: 'Piscina', time: '18:00', day: 3 },
    { name: 'Acquagym', category: 'Piscina', time: '18:20', day: 3 },
    { name: 'Acqua Circuit', category: 'Piscina', time: '19:10', day: 3 },
    // Piscina - Venerdì (day 4)
    { name: 'Acquagym', category: 'Piscina', time: '09:00', day: 4 },
    { name: 'Acqua Circuit', category: 'Piscina', time: '09:50', day: 4 },
    { name: 'Acquabike', category: 'Piscina', time: '13:30', day: 4 },
    { name: 'Nuoto Bimbi', category: 'Piscina', time: '15:30', day: 4 },
    { name: 'Acquagym', category: 'Piscina', time: '18:20', day: 4 },
    { name: 'Acqua Circuit', category: 'Piscina', time: '19:10', day: 4 },
    // Piscina - Sabato (day 5)
    { name: 'Corso Extra', category: 'Piscina', time: '09:50', day: 5 },
  ];
  for (const c of courses) {
    const color = courseColors[c.name] || '#3EC9C0';
    await db.run('INSERT INTO courses (name, category, time, day, color) VALUES (?,?,?,?,?)', [c.name, c.category, c.time, c.day, color]);
  }
}

app.post('/api/auth/register', async (req, res) => {
  const { name, surname, email, password, phone, via, numero, cap, città, provincia } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  const exist = await db.get('SELECT * FROM users WHERE email = ?', [email]);
  if (exist) return res.status(400).json({ error: 'User exists' });
  const hash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  const stmt = await db.run(
    'INSERT INTO users (name, surname, email, password, phone, via, numero, cap, città, provincia, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [name, surname || '', email, hash, phone || '', via || '', numero || '', cap || '', città || '', provincia || '', now]
  );
  const id = stmt.lastID;
  const token = jwt.sign({ id, email, role: 'user' }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token, user: { id, name, surname, email, role: 'user' } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) return res.status(400).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token, user: { id: user.id, name: user.name, surname: user.surname, email: user.email, role: user.role } });
});

app.get('/api/users', authMid, ensureAdmin, async (req, res) => {
  const { search } = req.query;
  let query = 'SELECT id, name, surname, email, phone, via, numero, cap, città, provincia, role, medical_certificate, subscription_plan_id, subscription_start, subscription_end, created_at FROM users WHERE id != ?';
  let params = [req.user.id];
  if (search) {
    query += ' AND (name LIKE ? OR surname LIKE ? OR email LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  const users = await db.all(query, params);
  res.json(users);
});

app.post('/api/users', authMid, ensureAdmin, async (req, res) => {
  const { name, surname, email, password, role, phone, via, numero, cap, città, provincia, subscription_plan_id, subscription_duration } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  const hash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  
  let subscription_start = null;
  let subscription_end = null;
  const duration = subscription_duration || 'mensile';
  if (subscription_plan_id) {
    subscription_start = now;
    const endDate = new Date();
    if (duration === 'trimestrale') endDate.setMonth(endDate.getMonth() + 3);
    else if (duration === 'semestrale') endDate.setMonth(endDate.getMonth() + 6);
    else if (duration === 'annuale') endDate.setFullYear(endDate.getFullYear() + 1);
    else endDate.setMonth(endDate.getMonth() + 1);
    subscription_end = endDate.toISOString();
  }
  
  const stmt = await db.run(
    'INSERT INTO users (name, surname, email, password, role, phone, via, numero, cap, città, provincia, subscription_plan_id, subscription_start, subscription_end, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [name, surname || '', email, hash, role || 'user', phone || '', via || '', numero || '', cap || '', città || '', provincia || '', subscription_plan_id || null, subscription_start, subscription_end, now]
  );
  res.json({ id: stmt.lastID, name, surname, email, role: role || 'user' });
});

app.put('/api/users/:id', authMid, ensureAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, surname, email, role, phone, via, numero, cap, città, provincia, subscription_plan_id } = req.body;
  
  let subscription_start = null;
  let subscription_end = null;
  if (subscription_plan_id) {
    subscription_start = new Date().toISOString();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);
    subscription_end = endDate.toISOString();
  }
  
  await db.run(
    'UPDATE users SET name = ?, surname = ?, email = ?, role = ?, phone = ?, via = ?, numero = ?, cap = ?, città = ?, provincia = ?, subscription_plan_id = ?, subscription_start = ?, subscription_end = ? WHERE id = ?',
    [name, surname || '', email, role, phone || '', via || '', numero || '', cap || '', città || '', provincia || '', subscription_plan_id, subscription_start, subscription_end, id]
  );
  res.json({ ok: true });
});

app.get('/api/user/profile', authMid, async (req, res) => {
  const user = await db.get('SELECT id, name, surname, email, phone, via, numero, cap, città, provincia, medical_certificate, subscription_plan_id, subscription_start, subscription_end FROM users WHERE id = ?', [req.user.id]);
  res.json(user);
});

app.put('/api/user/profile', authMid, async (req, res) => {
  const { name, surname, phone, via, numero, cap, città, provincia } = req.body;
  await db.run(
    'UPDATE users SET name = ?, surname = ?, phone = ?, via = ?, numero = ?, cap = ?, città = ?, provincia = ? WHERE id = ?',
    [name, surname || '', phone || '', via || '', numero || '', cap || '', città || '', provincia || '', req.user.id]
  );
  res.json({ ok: true });
});

app.post('/api/user/certificate', authMid, upload.single('certificate'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const filename = req.file.filename;
  await db.run('UPDATE users SET medical_certificate = ? WHERE id = ?', [filename, req.user.id]);
  res.json({ ok: true, filename });
});

app.get('/api/users/:id/certificate', authMid, ensureAdmin, async (req, res) => {
  const user = await db.get('SELECT medical_certificate FROM users WHERE id = ?', [parseInt(req.params.id, 10)]);
  if (!user || !user.medical_certificate) return res.status(404).json({ error: 'Certificate not found' });
  res.json({ filename: user.medical_certificate });
});

app.get('/api/users/:id/certificate/file', authMid, ensureAdmin, async (req, res) => {
  const user = await db.get('SELECT medical_certificate FROM users WHERE id = ?', [parseInt(req.params.id, 10)]);
  if (!user || !user.medical_certificate) return res.status(404).json({ error: 'Certificate not found' });
  const filePath = path.join(uploadDir, user.medical_certificate);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.download(filePath, user.medical_certificate);
});

app.get('/api/courses', async (req, res) => {
  const courses = await db.all('SELECT id, name, category, time, day, color FROM courses ORDER BY day, time', []);
  res.json(courses);
});

app.post('/api/courses', authMid, ensureAdmin, async (req, res) => {
  const { name, category, time, day, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing name' });
  const courseColors = {
    'Pilates': '#3EC9C0', 'Medical Wellness': '#C090E0', 'Posturale': '#FF8FA0',
    'Silent Yoga': '#80B8F0', 'TRX': '#F0D080', 'GAG': '#E07070',
    'Total Body': '#70D0D0', 'Funzionale': '#C090E0', 'Corso Extra': '#E8C97A',
    'Acquagym': '#80B8F0', 'Acquabike': '#70D0D0', 'Acquasoft': '#3EC9C0',
    'Acqua Circuit': '#C090E0', 'Nuoto Bimbi': '#FF8FA0'
  };
  const courseColor = color || courseColors[name] || '#3EC9C0';
  const stmt = await db.run('INSERT INTO courses (name, category, time, day, color) VALUES (?,?,?,?,?)', [name, category, time, day || 0, courseColor]);
  res.json({ id: stmt.lastID, name, category, time, day: day || 0, color: courseColor });
});

app.put('/api/courses/:id', authMid, ensureAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, category, time, day, color } = req.body;
  const courseColors = {
    'Pilates': '#3EC9C0', 'Medical Wellness': '#C090E0', 'Posturale': '#FF8FA0',
    'Silent Yoga': '#80B8F0', 'TRX': '#F0D080', 'GAG': '#E07070',
    'Total Body': '#70D0D0', 'Funzionale': '#C090E0', 'Corso Extra': '#E8C97A',
    'Acquagym': '#80B8F0', 'Acquabike': '#70D0D0', 'Acquasoft': '#3EC9C0',
    'Acqua Circuit': '#C090E0', 'Nuoto Bimbi': '#FF8FA0'
  };
  const courseColor = color || courseColors[name] || '#3EC9C0';
  await db.run('UPDATE courses SET name = ?, category = ?, time = ?, day = ?, color = ? WHERE id = ?', [name, category, time, day, courseColor, id]);
  res.json({ id, name, category, time, day, color: courseColor });
});

app.delete('/api/courses/:id', authMid, ensureAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await db.run('DELETE FROM courses WHERE id = ?', [id]);
  res.json({ ok: true, id });
});

app.delete('/api/users/:id', authMid, ensureAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await db.run('DELETE FROM user_courses WHERE user_id = ?', [id]);
  await db.run('DELETE FROM payments WHERE user_id = ?', [id]);
  await db.run('DELETE FROM users WHERE id = ?', [id]);
  res.json({ ok: true, id });
});

app.get('/api/closures', authMid, ensureAdmin, async (req, res) => {
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  const rows = await db.all('SELECT id, date, year FROM closures WHERE year = ?', [year]);
  res.json(rows);
});

app.post('/api/closures', authMid, ensureAdmin, async (req, res) => {
  const { date, year } = req.body;
  if (!date) return res.status(400).json({ error: 'Missing date' });
  const y = year || new Date(date).getFullYear();
  const stmt = await db.run('INSERT INTO closures (date, year) VALUES (?, ?)', [date, y]);
  res.json({ id: stmt.lastID, date, year: y });
});

app.get('/api/user/courses', authMid, async (req, res) => {
  const uid = req.user.id;
  const rows = await db.all(`SELECT c.id, c.name, c.time, c.category
    FROM courses c
    JOIN user_courses uc ON uc.course_id = c.id
    WHERE uc.user_id = ?`, [uid]);
  res.json(rows);
});

app.post('/api/user/courses/enroll', authMid, async (req, res) => {
  const { course_id } = req.body;
  const uid = req.user.id;
  if (!course_id) return res.status(400).json({ error: 'Missing course_id' });
  await db.run('INSERT INTO user_courses (user_id, course_id) VALUES (?, ?)', [uid, course_id]);
  res.json({ ok: true, course_id, user_id: uid });
});

app.delete('/api/user/courses/:courseId', authMid, async (req, res) => {
  const courseId = parseInt(req.params.courseId, 10);
  const uid = req.user.id;
  await db.run('DELETE FROM user_courses WHERE user_id = ? AND course_id = ?', [uid, courseId]);
  res.json({ ok: true, course_id: courseId });
});

app.get('/api/plans', async (req, res) => {
  const plans = [
    { 
      id: 1, 
      name: 'Palestra', 
      mensile: 60, 
      trimestrale: Math.round(60 * 3 * 0.90),
      semestrale: Math.round(60 * 6 * 0.85),
      annuale: Math.round(60 * 12 * 0.80),
      description: 'Accesso completo alla palestra' 
    },
    { 
      id: 2, 
      name: 'Palestra + Corsi', 
      mensile: 75, 
      trimestrale: Math.round(75 * 3 * 0.90),
      semestrale: Math.round(75 * 6 * 0.85),
      annuale: Math.round(75 * 12 * 0.80),
      description: 'Palestra + corsi illimitati' 
    },
    { 
      id: 3, 
      name: 'Full Access', 
      mensile: 95, 
      trimestrale: Math.round(95 * 3 * 0.90),
      semestrale: Math.round(95 * 6 * 0.85),
      annuale: Math.round(95 * 12 * 0.80),
      description: 'Palestra + corsi + piscina' 
    },
    { 
      id: 4, 
      name: 'Eden Total', 
      mensile: 120, 
      trimestrale: Math.round(120 * 3 * 0.90),
      semestrale: Math.round(120 * 6 * 0.85),
      annuale: Math.round(120 * 12 * 0.80),
      description: 'Esperienza completa con Spa' 
    }
  ];
  res.json(plans);
});

app.post('/api/paypal', authMid, async (req, res) => {
  const { amount, planId, duration } = req.body;
  const now = new Date().toISOString();
  const endDate = new Date();
  const dur = duration || 'mensile';
  if (dur === 'trimestrale') endDate.setMonth(endDate.getMonth() + 3);
  else if (dur === 'semestrale') endDate.setMonth(endDate.getMonth() + 6);
  else if (dur === 'annuale') endDate.setFullYear(endDate.getFullYear() + 1);
  else endDate.setMonth(endDate.getMonth() + 1);
  await db.run('UPDATE users SET subscription_plan_id = ?, subscription_start = ?, subscription_end = ? WHERE id = ?', [planId, now, endDate.toISOString(), req.user.id]);
  await db.run('INSERT INTO payments (user_id, amount, method, plan_id, created_at) VALUES (?, ?, ?, ?, ?)', [req.user.id, amount, 'PayPal', planId, now]);
  res.json({ status: 'paid', method: 'PayPal', amount, planId });
});

app.post('/api/stripe', authMid, async (req, res) => {
  const { amount, planId, duration } = req.body;
  const now = new Date().toISOString();
  const endDate = new Date();
  const dur = duration || 'mensile';
  if (dur === 'trimestrale') endDate.setMonth(endDate.getMonth() + 3);
  else if (dur === 'semestrale') endDate.setMonth(endDate.getMonth() + 6);
  else if (dur === 'annuale') endDate.setFullYear(endDate.getFullYear() + 1);
  else endDate.setMonth(endDate.getMonth() + 1);
  await db.run('UPDATE users SET subscription_plan_id = ?, subscription_start = ?, subscription_end = ? WHERE id = ?', [planId, now, endDate.toISOString(), req.user.id]);
  await db.run('INSERT INTO payments (user_id, amount, method, plan_id, created_at) VALUES (?, ?, ?, ?, ?)', [req.user.id, amount, 'Stripe', planId, now]);
  res.json({ status: 'paid', method: 'Stripe', amount, planId });
});

app.post('/api/cookie-consent', (req, res) => {
  const { consent } = req.body;
  if (consent) {
    res.cookie('gdpr_consent', 'true', { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: true });
  }
  res.json({ consent: !!consent });
});

app.use('/', express.static(path.join(__dirname, '../frontend/eden-react/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/eden-react/dist/index.html'));
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('DB init error', err);
});