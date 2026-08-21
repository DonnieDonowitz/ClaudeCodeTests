import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../components/Loading';

const inputStyle = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: '12px',
  border: '1px solid rgba(62,201,192,0.2)',
  background: 'rgba(10,22,40,0.6)',
  color: 'white',
  fontSize: '0.9rem',
  outline: 'none',
  marginBottom: '12px',
};

export default function Admin() {
  const { user, token } = useAuth();
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [closures, setClosures] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [showAddClosure, setShowAddClosure] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [newUser, setNewUser] = useState({ 
    name: '', surname: '', email: '', password: '', role: 'user', 
    phone: '', via: '', numero: '', cap: '', città: '', provincia: '', 
    subscription_plan_id: '', subscription_duration: 'mensile'
  });
  const [newCourse, setNewCourse] = useState({ name: '', category: 'Fitness', time: '09:00', day: 0 });
  const [newClosure, setNewClosure] = useState({ date: '', year: new Date().getFullYear() });
  const [courseTab, setCourseTab] = useState('fitness');
  const [draggedCourse, setDraggedCourse] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const [usersRes, coursesRes, closuresRes, plansRes] = await Promise.all([
        fetch(`/api/users${searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ''}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/courses'),
        fetch('/api/closures', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/plans'),
      ]);
      const usersData = usersRes.ok ? await usersRes.json() : [];
      setUsers(Array.isArray(usersData) ? usersData : []);
      setCourses(await coursesRes.json());
      setClosures(closuresRes.ok ? await closuresRes.json() : []);
      setPlans(await plansRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') {
      fetchData();
    }
  }, [searchQuery]);

  const addUser = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newUser),
      });
      if (res.ok) {
        fetchData();
        setShowAddUser(false);
        setNewUser({ name: '', surname: '', email: '', password: '', role: 'user', phone: '', via: '', numero: '', cap: '', città: '', provincia: '', subscription_plan_id: '', subscription_duration: 'mensile' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteCourse = async (id) => {
    try {
      const res = await fetch(`/api/courses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const updateCourse = async (id, day, time) => {
    try {
      const res = await fetch(`/api/courses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ day, time }),
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const addCourse = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newCourse),
      });
      if (res.ok) {
        fetchData();
        setShowAddCourse(false);
        setNewCourse({ name: '', category: 'Fitness', time: '09:00', day: 0 });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDragStart = (course) => {
    setDraggedCourse(course);
  };

  const handleDrop = async (day, time) => {
    if (draggedCourse) {
      await updateCourse(draggedCourse.id, day, time);
      setDraggedCourse(null);
    }
  };

  const addClosure = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/closures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newClosure),
      });
      if (res.ok) {
        fetchData();
        setShowAddClosure(false);
        setNewClosure({ date: '', year: new Date().getFullYear() });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo utente?')) return;
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const downloadCertificate = async (userId) => {
    try {
      const res = await fetch(`/api/users/${userId}/certificate`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      if (!res.ok) {
        alert('Certificato non trovato');
        return;
      }
      const data = await res.json();
      const fileRes = await fetch(`/api/users/${userId}/certificate/file`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!fileRes.ok) {
        alert('File non trovato');
        return;
      }
      const blob = await fileRes.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      alert('Errore nel download del certificato');
    }
  };

  const getPlanName = (planId) => {
    if (!planId) return 'Nessuno';
    const plan = plans.find(p => p.id === planId);
    return plan ? plan.name : 'Nessuno';
  };

  if (loading) return <PageLoader />;

  return (
    <div style={{ paddingTop: '76px', minHeight: '100vh', background: '#0A1628' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 48px' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: '32px' }}
        >
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.5rem', fontWeight: 700, color: 'white', marginBottom: '8px' }}>
            Pannello Admin 🔧
          </h1>
          <p style={{ fontSize: '1rem', color: '#8BA8B5' }}>Gestisci utenti, corsi e chiusure</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'rgba(15,30,53,0.8)', border: '1px solid rgba(62,201,192,0.15)', borderRadius: '50px', padding: '6px', width: 'fit-content' }}
        >
          {['users', 'courses', 'closures'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 24px',
                borderRadius: '50px',
                border: 'none',
                background: activeTab === tab ? '#3EC9C0' : 'transparent',
                color: activeTab === tab ? '#0A1628' : '#8BA8B5',
                fontFamily: "'Outfit', sans-serif",
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {tab === 'users' ? 'Utenti' : tab === 'courses' ? 'Corsi' : 'Chiusure'}
            </button>
          ))}
        </motion.div>

        {activeTab === 'users' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', fontWeight: 700, color: 'white' }}>Utenti</h2>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Cerca per nome, cognome o email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ padding: '10px 16px', borderRadius: '50px', border: '1px solid rgba(62,201,192,0.2)', background: 'rgba(10,22,40,0.6)', color: 'white', fontSize: '0.9rem', outline: 'none', width: '300px' }}
                />
                <button onClick={() => setShowAddUser(true)} style={{ padding: '10px 20px', borderRadius: '50px', border: 'none', background: '#3EC9C0', color: '#0A1628', fontWeight: 700, cursor: 'pointer' }}>+ Aggiungi utente</button>
              </div>
            </div>
            <div style={{ background: '#0F1E35', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(62,201,192,0.15)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(62,201,192,0.1)' }}>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#3EC9C0', textTransform: 'uppercase', letterSpacing: '0.1em' }}>ID</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#3EC9C0', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Nome</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#3EC9C0', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Email</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#3EC9C0', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Telefono</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#3EC9C0', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Abbonamento</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#3EC9C0', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Certificato</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#3EC9C0', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Ruolo</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#3EC9C0', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Creato</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#3EC9C0', textTransform: 'uppercase', letterSpacing: '0.1em' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: '#8BA8B5' }}>{u.id}</td>
                      <td style={{ padding: '14px 16px', fontSize: '0.9rem', color: 'white', fontWeight: 500 }}>{u.name} {u.surname}</td>
                      <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: '#8BA8B5' }}>{u.email}</td>
                      <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: '#8BA8B5' }}>{u.phone || '-'}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 600, background: 'rgba(62,201,192,0.2)', color: '#3EC9C0' }}>
                          {getPlanName(u.subscription_plan_id)}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {u.medical_certificate ? (
                          <button onClick={() => downloadCertificate(u.id)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #3EC9C0', background: 'transparent', color: '#3EC9C0', fontSize: '0.75rem', cursor: 'pointer' }}>📥 Scarica</button>
                        ) : (
                          <span style={{ color: '#8BA8B5', fontSize: '0.8rem' }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', background: u.role === 'admin' ? 'rgba(201,168,76,0.2)' : 'rgba(62,201,192,0.2)', color: u.role === 'admin' ? '#E8C97A' : '#3EC9C0' }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '0.8rem', color: '#8BA8B5' }}>{u.created_at?.split('T')[0]}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <button onClick={() => deleteUser(u.id)} style={{ background: 'rgba(226,61,40,0.15)', border: '1px solid rgba(226,61,40,0.3)', borderRadius: '8px', padding: '8px', color: '#E23D28', cursor: 'pointer' }}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'courses' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', fontWeight: 700, color: 'white' }}>Gestione Corsi</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', background: 'rgba(15,30,53,0.6)', borderRadius: '50px', padding: '4px' }}>
                  {['fitness', 'piscina'].map(tab => (
                    <button key={tab} onClick={() => setCourseTab(tab)} style={{ padding: '8px 16px', borderRadius: '50px', border: 'none', background: courseTab === tab ? '#3EC9C0' : 'transparent', color: courseTab === tab ? '#0A1628' : '#8BA8B5', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                      {tab === 'fitness' ? '🏋️ Fitness' : '🏊 Piscina'}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowAddCourse(true)} style={{ padding: '10px 20px', borderRadius: '50px', border: 'none', background: '#3EC9C0', color: '#0A1628', fontWeight: 700, cursor: 'pointer' }}>+ Nuovo Corso</button>
              </div>
            </div>
            <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid rgba(62,201,192,0.15)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '750px' }}>
                <thead>
                  <tr>
                    <th style={{ background: 'rgba(62,201,192,0.12)', padding: '14px', textAlign: 'center', fontSize: '0.75rem', color: '#3EC9C0', textTransform: 'uppercase' }}>Orario</th>
                    {['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'].map(d => (
                      <th key={d} style={{ background: 'rgba(62,201,192,0.12)', padding: '14px', textAlign: 'center', fontSize: '0.75rem', color: '#3EC9C0', textTransform: 'uppercase' }}>{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'].map(hour => (
                    <tr key={hour}>
                      <td style={{ padding: '10px', textAlign: 'center', color: '#8BA8B5', fontWeight: 600, fontSize: '0.8rem', borderRight: '1px solid rgba(255,255,255,0.05)' }}>{hour}</td>
                      {[0,1,2,3,4,5].map(dayIdx => {
                        const course = courses.find(c => c.day === dayIdx && c.time === hour && (courseTab === 'fitness' ? c.category !== 'Piscina' : c.category === 'Piscina'));
                        const pillColor = course?.category === 'Piscina' ? '#80B8F0' : '#3EC9C0';
                        return (
                          <td 
                            key={dayIdx} 
                            style={{ padding: '8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.03)', minHeight: '60px', position: 'relative' }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleDrop(dayIdx, hour)}
                          >
                            {course ? (
                              <motion.div
                                draggable
                                onDragStart={() => handleDragStart(course)}
                                whileHover={{ scale: 1.05 }}
                                style={{ display: 'inline-block', padding: '6px 10px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 600, background: `${pillColor}33`, color: pillColor, cursor: 'grab', position: 'relative' }}
                              >
                                {course.name}
                                <button 
                                  onClick={(e) => { e.stopPropagation(); deleteCourse(course.id); }}
                                  style={{ position: 'absolute', top: '-6px', right: '-6px', width: '16px', height: '16px', borderRadius: '50%', border: 'none', background: '#E23D28', color: 'white', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  ×
                                </button>
                              </motion.div>
                            ) : (
                              <button
                                onClick={() => { setSelectedSlot({ day: dayIdx, time: hour }); setShowAddCourse(true); }}
                                style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px dashed rgba(62,201,192,0.3)', background: 'transparent', color: 'rgba(62,201,192,0.5)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}
                              >
                                +
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: '12px', fontSize: '0.8rem', color: '#8BA8B5' }}>💡 Trascina i corsi per spostarli | Clicca + per aggiungere un corso</p>
          </motion.div>
        )}

        {activeTab === 'closures' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', fontWeight: 700, color: 'white' }}>Chiusure</h2>
              <button onClick={() => setShowAddClosure(true)} style={{ padding: '10px 20px', borderRadius: '50px', border: 'none', background: '#3EC9C0', color: '#0A1628', fontWeight: 700, cursor: 'pointer' }}>+ Aggiungi chiusura</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              {closures.map((c, i) => (
                <div key={i} style={{ background: '#0F1E35', borderRadius: '16px', padding: '20px', border: '1px solid rgba(226,61,40,0.2)' }}>
                  <div style={{ fontWeight: 600, color: 'white' }}>{c.date}</div>
                  <div style={{ fontSize: '0.8rem', color: '#8BA8B5' }}>Anno: {c.year}</div>
                </div>
              ))}
              {closures.length === 0 && <p style={{ color: '#8BA8B5' }}>Nessuna chiusura.</p>}
            </div>
          </motion.div>
        )}

        {showAddUser && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setShowAddUser(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} onClick={(e) => e.stopPropagation()} style={{ background: '#0F1E35', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto', border: '1px solid rgba(62,201,192,0.2)' }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', fontWeight: 700, color: 'white', marginBottom: '24px' }}>Aggiungi utente</h3>
              <form onSubmit={addUser}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#8BA8B5', marginBottom: '6px', textTransform: 'uppercase' }}>Nome *</label>
                    <input type="text" placeholder="Nome" value={newUser.name} onChange={(e) => setNewUser({...newUser, name: e.target.value})} required style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#8BA8B5', marginBottom: '6px', textTransform: 'uppercase' }}>Cognome</label>
                    <input type="text" placeholder="Cognome" value={newUser.surname} onChange={(e) => setNewUser({...newUser, surname: e.target.value})} style={inputStyle} />
                  </div>
                </div>
                <input type="email" placeholder="Email *" value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} required style={inputStyle} />
                <input type="password" placeholder="Password *" value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} required style={inputStyle} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#8BA8B5', marginBottom: '6px', textTransform: 'uppercase' }}>Telefono</label>
                    <input type="tel" placeholder="Cellulare" value={newUser.phone} onChange={(e) => setNewUser({...newUser, phone: e.target.value})} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#8BA8B5', marginBottom: '6px', textTransform: 'uppercase' }}>Ruolo</label>
                    <select value={newUser.role} onChange={(e) => setNewUser({...newUser, role: e.target.value})} style={inputStyle}>
                      <option value="user">Utente</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#8BA8B5', marginBottom: '6px', textTransform: 'uppercase' }}>Indirizzo</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '8px' }}>
                    <input type="text" placeholder="Via" value={newUser.via} onChange={(e) => setNewUser({...newUser, via: e.target.value})} style={inputStyle} />
                    <input type="text" placeholder="N." value={newUser.numero} onChange={(e) => setNewUser({...newUser, numero: e.target.value})} style={inputStyle} />
                    <input type="text" placeholder="CAP" value={newUser.cap} onChange={(e) => setNewUser({...newUser, cap: e.target.value})} style={inputStyle} />
                    <input type="text" placeholder="Città" value={newUser.città} onChange={(e) => setNewUser({...newUser, città: e.target.value})} style={inputStyle} />
                  </div>
                </div>
                <input type="text" placeholder="Provincia" value={newUser.provincia} onChange={(e) => setNewUser({...newUser, provincia: e.target.value})} style={inputStyle} />
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#8BA8B5', marginBottom: '6px', textTransform: 'uppercase' }}>Assegna abbonamento</label>
                  <select value={newUser.subscription_plan_id} onChange={(e) => setNewUser({...newUser, subscription_plan_id: e.target.value ? parseInt(e.target.value) : ''})} style={inputStyle}>
                    <option value="">Nessuno</option>
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>{p.name} - €{p.mensile}/mese</option>
                    ))}
                  </select>
                  {newUser.subscription_plan_id && (
                    <select value={newUser.subscription_duration || 'mensile'} onChange={(e) => setNewUser({...newUser, subscription_duration: e.target.value})} style={{ ...inputStyle, marginTop: '8px' }}>
                      <option value="mensile">Mensile (nessuno sconto)</option>
                      <option value="trimestrale">Trimestrale (-10%)</option>
                      <option value="semestrale">Semestrale (-15%)</option>
                      <option value="annuale">Annuale (-20%)</option>
                    </select>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                  <button type="button" onClick={() => setShowAddUser(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Annulla</button>
                  <button type="submit" style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: '#3EC9C0', color: '#0A1628', fontWeight: 700, cursor: 'pointer' }}>Aggiungi</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showAddCourse && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setShowAddCourse(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} onClick={(e) => e.stopPropagation()} style={{ background: '#0F1E35', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '400px', border: '1px solid rgba(62,201,192,0.2)' }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', fontWeight: 700, color: 'white', marginBottom: '24px' }}>Aggiungi corso</h3>
              <form onSubmit={addCourse}>
                <input type="text" placeholder="Nome corso" value={newCourse.name} onChange={(e) => setNewCourse({...newCourse, name: e.target.value})} required style={inputStyle} />
                <input type="text" placeholder="Categoria" value={newCourse.category} onChange={(e) => setNewCourse({...newCourse, category: e.target.value})} style={inputStyle} />
                <input type="text" placeholder="Orario (es. 09:00)" value={newCourse.time} onChange={(e) => setNewCourse({...newCourse, time: e.target.value})} style={inputStyle} />
                <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                  <button type="button" onClick={() => setShowAddCourse(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Annulla</button>
                  <button type="submit" style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: '#3EC9C0', color: '#0A1628', fontWeight: 700, cursor: 'pointer' }}>Aggiungi</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showAddClosure && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setShowAddClosure(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} onClick={(e) => e.stopPropagation()} style={{ background: '#0F1E35', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '400px', border: '1px solid rgba(62,201,192,0.2)' }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', fontWeight: 700, color: 'white', marginBottom: '24px' }}>Aggiungi chiusura</h3>
              <form onSubmit={addClosure}>
                <input type="date" value={newClosure.date} onChange={(e) => setNewClosure({...newClosure, date: e.target.value})} required style={inputStyle} />
                <input type="number" placeholder="Anno" value={newClosure.year} onChange={(e) => setNewClosure({...newClosure, year: parseInt(e.target.value)})} required style={inputStyle} />
                <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                  <button type="button" onClick={() => setShowAddClosure(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Annulla</button>
                  <button type="submit" style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: '#3EC9C0', color: '#0A1628', fontWeight: 700, cursor: 'pointer' }}>Aggiungi</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}