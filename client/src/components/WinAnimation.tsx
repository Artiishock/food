/* Neo-Brutalist Street Food Aesthetic - Win Animation
 * Design: Explosive burst effect with geometric particles
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface WinAnimationProps {
  show: boolean;
  amount: number;
  onComplete?: () => void;
}

export default function WinAnimation({ show, amount, onComplete }: WinAnimationProps) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; rotation: number }>>([]);

  useEffect(() => {
    if (show) {
      // Generate random particles
      const newParticles = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 400,
        y: (Math.random() - 0.5) * 400,
        rotation: Math.random() * 360
      }));
      setParticles(newParticles);

      // Auto-complete after animation
      const timer = setTimeout(() => {
        onComplete?.();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Particles */}
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute w-8 h-8 brutalist-border"
              style={{
                backgroundColor: ['#ff3838', '#ffd700', '#00ff88'][Math.floor(Math.random() * 3)]
              }}
              initial={{ x: 0, y: 0, scale: 0, rotate: 0 }}
              animate={{
                x: particle.x,
                y: particle.y,
                scale: [0, 1.5, 0],
                rotate: particle.rotation
              }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
            />
          ))}

          {/* Win Amount */}
          <motion.div
            className="brutalist-border-thick bg-white px-12 py-8 brutalist-shadow"
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 10 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          >
            <div className="text-brutalist text-6xl" style={{ color: '#ff3838' }}>
              WIN!
            </div>
            <div className="text-brutalist text-4xl mt-2" style={{ color: '#ffd700' }}>
              ${amount.toFixed(2)}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
