import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      login(data.token, data.user);
      navigate(data.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '100px 24px',
        background: 'radial-gradient(ellipse 80% 60% at 60% 40%, rgba(62,201,192,0.12) 0%, transparent 70%), linear-gradient(135deg, #0A1628 0%, #0F1E35 100%)',
      }}
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '48px 40px',
          borderRadius: '24px',
          background: 'rgba(15,30,53,0.8)',
          border: '1px solid rgba(62,201,192,0.2)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px', textDecoration: 'none' }}>
          <svg width="42" height="42" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="40" fill="white"/>
            <path d="M40 15 C40 15 22 34 22 46 C22 56 30 64 40 64 C50 64 58 56 58 46 C58 34 40 15 40 15Z" fill="#3EC9C0" opacity="0.85"/>
            <circle cx="40" cy="28" r="7" fill="#29A89F"/>
            <path d="M30 48 Q40 38 50 48" stroke="#29A89F" strokeWidth="3" fill="none"/>
          </svg>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--white)' }}>
            Eden Fitness & Spa
          </div>
        </Link>

        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700, color: 'var(--white)', marginBottom: '8px' }}>
          Bentornato
        </h1>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '32px' }}>
          Accedi al tuo account
        </p>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ background: 'rgba(226,61,40,0.15)', border: '1px solid rgba(226,61,40,0.3)', borderRadius: '12px', padding: '12px 16px', marginBottom: '24px' }}
          >
            <span style={{ color: 'var(--red-eden)', fontSize: '0.85rem' }}>{error}</span>
          </motion.div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '14px 18px',
                borderRadius: '12px',
                border: '1px solid rgba(62,201,192,0.2)',
                background: 'rgba(10,22,40,0.6)',
                color: 'var(--white)',
                fontSize: '0.95rem',
                outline: 'none',
                transition: 'border-color 0.3s',
              }}
              placeholder="tua@email.com"
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '14px 18px',
                borderRadius: '12px',
                border: '1px solid rgba(62,201,192,0.2)',
                background: 'rgba(10,22,40,0.6)',
                color: 'var(--white)',
                fontSize: '0.95rem',
                outline: 'none',
                transition: 'border-color 0.3s',
              }}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Accesso in corso...' : 'Accedi'}
          </button>
        </form>

        <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Non hai un account?{' '}
          <Link to="/register" style={{ color: 'var(--teal)', fontWeight: 600 }}>Registrati</Link>
        </p>

        <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Credenziali admin demo:<br />
            <code style={{ background: 'rgba(62,201,192,0.1)', padding: '2px 8px', borderRadius: '4px', color: 'var(--teal)' }}>admin@eden.local</code> / <code style={{ background: 'rgba(62,201,192,0.1)', padding: '2px 8px', borderRadius: '4px', color: 'var(--teal)' }}>admin</code>
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
