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

const labelStyle = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: '#8BA8B5',
  marginBottom: '8px',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
};

export default function Dashboard() {
  const { user, token } = useAuth();
  const [courses, setCourses] = useState([]);
  const [availableCourses, setAvailableCourses] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(null);
  const [activeTab, setActiveTab] = useState('courses');
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [profileForm, setProfileForm] = useState({});
  const [uploadingCert, setUploadingCert] = useState(false);
  const [subDuration, setSubDuration] = useState('mensile');
  const [courseTab, setCourseTab] = useState('fitness');

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const [myCoursesRes, allCoursesRes, plansRes, profileRes] = await Promise.all([
        fetch('/api/user/courses', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/courses'),
        fetch('/api/plans'),
        fetch('/api/user/profile', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const myCourses = await myCoursesRes.json();
      const allCourses = await allCoursesRes.json();
      const plansData = await plansRes.json();
      const profileData = await profileRes.json();
      setCourses(myCourses || []);
      setAvailableCourses(allCourses || []);
      setPlans(plansData || []);
      setProfile(profileData);
      setProfileForm(profileData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const enroll = async (courseId) => {
    setEnrolling(courseId);
    try {
      const res = await fetch('/api/user/courses/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ course_id: courseId }),
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setEnrolling(null);
    }
  };

  const handlePayment = async (method, planId, amount, duration = 'mensile') => {
    try {
      const res = await fetch(`/api/${method === 'paypal' ? 'paypal' : 'stripe'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount, planId, duration }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Pagamento ${method === 'paypal' ? 'PayPal' : 'Stripe'} simulato! Stato: ${data.status}`);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const saveProfile = async () => {
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(profileForm),
      });
      if (res.ok) {
        setEditing(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const uploadCertificate = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingCert(true);
    try {
      const formData = new FormData();
      formData.append('certificate', file);
      const res = await fetch('/api/user/certificate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        alert('Certificato caricato con successo!');
        fetchData();
      } else {
        alert('Errore nel caricamento del certificato');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingCert(false);
    }
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
            Ciao, {user?.name}! 👋
          </h1>
          <p style={{ fontSize: '1rem', color: '#8BA8B5' }}>Benvenuto nella tua area personale</p>
        </motion.div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'rgba(15,30,53,0.8)', border: '1px solid rgba(62,201,192,0.15)', borderRadius: '50px', padding: '6px', width: 'fit-content' }}>
          {['courses', 'profile', 'plans'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 24px',
                borderRadius: '50px',
                border: 'none',
                background: activeTab === tab ? '#3EC9C0' : 'transparent',
                color: activeTab === tab ? '#0A1628' : '#8BA8B5',
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {tab === 'courses' ? 'I miei corsi' : tab === 'profile' ? 'Profilo' : 'Abbonamenti'}
            </button>
          ))}
        </div>

        {activeTab === 'courses' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ marginBottom: '20px', display: 'flex', gap: '8px', background: 'rgba(15,30,53,0.6)', borderRadius: '50px', padding: '4px', width: 'fit-content' }}>
              {['fitness', 'piscina'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setCourseTab(tab)}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '50px',
                    border: 'none',
                    background: courseTab === tab ? '#3EC9C0' : 'transparent',
                    color: courseTab === tab ? '#0A1628' : '#8BA8B5',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  {tab === 'fitness' ? '🏋️ Sala Fitness' : '🏊 Piscina'}
                </button>
              ))}
            </div>
            <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid rgba(62,201,192,0.15)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
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
                      <td style={{ padding: '10px', textAlign: 'center', color: '#8BA8B5', fontWeight: 600, fontSize: '0.8rem' }}>{hour}</td>
                      {[0,1,2,3,4,5].map(dayIdx => {
                        const course = availableCourses.find(c => c.day === dayIdx && c.time === hour && (courseTab === 'fitness' ? c.category !== 'Piscina' : c.category === 'Piscina'));
                        const isEnrolled = courses.some(c => c.id === course?.id);
                        const pillColor = course?.color || '#3EC9C0';
                        return (
                          <td key={dayIdx} style={{ padding: '8px', textAlign: 'center' }}>
                            {course ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                <motion.span
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => !isEnrolled && enroll(course.id)}
                                  style={{ 
                                    display: 'inline-block', 
                                    padding: '6px 12px', 
                                    borderRadius: '8px', 
                                    fontSize: '0.75rem', 
                                    fontWeight: 600, 
                                    background: isEnrolled ? `${pillColor}` : `${pillColor}22`, 
                                    color: isEnrolled ? '#0A1628' : pillColor,
                                    cursor: isEnrolled ? 'default' : 'pointer',
                                    border: isEnrolled ? 'none' : `1px solid ${pillColor}44`,
                                  }}
                                >
                                  {course.name}
                                </motion.span>
                                {isEnrolled && (
                                  <span style={{ fontSize: '0.65rem', color: '#3EC9C0' }}>✓ Iscritto</span>
                                )}
                              </div>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: '16px', fontSize: '0.85rem', color: '#8BA8B5' }}>Clicca su un corso per iscriverti</p>
          </motion.div>
        )}

        {activeTab === 'profile' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ background: '#0F1E35', borderRadius: '20px', padding: '32px', border: '1px solid rgba(62,201,192,0.15)', maxWidth: '600px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', fontWeight: 700, color: 'white' }}>Il tuo profilo</h2>
                <button onClick={() => editing ? saveProfile() : setEditing(true)} style={{ padding: '10px 20px', borderRadius: '50px', border: 'none', background: '#3EC9C0', color: '#0A1628', fontWeight: 700, cursor: 'pointer' }}>
                  {editing ? 'Salva' : 'Modifica'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Nome</label>
                  {editing ? (
                    <input type="text" value={profileForm.name || ''} onChange={(e) => setProfileForm({...profileForm, name: e.target.value})} style={inputStyle} />
                  ) : (
                    <p style={{ color: 'white', fontSize: '0.95rem' }}>{profile?.name || '-'}</p>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Cognome</label>
                  {editing ? (
                    <input type="text" value={profileForm.surname || ''} onChange={(e) => setProfileForm({...profileForm, surname: e.target.value})} style={inputStyle} />
                  ) : (
                    <p style={{ color: 'white', fontSize: '0.95rem' }}>{profile?.surname || '-'}</p>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <p style={{ color: 'white', fontSize: '0.95rem' }}>{profile?.email}</p>
                </div>
                <div>
                  <label style={labelStyle}>Cellulare</label>
                  {editing ? (
                    <input type="tel" value={profileForm.phone || ''} onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})} style={inputStyle} placeholder="Inserisci numero cellulare" />
                  ) : (
                    <p style={{ color: 'white', fontSize: '0.95rem' }}>{profile?.phone || '-'}</p>
                  )}
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Indirizzo</label>
                  {editing ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '12px' }}>
                      <input type="text" value={profileForm.via || ''} onChange={(e) => setProfileForm({...profileForm, via: e.target.value})} style={{ ...inputStyle, gridColumn: '1 / 2' }} placeholder="Via" />
                      <input type="text" value={profileForm.numero || ''} onChange={(e) => setProfileForm({...profileForm, numero: e.target.value})} style={{ ...inputStyle, gridColumn: '2 / 3' }} placeholder="N." />
                      <input type="text" value={profileForm.cap || ''} onChange={(e) => setProfileForm({...profileForm, cap: e.target.value})} style={{ ...inputStyle, gridColumn: '3 / 4' }} placeholder="CAP" />
                      <input type="text" value={profileForm.città || ''} onChange={(e) => setProfileForm({...profileForm, città: e.target.value})} style={{ ...inputStyle, gridColumn: '4 / 5' }} placeholder="Città" />
                    </div>
                  ) : (
                    <p style={{ color: 'white', fontSize: '0.95rem' }}>
                      {profile?.via ? `${profile.via}, ${profile.numero}, ${profile.cap} ${profile.città}` : '-'}
                    </p>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Provincia</label>
                  {editing ? (
                    <input type="text" value={profileForm.provincia || ''} onChange={(e) => setProfileForm({...profileForm, provincia: e.target.value})} style={inputStyle} placeholder="Provincia" />
                  ) : (
                    <p style={{ color: 'white', fontSize: '0.95rem' }}>{profile?.provincia || '-'}</p>
                  )}
                </div>
              </div>

              <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', fontWeight: 700, color: 'white', marginBottom: '16px' }}>Certificato medico di idoneità sportiva</h3>
                {profile?.medical_certificate ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ color: '#3EC9C0', fontSize: '1.2rem' }}>✓</span>
                    <span style={{ color: 'white', fontSize: '0.95rem' }}>Certificato caricato</span>
                  </div>
                ) : (
                  <p style={{ color: '#8BA8B5', fontSize: '0.9rem', marginBottom: '12px' }}>Non hai ancora caricato il certificato.</p>
                )}
                <label style={{ display: 'inline-block', padding: '12px 24px', borderRadius: '50px', border: '1px solid #3EC9C0', background: 'transparent', color: '#3EC9C0', fontWeight: 600, cursor: 'pointer' }}>
                  {uploadingCert ? 'Caricamento...' : profile?.medical_certificate ? 'Sostituisci certificato' : 'Carica certificato'}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={uploadCertificate} disabled={uploadingCert} style={{ display: 'none' }} />
                </label>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'plans' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ background: '#0F1E35', borderRadius: '20px', padding: '28px', border: '1px solid rgba(62,201,192,0.15)' }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', fontWeight: 700, color: 'white', marginBottom: '20px' }}>Abbonamenti</h2>
              {profile?.subscription_plan_id && (
                <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(62,201,192,0.1)', borderRadius: '12px' }}>
                  <p style={{ color: '#3EC9C0', fontWeight: 600 }}>Abbonamento attivo</p>
                  <p style={{ color: 'white', marginTop: '4px' }}>
                    {plans.find(p => p.id === profile.subscription_plan_id)?.name || 'Piano'} 
                    {profile.subscription_end && ` - Scadenza: ${new Date(profile.subscription_end).toLocaleDateString('it-IT')}`}
                  </p>
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
                {['mensile', 'trimestrale', 'semestrale', 'annuale'].map((d) => (
                  <button
                    key={d}
                    onClick={() => setSubDuration(d)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '50px',
                      border: subDuration === d ? 'none' : '1px solid rgba(62,201,192,0.3)',
                      background: subDuration === d ? '#3EC9C0' : 'transparent',
                      color: subDuration === d ? '#0A1628' : '#8BA8B5',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    {d === 'mensile' ? 'Mensile' : d === 'trimestrale' ? 'Trimestrale' : d === 'semestrale' ? 'Semestrale' : 'Annuale'}
                  </button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                {plans.map((plan, i) => (
                  <div key={i} style={{ padding: '20px', background: 'rgba(15,30,53,0.6)', borderRadius: '16px', textAlign: 'center', border: profile?.subscription_plan_id === plan.id ? '1px solid #3EC9C0' : '1px solid rgba(62,201,192,0.12)' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#3EC9C0', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>{plan.name}</div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '2rem', fontWeight: 900, color: 'white' }}>
                      €{subDuration === 'mensile' ? plan.mensile : subDuration === 'trimestrale' ? Math.round(plan.trimestrale/3) : subDuration === 'semestrale' ? Math.round(plan.semestrale/6) : Math.round(plan.annuale/12)}
                      <span style={{ fontSize: '0.9rem', fontWeight: 400, color: '#8BA8B5' }}>/mese</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#3EC9C0', marginBottom: '12px' }}>
                      Totale: €{subDuration === 'mensile' ? plan.mensile : subDuration === 'trimestrale' ? plan.trimestrale : subDuration === 'semestrale' ? plan.semestrale : plan.annuale}
                      {subDuration === 'trimestrale' && <span style={{ marginLeft: '4px' }}>(-10%)</span>}
                      {subDuration === 'semestrale' && <span style={{ marginLeft: '4px' }}>(-15%)</span>}
                      {subDuration === 'annuale' && <span style={{ marginLeft: '4px' }}>(-20%)</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button onClick={() => handlePayment('paypal', plan.id, subDuration === 'mensile' ? plan.mensile : subDuration === 'trimestrale' ? plan.trimestrale : subDuration === 'semestrale' ? plan.semestrale : plan.annuale, subDuration)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(62,201,192,0.3)', background: 'transparent', color: '#3EC9C0', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>PayPal</button>
                      <button onClick={() => handlePayment('stripe', plan.id, subDuration === 'mensile' ? plan.mensile : subDuration === 'trimestrale' ? plan.trimestrale : subDuration === 'semestrale' ? plan.semestrale : plan.annuale, subDuration)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(62,201,192,0.3)', background: 'transparent', color: '#3EC9C0', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Stripe</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}