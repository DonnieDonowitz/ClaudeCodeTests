import { motion } from 'framer-motion';

export default function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      style={{
        background: 'rgba(5,12,25,0.98)',
        borderTop: '1px solid rgba(62,201,192,0.1)',
        padding: '50px 0 30px',
        marginTop: 'auto',
      }}
    >
      <div className="container" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '40px', marginBottom: '40px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
            <svg width="36" height="36" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="40" fill="white"/>
              <path d="M40 15 C40 15 22 34 22 46 C22 56 30 64 40 64 C50 64 58 56 58 46 C58 34 40 15 40 15Z" fill="#3EC9C0" opacity="0.85"/>
              <circle cx="40" cy="28" r="7" fill="#29A89F"/>
              <path d="M30 48 Q40 38 50 48" stroke="#29A89F" strokeWidth="3" fill="none"/>
            </svg>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--white)' }}>Eden Fitness & Spa</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Il tempio del benessere a Fano. Palestra, piscina e spa d'eccellenza.
          </p>
        </div>
        
        <div>
          <h5 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '18px' }}>Servizi</h5>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <li><a href="#servizi" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', transition: 'color 0.3s' }}>Palestra</a></li>
            <li><a href="#servizi" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', transition: 'color 0.3s' }}>Piscina</a></li>
            <li><a href="#servizi" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', transition: 'color 0.3s' }}>Spa</a></li>
          </ul>
        </div>
        
        <div>
          <h5 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '18px' }}>Info</h5>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <li><a href="#corsi" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', transition: 'color 0.3s' }}>Orari Corsi</a></li>
            <li><a href="#abbonamenti" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', transition: 'color 0.3s' }}>Abbonamenti</a></li>
            <li><a href="#contatti" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', transition: 'color 0.3s' }}>Contatti</a></li>
          </ul>
        </div>
        
        <div>
          <h5 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '18px' }}>Legal</h5>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <li><a href="/privacy.html" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', transition: 'color 0.3s' }}>Privacy Policy</a></li>
            <li><a href="/cookie-policy.html" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', transition: 'color 0.3s' }}>Cookie Policy</a></li>
          </ul>
        </div>
      </div>
      
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: '0.78rem', color: 'rgba(139,168,181,0.6)' }}>&copy; 2026 Eden Fitness & Spa. Tutti i diritti riservati.</p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <a href="#" style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(62,201,192,0.1)', border: '1px solid rgba(62,201,192,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--teal)', transition: 'all 0.3s' }}>📷</a>
          <a href="#" style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(62,201,192,0.1)', border: '1px solid rgba(62,201,192,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--teal)', transition: 'all 0.3s' }}>📘</a>
        </div>
      </div>
    </motion.footer>
  );
}
