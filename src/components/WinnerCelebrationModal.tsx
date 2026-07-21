import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';

interface Props {
  catName: string;
  videoUrl: string;
  themeName: string;
  votes: number;
  onClose: () => void;
}

const CONFETTI = Array.from({ length: 55 }, (_, i) => ({
  id: i,
  left: (i * 1.9) % 100,
  color: ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF6BD6', '#FF9A3C'][i % 6],
  delay: (i * 0.058) % 3.2,
  duration: 2.4 + (i * 0.04) % 2,
  width: i % 3 === 2 ? (6 + (i * 3) % 9) * 2 : 6 + (i * 3) % 9,
  height: 6 + (i * 3) % 9,
  radius: i % 3 === 0 ? '50%' : '2px',
}));

function playFanfare() {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    [523, 659, 784, 1047, 1319].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.14;
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.start(t);
      osc.stop(t + 0.6);
    });
  } catch (_) {}
}

export function WinnerCelebrationModal({ catName, videoUrl, themeName, votes, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    playFanfare();
    videoRef.current?.play().catch(() => {});
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col overflow-hidden">
      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
        {CONFETTI.map((c) => (
          <div
            key={c.id}
            className="absolute top-0 confetti-fall"
            style={{
              left: `${c.left}%`,
              width: `${c.width}px`,
              height: `${c.height}px`,
              backgroundColor: c.color,
              borderRadius: c.radius,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
            }}
          />
        ))}
      </div>

      <video
        ref={videoRef}
        src={videoUrl}
        className="absolute inset-0 w-full h-full object-cover"
        loop muted playsInline autoPlay
      />

      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/85 z-20" />

      <div className="relative z-30 flex flex-col h-full px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.4, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.25, type: 'spring', stiffness: 280, damping: 16 }}
          className="text-center pt-14"
        >
          <div className="text-7xl mb-3">👑</div>
          <h1 className="text-5xl font-black text-white leading-none drop-shadow-[0_2px_20px_rgba(0,0,0,0.8)]">
            MEOW<br />KING!
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="text-center mt-4"
        >
          <p className="text-yellow-300 font-black text-2xl drop-shadow-md">{catName}</p>
          <p className="text-white/80 font-medium mt-1 text-sm">
            won "{themeName}" · {votes} vote{votes !== 1 ? 's' : ''} 🐾
          </p>
        </motion.div>

        <div className="flex-1" />

        <div className="relative h-16 overflow-hidden mb-2 pointer-events-none">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <span
              key={i}
              className="absolute bottom-1 text-3xl kitten-march select-none"
              style={{ animationDelay: `${i * 0.75}s`, animationDuration: '6s' }}
            >
              {i % 2 === 0 ? '🐱' : '🐈'}
            </span>
          ))}
        </div>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          onClick={onClose}
          className="w-full bg-gradient-to-r from-pink-500 to-orange-400 text-white font-black py-4 rounded-2xl text-xl shadow-2xl mb-10 active:scale-95 transition-transform"
        >
          Keep Fighting! 🐾
        </motion.button>
      </div>
    </div>
  );
}
