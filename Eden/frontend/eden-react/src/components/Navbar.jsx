import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const sections = ['home', 'servizi', 'corsi', 'abbonamenti', 'contatti'];
      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 150 && rect.bottom >= 150) {
            setActiveSection(section);
            break;
          }
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isHomePage = location.pathname === '/';

  const handleNavClick = (e, target) => {
    if (isHomePage) {
      e.preventDefault();
      const el = document.getElementById(target);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'servizi', label: 'Servizi' },
    { id: 'corsi', label: 'Corsi' },
    { id: 'abbonamenti', label: 'Abbonamenti' },
    { id: 'contatti', label: 'Contatti' },
  ];

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 48px',
        height: '76px',
        background: scrolled ? 'rgba(10,22,40,0.95)' : 'rgba(10,22,40,0.85)',
        backdropFilter: 'blur(18px)',
        borderBottom: '1px solid rgba(62,201,192,0.15)',
      }}
    >
      <Link to="/" onClick={scrollToTop} style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="34" height="34" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="40" fill="white"/>
            <path d="M40 15 C40 15 22 34 22 46 C22 56 30 64 40 64 C50 64 58 56 58 46 C58 34 40 15 40 15Z" fill="#3EC9C0" opacity="0.85"/>
            <circle cx="40" cy="28" r="7" fill="#29A89F"/>
            <path d="M30 48 Q40 38 50 48" stroke="#29A89F" strokeWidth="3" fill="none"/>
          </svg>
        </div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', fontWeight: 700, color: 'white', lineHeight: 1.1 }}>
          Eden Fitness&Spa
          <span style={{ display: 'block', fontSize: '0.65rem', fontFamily: "'Outfit', sans-serif", fontWeight: 400, color: '#3EC9C0', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Fano · Il Tempio del Benessere</span>
        </div>
      </Link>

      <ul style={{ display: 'flex', alignItems: 'center', gap: '36px', listStyle: 'none' }}>
        {navItems.map((item) => (
          <li key={item.id}>
            {isHomePage ? (
              <a
                href={`#${item.id}`}
                onClick={(e) => handleNavClick(e, item.id)}
                style={{
                  ...navLinkStyle,
                  color: activeSection === item.id ? '#3EC9C0' : 'rgba(245,249,248,0.75)',
                }}
              >
                {item.label}
                <motion.span
                  style={{
                    position: 'absolute',
                    bottom: '-4px',
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: '#3EC9C0',
                    borderRadius: '1px',
                  }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: activeSection === item.id ? 1 : 0 }}
                  transition={{ duration: 0.3 }}
                />
              </a>
            ) : (
              <Link to="/" style={navLinkStyle}>{item.label}</Link>
            )}
          </li>
        ))}
        {user ? (
          <>
            <li>
              <Link to={user.role === 'admin' ? '/admin' : '/dashboard'} style={{ background: '#3EC9C0', color: '#0A1628', padding: '10px 24px', borderRadius: '50px', fontWeight: 700, textDecoration: 'none', fontSize: '0.9rem' }}>
                Area {user.role === 'admin' ? 'Admin' : 'Utente'}
              </Link>
            </li>
            <li>
              <button onClick={logout} style={{ ...navLinkStyle, background: 'none', border: 'none', cursor: 'pointer' }}>Logout</button>
            </li>
          </>
        ) : (
          <li>
            <Link to="/login" style={{ background: '#3EC9C0', color: '#0A1628', padding: '10px 24px', borderRadius: '50px', fontWeight: 700, textDecoration: 'none', fontSize: '0.9rem' }}>Accedi</Link>
          </li>
        )}
      </ul>
    </motion.nav>
  );
}

const navLinkStyle = {
  textDecoration: 'none',
  color: 'rgba(245,249,248,0.75)',
  fontSize: '0.9rem',
  fontWeight: 500,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  transition: 'color 0.3s',
  position: 'relative',
  display: 'inline-block',
};