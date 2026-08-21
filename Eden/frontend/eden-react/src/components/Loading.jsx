import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function LoadingScreen({ children }) {
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLoader(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <AnimatePresence>
        {showLoader && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'var(--dark)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
            }}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{ marginBottom: '32px' }}
            >
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="40" fill="white"/>
                <path
                  d="M40 15 C40 15 22 34 22 46 C22 56 30 64 40 64 C50 64 58 56 58 46 C58 34 40 15 40 15Z"
                  fill="#3EC9C0"
                  opacity="0.85"
                />
                <motion.circle
                  cx="40"
                  cy="28"
                  r="7"
                  fill="#29A89F"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                <path
                  d="M30 48 Q40 38 50 48"
                  stroke="#29A89F"
                  strokeWidth="3"
                  fill="none"
                />
              </svg>
            </motion.div>
            
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: 200 }}
              transition={{ duration: 1.5, ease: 'easeInOut' }}
              style={{
                height: '3px',
                background: 'linear-gradient(90deg, var(--teal), var(--teal-light), var(--teal))',
                borderRadius: '2px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <motion.div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                }}
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            </motion.div>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              style={{
                marginTop: '24px',
                fontSize: '0.85rem',
                color: 'var(--teal)',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
              }}
            >
              Eden Fitness & Spa
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
      {!showLoader && children}
    </>
  );
}

export function PageLoader() {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
    }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(62,201,192,0.2)',
          borderTopColor: 'var(--teal)',
          borderRadius: '50%',
        }}
      />
    </div>
  );
}
