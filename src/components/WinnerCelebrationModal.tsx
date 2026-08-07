import { useEffect, useRef, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Share2, Loader2 } from 'lucide-react';
import { ensureShareVideo } from './shareVideo';
import { useFirebase } from './FirebaseProvider';

interface Props {
  catId: string;
  catName: string;
  videoUrl: string;
  themeName: string;
  votes: number;
  shareVideoUrl?: string;
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

/**
 * Dismiss lines. One hardcoded "Keep Fighting!" made every win feel identical,
 * and it's the wrong note for someone who just won — they don't need telling to
 * keep fighting. Picked per win so a repeat champion sees something new.
 */
const VICTORY_LINES = [
  'Bask in it 👑',
  'Undisputed 🐾',
  'Take a bow 🎀',
  'Purrfectly done ✨',
  'Crown secured 👑',
  'Legendary 🏆',
  'Nobody came close 😼',
  'Reign on 🐈',
  'Chaos conquered 🔥',
  'Certified icon ⭐',
];

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

export function WinnerCelebrationModal({ catId, catName, videoUrl, themeName, votes, shareVideoUrl: initialShareVideoUrl, onClose }: Props) {
  const { user } = useFirebase();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shared, setShared] = useState(false);
  const [shareVideoUrl, setShareVideoUrl] = useState(initialShareVideoUrl);
  const [shareError, setShareError] = useState<string | null>(null);
  // Only true while THIS component is the one waiting on generation — if
  // NotificationsScreen already kicked it off in the background and it's
  // still not done by the time someone opens this modal, we wait here too.
  const [preparing, setPreparing] = useState(!initialShareVideoUrl);
  const [prepFailed, setPrepFailed] = useState(false);

  // Chosen once per mount so it doesn't reshuffle on re-render mid-celebration.
  const victoryLine = useMemo(
    () => VICTORY_LINES[Math.floor(Math.random() * VICTORY_LINES.length)],
    []
  );

  useEffect(() => {
    playFanfare();
    videoRef.current?.play().catch(() => {});
  }, []);

  useEffect(() => {
    if (shareVideoUrl) return;
    if (!user?.uid) { setPreparing(false); return; }
    let cancelled = false;
    ensureShareVideo({ id: catId, ownerId: user.uid, videoUrl, name: catName }, themeName, votes)
      .then((url) => {
        if (cancelled) return;
        if (url) setShareVideoUrl(url);
        else setPrepFailed(true);
      })
      .finally(() => { if (!cancelled) setPreparing(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shareWin = async () => {
    if (!shareVideoUrl) return;
    setShareError(null);
    const text = `👑 ${catName} just won "${themeName}" with ${votes} vote${votes !== 1 ? 's' : ''} on Cat Chaos Arena!`;
    // Logged at every stage on purpose — the first attempt at this failed
    // completely silently (button did nothing, nothing visible to debug
    // from), so this is deliberately verbose until it's confirmed working
    // on a real device via Safari's Web Inspector console.
    console.log('[shareWin] navigator.share:', typeof navigator.share, 'canShare:', typeof navigator.canShare);
    try {
      console.log('[shareWin] fetching', shareVideoUrl);
      const res = await fetch(shareVideoUrl);
      console.log('[shareWin] fetch status', res.status);
      const blob = await res.blob();
      console.log('[shareWin] blob size', blob.size, blob.type);
      const file = new File([blob], `${catName.replace(/[^a-z0-9]/gi, '-') || 'meow-king'}.mp4`, { type: 'video/mp4' });

      const canShareFiles = navigator.canShare?.({ files: [file] });
      console.log('[shareWin] canShare({files}) =', canShareFiles);

      // Real video attachment in the native share sheet — no Railway link
      // that makes people log in to see what it even is.
      if (canShareFiles) {
        await navigator.share({ files: [file], title: 'Meow King!', text });
        console.log('[shareWin] navigator.share (with file) resolved');
      } else if (navigator.share) {
        await navigator.share({ title: 'Meow King!', text });
        console.log('[shareWin] navigator.share (text only) resolved');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        console.log('[shareWin] clipboard fallback used');
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } else {
        throw new Error('No share method available (navigator.share and clipboard both missing)');
      }
    } catch (err: any) {
      // AbortError = user dismissed the share sheet themselves, not a bug.
      if (err?.name === 'AbortError') {
        console.log('[shareWin] user dismissed the share sheet');
        return;
      }
      console.error('[shareWin] failed:', err);
      setShareError(err?.message || 'Sharing failed on this device.');
    }
  };

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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          className="mb-10 space-y-3"
        >
          <button
            onClick={shareWin}
            disabled={preparing || (!shareVideoUrl && !prepFailed)}
            className="w-full bg-white/15 backdrop-blur-md border border-white/30 text-white font-black py-4 rounded-2xl text-lg active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {preparing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Preparing your video…
              </>
            ) : (
              <>
                <Share2 className="w-5 h-5" />
                {shared ? 'Copied!' : prepFailed && !shareVideoUrl ? 'Share unavailable — try again later' : 'Share the win'}
              </>
            )}
          </button>
          {shareError && (
            <p className="text-center text-white/70 text-xs font-medium px-2">{shareError}</p>
          )}
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-pink-500 to-orange-400 text-white font-black py-4 rounded-2xl text-xl shadow-2xl active:scale-95 transition-transform"
          >
            {victoryLine}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
