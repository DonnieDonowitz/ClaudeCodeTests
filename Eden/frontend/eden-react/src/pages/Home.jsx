import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function Home() {
  const [activeTab, setActiveTab] = useState('fitness');
  const [subDuration, setSubDuration] = useState('mensile');
  const [showCookieBanner, setShowCookieBanner] = useState(false);
  const [plans, setPlans] = useState([]);
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    const hasConsent = document.cookie.includes('gdpr_consent=true');
    if (!hasConsent) setShowCookieBanner(true);
    
    fetch('/api/plans')
      .then(res => res.json())
      .then(data => {
        const defaultFeatures = {
          'Palestra': [
            { check: true, text: 'Sala pesi illimitata' },
            { check: true, text: 'Area cardio' },
            { check: true, text: 'Spogliatoi e docce' },
            { check: true, text: '1 consulenza con trainer' },
            { check: false, text: 'Accesso piscina' },
            { check: false, text: 'Accesso Spa' },
            { check: false, text: 'Corsi di gruppo' },
          ],
          'Palestra + Corsi': [
            { check: true, text: 'Tutto del piano Palestra' },
            { check: true, text: 'Tutti i corsi fitness' },
            { check: true, text: 'Pilates, Yoga, TRX, GAG…' },
            { check: true, text: 'Prenotazione online' },
            { check: true, text: 'Trainer dedicato' },
            { check: false, text: 'Accesso piscina' },
            { check: false, text: 'Accesso Spa' },
          ],
          'Full Access': [
            { check: true, text: 'Tutto del piano precedente' },
            { check: true, text: 'Accesso piscina illimitato' },
            { check: true, text: 'Corsi acqua (Acquagym, Bike…)' },
            { check: true, text: 'Scuola nuoto bimbi inclusa' },
            { check: true, text: 'App di prenotazione' },
            { check: false, text: 'Accesso Spa' },
            { check: false, text: 'Trattamenti Spa' },
          ],
          'Eden Total': [
            { check: true, text: 'Tutto di Full Access' },
            { check: true, text: 'Accesso Spa illimitato' },
            { check: true, text: 'Sauna e idromassaggio' },
            { check: true, text: '2 trattamenti/mese' },
            { check: true, text: 'Massaggi rigeneranti' },
          ],
        };
        const plansWithFeatures = data.map(p => ({
          ...p,
          featured: p.name === 'Palestra + Corsi',
          gold: p.name === 'Eden Total',
          features: defaultFeatures[p.name] || [],
        }));
        setPlans(plansWithFeatures);
      })
      .catch(err => console.error(err));
    
    fetch('/api/courses')
      .then(res => res.json())
      .then(data => setCourses(data))
      .catch(err => console.error(err));
  }, []);

  const getPrice = (plan) => {
    if (subDuration === 'annuale') return plan.annuale;
    return plan.mensile;
  };

  const setCookieConsent = (accept) => {
    const d = new Date();
    d.setTime(d.getTime() + 365 * 24 * 60 * 60 * 1000);
    document.cookie = `gdpr_consent=${accept ? 'true' : 'false'};expires=${d.toUTCString()};path=/`;
    setShowCookieBanner(false);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const days = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  const allHours = ['09:00', '09:50', '10:00', '13:30', '15:30', '16:00', '17:00', '17:30', '18:00', '18:20', '19:10'];
  
  const filteredCourses = courses.filter(c => 
    activeTab === 'fitness' ? c.category !== 'Piscina' : c.category === 'Piscina'
  );
  
  const getCourseFor = (dayIdx, hour) => {
    return filteredCourses.find(c => c.day === dayIdx && c.time === hour) || null;
  };

  const plansData = plans.length > 0 ? plans : [
    { name: 'Palestra', mensile: 60, trimestrale: 162, semestrale: 306, annuale: 576, featured: false, features: [] },
    { name: 'Palestra + Corsi', mensile: 75, trimestrale: 203, semestrale: 383, annuale: 720, featured: true, features: [] },
    { name: 'Full Access', mensile: 95, trimestrale: 257, semestrale: 485, annuale: 912, featured: false, features: [] },
    { name: 'Eden Total ✨', mensile: 120, trimestrale: 324, semestrale: 612, annuale: 1152, featured: false, gold: true, features: [] },
  ];

  const getPillColor = (course, dayIdx) => {
    if (!course) return '#8BA8B5';
    if (course.color) return course.color;
    const courseName = typeof course === 'string' ? course : course.name;
    const greenCourses = ['Pilates'];
    const purpleCourses = ['Medical Wellness', 'Funzionale'];
    const pinkCourses = ['Posturale'];
    const yellowCourses = ['TRX'];
    const redCourses = ['GAG'];
    const cyanCourses = ['Total Body'];
    const blueCourses = ['Silent Yoga', 'Acquagym', 'Aquabike'];
    if (greenCourses.includes(courseName)) return '#3EC9C0';
    if (blueCourses.includes(courseName)) return '#80B8F0';
    if (purpleCourses.includes(courseName)) return '#C090E0';
    if (pinkCourses.includes(courseName)) return '#FF8FA0';
    if (yellowCourses.includes(courseName)) return '#F0D080';
    if (redCourses.includes(courseName)) return '#E07070';
    if (cyanCourses.includes(courseName)) return '#70D0D0';
    const colors = ['#3EC9C0', '#80B8F0', '#C090E0', '#FF8FA0'];
    return colors[dayIdx % 4];
  };

  return (
    <div>
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="leaf"
          style={{
            position: 'absolute',
            top: 0,
            left: `${10 + i * 20}%`,
            width: '24px',
            height: '24px',
            opacity: 0,
            zIndex: 1,
            pointerEvents: 'none',
          }}
          animate={{
            y: ['-60px', '100vh'],
            rotate: [0, 360],
            opacity: [0, 0.6, 0.6, 0],
          }}
          transition={{
            duration: 9 + i,
            repeat: Infinity,
            ease: 'linear',
            delay: i * 2,
          }}
        >
          <svg viewBox="0 0 24 24" fill="rgba(62,201,192,0.25)">
            <path d="M12 2C8 6 4 10 4 14c0 4 3 8 8 8s8-4 8-8c0-4-4-8-8-12z" />
          </svg>
        </motion.div>
      ))}
      <AnimatePresence>
        {showCookieBanner && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0F1E35', borderTop: '1px solid #3EC9C0', padding: '20px', zIndex: 2000 }}
          >
            <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '280px' }}>
                <h4 style={{ color: '#3EC9C0', margin: '0 0 8px' }}>Cookie & Privacy</h4>
                <p style={{ fontSize: '0.85rem', color: '#8BA8B5', margin: 0 }}>Utilizziamo cookie tecnici e, previo consenso, cookie analitici.</p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setCookieConsent(false)} style={{ padding: '10px 20px', borderRadius: '50px', border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: 'white', cursor: 'pointer' }}>Rifiuta</button>
                <button onClick={() => setCookieConsent(true)} style={{ padding: '10px 20px', borderRadius: '50px', border: 'none', background: '#3EC9C0', color: '#0A1628', fontWeight: 700, cursor: 'pointer' }}>Accetta</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.section
        id="home"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        style={{ minHeight: '100vh', paddingTop: '76px', background: '#0A1628' }}
      >
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '80px 48px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'center' }}>
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(62,201,192,0.12)', border: '1px solid rgba(62,201,192,0.3)', borderRadius: '50px', padding: '8px 18px', fontSize: '0.75rem', fontWeight: 600, color: '#3EC9C0', letterSpacing: '0.12em', marginBottom: '28px' }}
            >
              <motion.span
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ width: '7px', height: '7px', background: '#3EC9C0', borderRadius: '50%', display: 'inline-block' }}
              />
              Palestra · Piscina · Spa
            </motion.div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(3rem, 5vw, 5.5rem)', fontWeight: 900, lineHeight: 1, marginBottom: '12px' }}>
              <motion.span
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                style={{ display: 'block', color: 'white' }}
              >
                Cedi alla
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                style={{ display: 'block', color: '#3EC9C0', fontStyle: 'italic' }}
              >
                tentazione
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                style={{ display: 'block', color: '#C9A84C' }}
              >
                del benessere.
              </motion.span>
            </h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              style={{ fontSize: '1.05rem', color: 'rgba(245,249,248,0.65)', marginBottom: '40px', lineHeight: 1.6 }}
            >
              Nel cuore di Fano, un luogo dove <strong style={{ color: '#E8C97A' }}>corpo e mente si incontrano</strong>. Palestra all'avanguardia, piscina rigenerante e spa esclusiva.
            </motion.p>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}
            >
              <motion.a
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                href="#abbonamenti"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#3EC9C0', color: '#0A1628', padding: '16px 32px', borderRadius: '50px', fontWeight: 700, textDecoration: 'none' }}
              >
                Inizia ora
              </motion.a>
              <motion.a
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                href="#corsi"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'transparent', color: 'white', padding: '16px 32px', borderRadius: '50px', fontWeight: 600, border: '1px solid rgba(255,255,255,0.3)', textDecoration: 'none' }}
              >
                Scopri i corsi →
              </motion.a>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              style={{ display: 'flex', gap: '36px', marginTop: '52px', paddingTop: '36px', borderTop: '1px solid rgba(255,255,255,0.1)' }}
            >
              {[
                { num: '1726', label: 'Follower' },
                { num: '3', label: 'Strutture' },
                { num: '20+', label: 'Corsi/sett.' },
                { num: '∞', label: 'Benessere' },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 + i * 0.1 }}
                  style={{ textAlign: 'left' }}
                >
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.2rem', fontWeight: 700, color: '#3EC9C0', lineHeight: 1 }}>{stat.num}</div>
                  <div style={{ fontSize: '0.78rem', color: '#8BA8B5', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '4px' }}>{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              style={{ width: '360px', height: '440px', borderRadius: '24px', background: 'linear-gradient(145deg,rgba(62,201,192,0.15),rgba(10,30,50,0.98))', border: '1px solid rgba(62,201,192,0.25)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="200" height="200" viewBox="0 0 280 280">
                <motion.rect
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                  x="40" y="140" width="200" height="120" rx="4" fill="rgba(62,201,192,0.08)" stroke="rgba(62,201,192,0.3)"
                />
                <motion.text
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2 }}
                  x="140" y="105" textAnchor="middle" fontFamily="Playfair Display,serif" fontSize="24" fill="rgba(62,201,192,0.8)"
                >
                  EDEN
                </motion.text>
              </svg>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.4 }}
                style={{ marginTop: '24px', textAlign: 'center' }}
              >
                <div style={{ color: '#3EC9C0', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Fano, Pesaro-Urbino</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', fontWeight: 700, color: 'white' }}>È tutto qui</div>
              </motion.div>
            </motion.div>
            <motion.div
              animate={{ y: [0, -15, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
              style={{ position: 'absolute', top: '60px', right: '-20px', width: '140px', padding: '16px', borderRadius: '16px', background: 'rgba(15,30,53,0.9)', border: '1px solid rgba(62,201,192,0.2)' }}
            >
              <div style={{ fontSize: '0.65rem', color: '#3EC9C0', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Palestra</div>
              <div style={{ fontSize: '0.85rem', color: 'white', fontWeight: 600 }}>Aperta</div>
              <div style={{ fontSize: '0.7rem', color: '#8BA8B5' }}>06:00 - 23:00</div>
            </motion.div>
            <motion.div
              animate={{ y: [0, -20, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              style={{ position: 'absolute', bottom: '40px', left: '-40px', width: '140px', padding: '16px', borderRadius: '16px', background: 'rgba(15,30,53,0.9)', border: '1px solid rgba(62,201,192,0.2)' }}
            >
              <div style={{ fontSize: '0.65rem', color: '#3EC9C0', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Piscina</div>
              <div style={{ fontSize: '0.85rem', color: 'white', fontWeight: 600 }}>Acqua calda</div>
              <div style={{ fontSize: '0.7rem', color: '#8BA8B5' }}>28° costante</div>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      <motion.section
        id="servizi"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.8 }}
        style={{ background: '#0F1E35', padding: '100px 0', position: 'relative' }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, #3EC9C0, transparent)' }} />
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 48px' }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ textAlign: 'center', marginBottom: '70px' }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3EC9C0', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '14px' }}>I nostri servizi</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(2rem, 3.5vw, 3.2rem)', fontWeight: 700, color: 'white', marginBottom: '16px' }}>Un equilibrio perfetto tra <em style={{ color: '#3EC9C0', fontStyle: 'italic' }}>corpo e mente</em></h2>
          </motion.div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '28px' }}>
            {[
              { name: 'Palestra', desc: 'Attrezzature all\'avanguardia, spazi ampi e istruttori qualificati.', tag: 'Sala pesi · Cardio · Functional', icon: '🏋️' },
              { name: 'Piscina', desc: 'Nuota in un ambiente tranquillo con luci cromoterapiche.', tag: 'Aquagym · Nuoto · Corsi bimbi', icon: '🏊' },
              { name: 'Spa', desc: 'Trattamenti rigeneranti per corpo e mente.', tag: 'Sauna · Massaggi · Idromassaggio', icon: '🌿' },
            ].map((service, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                whileHover={{ y: -8 }}
                style={{ borderRadius: '24px', overflow: 'hidden', position: 'relative', height: '420px', cursor: 'pointer', background: i === 0 ? 'linear-gradient(160deg, #1a2a1a 0%, #0d1e0d 100%)' : i === 1 ? 'linear-gradient(160deg, #0a1a2e 0%, #051525 100%)' : 'linear-gradient(160deg, #1e1a2e 0%, #120e22 100%)' }}
              >
                <div style={{ position: 'absolute', top: '36px', left: '36px', width: '64px', height: '64px', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', background: i === 0 ? 'rgba(62,201,192,0.2)' : i === 1 ? 'rgba(62,140,201,0.2)' : 'rgba(201,168,76,0.2)' }}>
                  {service.icon}
                </div>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '36px', background: 'linear-gradient(transparent, rgba(5,10,20,0.97) 60%)' }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.7rem', fontWeight: 700, color: 'white', marginBottom: '8px' }}>{service.name}</div>
                  <div style={{ fontSize: '0.88rem', color: 'rgba(245,249,248,0.65)', marginBottom: '18px' }}>{service.desc}</div>
                  <span style={{ display: 'inline-block', padding: '5px 14px', borderRadius: '50px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', background: i === 0 ? 'rgba(62,201,192,0.2)' : i === 1 ? 'rgba(62,140,201,0.2)' : 'rgba(201,168,76,0.2)', color: i === 0 ? '#3EC9C0' : i === 1 ? '#5AACDB' : '#E8C97A' }}>
                    {service.tag}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Perché scegliere Eden */}
      <motion.section
        id="perche"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.8 }}
        style={{ background: '#0A1628', padding: '100px 0' }}
      >
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 48px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'center' }}>
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div style={{ background: 'linear-gradient(145deg, rgba(62,201,192,0.1), rgba(10,22,40,0.8))', borderRadius: '24px', border: '1px solid rgba(62,201,192,0.15)', padding: '40px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', fontWeight: 700, color: 'white', lineHeight: 1.3, marginBottom: '20px' }}>
                  "Il giardino dell'Eden non è<br/>una leggenda — è <span style={{ color: '#3EC9C0' }}>qui</span>,<br/>a Fano."
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
                  <div style={{ fontSize: '2rem' }}>🍎</div>
                  <div>
                    <div style={{ fontWeight: 700, color: 'white', fontSize: '0.9rem' }}>Il Giardino dell'Eden</div>
                    <div style={{ fontSize: '0.78rem', color: '#8BA8B5' }}>Fano · Palestra · Piscina · Spa</div>
                  </div>
                </div>
              </div>
            </motion.div>
            <div>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3EC9C0', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '14px' }}>Perché scegliere Eden</div>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(2rem, 3.5vw, 3.2rem)', fontWeight: 700, color: 'white', marginBottom: '16px' }}>Dove ogni giorno<br/>è <em style={{ color: '#3EC9C0', fontStyle: 'italic' }}>paradiso</em></h2>
                <p style={{ fontSize: '1rem', color: '#8BA8B5', marginBottom: '36px', lineHeight: 1.7 }}>Non è solo una palestra. Eden è un'esperienza completa di benessere: dal workout intenso alla spa rigenerante, tutto nello stesso posto.</p>
              </motion.div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {[
                  { icon: '🏋️', title: 'Attrezzature professionali', desc: 'Macchinari di ultima generazione per ogni tipo di allenamento.' },
                  { icon: '🎓', title: 'Istruttori certificati', desc: 'Team di professionisti qualificati che ti seguono in ogni fase.' },
                  { icon: '🌊', title: 'Piscina con cromoterapia', desc: 'Acqua a temperatura ideale e luci cromatiche per il relax.' },
                  { icon: '💆', title: 'Spa & trattamenti esclusivi', desc: 'Sauna, massaggi e rituali benessere per rigenerarti.' },
                  { icon: '📅', title: 'Orari flessibili', desc: 'Corsi dal mattino alla sera, 6 giorni su 7.' },
                ].map((feature, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    style={{ display: 'flex', gap: '16px' }}
                  >
                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(62,201,192,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>{feature.icon}</div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'white', fontSize: '0.95rem', marginBottom: '4px' }}>{feature.title}</div>
                      <div style={{ fontSize: '0.85rem', color: '#8BA8B5', lineHeight: 1.5 }}>{feature.desc}</div>
                    </div>
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Snake Divider */}
      <div style={{ background: '#0F1E35', padding: '40px 0' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 48px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg,transparent,rgba(62,201,192,0.3))' }}></div>
          <svg width="60" height="30" viewBox="0 0 60 30">
            <path d="M5 20 Q15 5 30 20 Q45 35 55 15" stroke="#3EC9C0" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.5">
              <animate attributeName="stroke-dasharray" values="0,100;100,0" dur="2s" repeatCount="indefinite" />
            </path>
            <circle cx="55" cy="13" r="5" fill="#3EC9C0" opacity="0.7" />
          </svg>
          <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg,rgba(62,201,192,0.3),transparent)' }}></div>
        </div>
      </div>

      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.8 }}
        style={{ background: '#0F1E35', padding: '100px 0' }}
      >
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 48px' }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '50px', flexWrap: 'wrap', gap: '20px' }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3EC9C0', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '14px' }}>I nostri corsi</div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(2rem, 3.5vw, 3.2rem)', fontWeight: 700, color: 'white' }}>Trova il tuo <em style={{ color: '#3EC9C0', fontStyle: 'italic' }}>ritmo</em></h2>
            </div>
            <div style={{ display: 'flex', gap: '8px', background: 'rgba(15,30,53,0.8)', border: '1px solid rgba(62,201,192,0.15)', borderRadius: '50px', padding: '6px' }}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveTab('fitness')}
                style={{ padding: '10px 24px', borderRadius: '50px', border: 'none', background: activeTab === 'fitness' ? '#3EC9C0' : 'transparent', color: activeTab === 'fitness' ? '#0A1628' : '#8BA8B5', fontWeight: 600, cursor: 'pointer' }}
              >
                Sala Fitness
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveTab('piscina')}
                style={{ padding: '10px 24px', borderRadius: '50px', border: 'none', background: activeTab === 'piscina' ? '#3EC9C0' : 'transparent', color: activeTab === 'piscina' ? '#0A1628' : '#8BA8B5', fontWeight: 600, cursor: 'pointer' }}
              >
                Piscina
              </motion.button>
            </div>
          </motion.div>
          
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              style={{ overflowX: 'auto', borderRadius: '20px', border: '1px solid rgba(62,201,192,0.15)' }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '780px' }}>
                <thead>
                  <tr>
                    {['Orario', ...days].map((h) => (
                      <th key={h} style={{ background: 'rgba(62,201,192,0.12)', padding: '16px 12px', textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, color: '#3EC9C0', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allHours.map((hour, i) => (
                    <motion.tr
                      key={hour}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <td style={{ padding: '10px', textAlign: 'center', fontSize: '0.8rem', color: '#8BA8B5', fontWeight: 600 }}>{hour}</td>
                      {days.map((day, dayIdx) => {
                        const slot = getCourseFor(dayIdx, hour);
                        const pillColor = getPillColor(slot, dayIdx);
                        return (
                          <td key={dayIdx} style={{ padding: '10px', textAlign: 'center' }}>
                            {slot?.name ? (
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                style={{ display: 'inline-block', padding: '5px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600, background: `${pillColor}33`, color: pillColor }}
                              >
                                {slot.name}
                              </motion.span>
                            ) : null}
                          </td>
                        );
                      })}
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.section>

      <motion.section
        id="abbonamenti"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.8 }}
        style={{ background: '#0A1628', padding: '100px 0', position: 'relative', overflow: 'hidden' }}
      >
        <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '800px', height: '400px', background: 'radial-gradient(ellipse, rgba(62,201,192,0.06), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 48px', textAlign: 'center' }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3EC9C0', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '14px' }}>I nostri abbonamenti</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(2rem, 3.5vw, 3.2rem)', fontWeight: 700, color: 'white', marginBottom: '16px' }}>Scegli il tuo piano <em style={{ color: '#3EC9C0', fontStyle: 'italic' }}>Eden</em></h2>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
              {['mensile', 'trimestrale', 'semestrale', 'annuale'].map((dur) => (
                <span 
                  key={dur}
                  style={{ 
                    fontSize: '0.85rem', 
                    color: subDuration === dur ? '#3EC9C0' : '#8BA8B5', 
                    fontWeight: subDuration === dur ? 700 : 500,
                    padding: '6px 14px',
                    borderRadius: '20px',
                    background: subDuration === dur ? 'rgba(62,201,192,0.15)' : 'transparent',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSubDuration(dur)}
                >
                  {dur === 'mensile' ? 'Mensile' : dur === 'trimestrale' ? 'Trimestrale' : dur === 'semestrale' ? 'Semestrale' : 'Annuale'}
                </span>
              ))}
              {subDuration === 'annuale' && <span style={{ marginLeft: '12px', background: 'rgba(201,168,76,0.2)', color: '#E8C97A', padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Risparmia fino a 121€!</span>}
            </div>
          </motion.div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginTop: '40px' }}>
            {plansData.map((plan, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -6 }}
                style={{ borderRadius: '24px', padding: '32px 24px', border: plan.featured ? '1px solid rgba(62,201,192,0.4)' : plan.gold ? '1px solid rgba(201,168,76,0.3)' : '1px solid rgba(62,201,192,0.12)', background: plan.featured ? 'linear-gradient(145deg, rgba(62,201,192,0.15), rgba(15,30,53,0.95))' : plan.gold ? 'linear-gradient(145deg, rgba(201,168,76,0.12), rgba(15,30,53,0.95))' : 'rgba(15,30,53,0.5)', position: 'relative', transform: plan.featured ? 'translateY(-12px)' : 'none' }}
              >
                {plan.featured && (
                  <motion.div
                    initial={{ rotate: 35, scale: 0 }}
                    animate={{ rotate: 35, scale: 1 }}
                    style={{ position: 'absolute', top: '16px', right: '-28px', background: '#3EC9C0', color: '#0A1628', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', padding: '6px 40px' }}
                  >
                    Più scelto
                  </motion.div>
                )}
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: plan.gold ? '#E8C97A' : '#3EC9C0', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '10px' }}>{plan.name}</div>
                <motion.div
                  style={{ fontFamily: "'Playfair Display', serif", fontSize: '3rem', fontWeight: 900, color: 'white' }}
                >
                  <sup style={{ fontSize: '1.2rem', fontWeight: 700, color: plan.gold ? '#E8C97A' : '#3EC9C0' }}>€</sup>
                  {subDuration === 'annuale' ? plan.annuale : subDuration === 'trimestrale' ? plan.trimestrale : subDuration === 'semestrale' ? plan.semestrale : plan.mensile}
                </motion.div>
                <div style={{ fontSize: '0.8rem', color: '#8BA8B5', marginBottom: '4px' }}>/mese</div>
                {(subDuration === 'annuale' || subDuration === 'trimestrale' || subDuration === 'semestrale') && (
                  <div style={{ fontSize: '0.75rem', color: '#3EC9C0', marginBottom: '18px' }}>
                    Totale: €{subDuration === 'annuale' ? plan.annuale : subDuration === 'trimestrale' ? plan.trimestrale : plan.semestrale}/{subDuration === 'annuale' ? 'anno' : subDuration === 'trimestrale' ? 'trimestre' : 'semestre'}
                  </div>
                )}
                <div style={{ fontSize: '0.82rem', color: '#8BA8B5', marginBottom: '24px' }}>{plan.desc}</div>
                {plan.features && (
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
                    {plan.features.map((f, fi) => (
                      <li key={fi} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.83rem', color: 'rgba(245,249,248,0.8)' }}>
                        <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: f.check ? 'rgba(62,201,192,0.2)' : 'rgba(255,255,255,0.06)', color: f.check ? '#3EC9C0' : 'rgba(255,255,255,0.25)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', flexShrink: 0, fontWeight: 900 }}>{f.check ? '✓' : '✗'}</span>
                        <span>{f.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  style={{ width: '100%', padding: '14px', borderRadius: '14px', border: plan.featured ? 'none' : '1px solid rgba(62,201,192,0.3)', background: plan.featured ? '#3EC9C0' : 'transparent', color: plan.featured ? '#0A1628' : '#3EC9C0', fontWeight: 700, cursor: 'pointer' }}
                >
                  {plan.featured ? 'Inizia' : 'Scegli'}
                </motion.button>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Recensioni */}
      <motion.section
        id="recensioni"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.8 }}
        style={{ background: '#0F1E35', padding: '100px 0' }}
      >
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 48px' }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ textAlign: 'center', marginBottom: '50px' }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3EC9C0', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '14px' }}>Cosa dicono di noi</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(2rem, 3.5vw, 3.2rem)', fontWeight: 700, color: 'white' }}>I nostri <em style={{ color: '#3EC9C0', fontStyle: 'italic' }}>iscritti</em> parlano</h2>
          </motion.div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
            {[
              { text: '"Da quando mi sono iscritta ad Eden ho completamente trasformato il mio stile di vita. La piscina è meravigliosa e la spa è qualcosa di unico."', name: 'Laura C.', since: 'Iscritta da 2 anni', initials: 'LC' },
              { text: '"Gli istruttori sono eccezionali. Ho perso 12 kg in 6 mesi seguendo i corsi di Funzionale e Pilates. Eden è la mia seconda casa!"', name: 'Marco R.', since: 'Iscritto da 1 anno', initials: 'MR', teal: true },
              { text: '"Ho provato altre palestre a Fano ma Eden è in un\'altra categoria. L\'abbonamento annuale vale ogni centesimo, soprattutto con l\'accesso alla spa."', name: 'Sofia F.', since: 'Iscritta da 8 mesi', initials: 'SF', gold: true },
            ].map((review, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                whileHover={{ y: -4 }}
                style={{ background: 'rgba(10,22,40,0.6)', border: '1px solid rgba(62,201,192,0.1)', borderRadius: '20px', padding: '28px', transition: 'border-color 0.3s' }}
              >
                <div style={{ color: '#C9A84C', fontSize: '0.9rem', letterSpacing: '2px', marginBottom: '14px' }}>★★★★★</div>
                <div style={{ fontSize: '0.88rem', color: 'rgba(245,249,248,0.8)', lineHeight: 1.7, fontStyle: 'italic', marginBottom: '20px' }}>{review.text}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: review.teal ? 'linear-gradient(135deg,#3EC9C0,#29A89F)' : review.gold ? 'linear-gradient(135deg,#C9A84C,#E8C97A)' : 'linear-gradient(135deg,#29A89F,#7EDDD8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem', color: '#0A1628' }}>{review.initials}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'white' }}>{review.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#8BA8B5' }}>{review.since}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Contatti */}
      <motion.section
        id="contatti"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.8 }}
        style={{ background: '#0A1628', padding: '100px 0 60px' }}
      >
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 48px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'start' }}>
            <div>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3EC9C0', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '14px' }}>Vieni a trovarci</div>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(2rem, 3.5vw, 3.2rem)', fontWeight: 700, color: 'white', marginBottom: '16px' }}>Il paradiso ti<br/>aspetta a <em style={{ color: '#3EC9C0', fontStyle: 'italic' }}>Fano</em></h2>
                <p style={{ fontSize: '1rem', color: '#8BA8B5', marginBottom: '36px', lineHeight: 1.7 }}>Siamo aperti 6 giorni su 7. Vieni a visitarci o contattaci per info su corsi e abbonamenti.</p>
              </motion.div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '36px' }}>
                {[
                  { icon: '📍', label: 'Indirizzo', value: 'Eden Fitness & Spa · Fano (PU)' },
                  { icon: '📞', label: 'Telefono', value: '0721 825595 / 345 7697344' },
                  { icon: '✉️', label: 'Email', value: 'eden@fitness.it' },
                  { icon: '🕐', label: 'Orari', value: 'Lun–Ven: 09:00 – 21:30 | Sabato: 09:00 – 14:00' },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}
                  >
                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(62,201,192,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>{item.icon}</div>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3EC9C0', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>{item.label}</div>
                      <div style={{ fontSize: '0.95rem', color: 'white' }}>{item.value}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
                <motion.a whileHover={{ scale: 1.05 }} href="#" style={{ padding: '12px 20px', borderRadius: '50px', background: '#3EC9C0', color: '#0A1628', fontWeight: 700, textDecoration: 'none', fontSize: '0.85rem' }}>📱 WhatsApp</motion.a>
                <motion.a whileHover={{ scale: 1.05 }} href="#" style={{ padding: '12px 20px', borderRadius: '50px', background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.3)', fontWeight: 600, textDecoration: 'none', fontSize: '0.85rem' }}>📘 Facebook</motion.a>
                <motion.a whileHover={{ scale: 1.05 }} href="#" style={{ padding: '12px 20px', borderRadius: '50px', background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.3)', fontWeight: 600, textDecoration: 'none', fontSize: '0.85rem' }}>📸 Instagram</motion.a>
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              style={{ background: 'rgba(15,30,53,0.5)', borderRadius: '20px', border: '1px solid rgba(62,201,192,0.15)', padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}
            >
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="21" r="10" stroke="rgba(62,201,192,0.5)" strokeWidth="2"/>
                <path d="M24 11 C17 11 14 16 14 21 C14 28 24 40 24 40 C24 40 34 28 34 21 C34 16 31 11 24 11Z" stroke="rgba(62,201,192,0.4)" strokeWidth="2" fill="rgba(62,201,192,0.1)"/>
                <circle cx="24" cy="21" r="3" fill="rgba(62,201,192,0.6)"/>
              </svg>
              <div style={{ color: '#8BA8B5', fontSize: '0.9rem', marginTop: '16px' }}>Mappa Google Maps</div>
              <div style={{ fontSize: '0.78rem', color: 'rgba(139,168,181,0.5)', marginTop: '4px' }}>Eden Fitness & Spa · Fano</div>
              <motion.a whileHover={{ scale: 1.05 }} href="https://maps.google.com" target="_blank" style={{ marginTop: '16px', padding: '12px 24px', borderRadius: '50px', background: '#3EC9C0', color: '#0A1628', fontWeight: 700, textDecoration: 'none', fontSize: '0.85rem' }}>Apri in Maps →</motion.a>
            </motion.div>
          </div>
        </div>
      </motion.section>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={scrollToTop}
        style={{ position: 'fixed', bottom: '30px', right: '30px', width: '48px', height: '48px', background: '#3EC9C0', borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#0A1628', boxShadow: '0 4px 20px rgba(62,201,192,0.4)' }}
      >
        ↑
      </motion.button>

      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        style={{ background: 'rgba(5,12,25,0.98)', borderTop: '1px solid rgba(62,201,192,0.1)', padding: '60px 0 30px' }}
      >
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 48px', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '40px', marginBottom: '40px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
              <svg width="36" height="36" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="40" fill="white"/>
                <path d="M40 15 C40 15 22 34 22 46 C22 56 30 64 40 64 C50 64 58 56 58 46 C58 34 40 15 40 15Z" fill="#3EC9C0" opacity="0.85"/>
                <circle cx="40" cy="28" r="7" fill="#29A89F"/>
              </svg>
              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.2rem', fontWeight: 700, color: 'white' }}>Eden Fitness & Spa</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#8BA8B5', lineHeight: 1.6, marginBottom: '16px' }}>La tua oasi di benessere nel cuore di Fano. Palestra, piscina e spa per un'esperienza completa di salute e relax.</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ fontSize: '0.72rem', padding: '4px 12px', borderRadius: '20px', background: 'rgba(62,201,192,0.1)', color: '#3EC9C0', border: '1px solid rgba(62,201,192,0.2)' }}>🏋️ Palestra</span>
              <span style={{ fontSize: '0.72rem', padding: '4px 12px', borderRadius: '20px', background: 'rgba(62,140,201,0.1)', color: '#80B8F0', border: '1px solid rgba(62,140,201,0.2)' }}>🏊 Piscina</span>
              <span style={{ fontSize: '0.72rem', padding: '4px 12px', borderRadius: '20px', background: 'rgba(201,168,76,0.1)', color: '#E8C97A', border: '1px solid rgba(201,168,76,0.2)' }}>🌿 Spa</span>
            </div>
          </div>
          <div>
            <h5 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3EC9C0', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '18px' }}>Navigazione</h5>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {['Home', 'Servizi', 'Corsi', 'Abbonamenti', 'Contatti'].map((l) => (
                <li key={l}><a href={`#${l.toLowerCase()}`} style={{ fontSize: '0.85rem', color: '#8BA8B5', textDecoration: 'none' }}>{l}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h5 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3EC9C0', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '18px' }}>Corsi</h5>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {['Pilates', 'Silent Yoga', 'TRX & Funzionale', 'Acquagym', 'Nuoto Bimbi'].map((l) => (
                <li key={l}><a href="#corsi" style={{ fontSize: '0.85rem', color: '#8BA8B5', textDecoration: 'none' }}>{l}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h5 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3EC9C0', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '18px' }}>Contatti</h5>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li><span style={{ fontSize: '0.85rem', color: '#8BA8B5' }}>Eden Fitness & Spa</span></li>
              <li><span style={{ fontSize: '0.85rem', color: '#8BA8B5' }}>Fano (PU)</span></li>
              <li><span style={{ fontSize: '0.85rem', color: '#8BA8B5' }}>0721 825595</span></li>
              <li><span style={{ fontSize: '0.85rem', color: '#8BA8B5' }}>eden@fitness.it</span></li>
            </ul>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '24px', maxWidth: '1280px', margin: '0 auto', padding: '24px 48px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: '0.78rem', color: 'rgba(139,168,181,0.6)' }}>© 2026 Eden Fitness & Spa. Tutti i diritti riservati.</p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <a href="#" style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(62,201,192,0.1)', border: '1px solid rgba(62,201,192,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3EC9C0', textDecoration: 'none' }}>📷</a>
            <a href="#" style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(62,201,192,0.1)', border: '1px solid rgba(62,201,192,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3EC9C0', textDecoration: 'none' }}>📘</a>
          </div>
        </div>
      </motion.footer>
    </div>
  );
}