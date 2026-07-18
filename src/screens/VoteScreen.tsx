import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, PawPrint, Loader2, Flag, Maximize2 } from 'lucide-react';
import { CommentsSheet } from '../components/CommentsSheet';
import { ReportModal } from '../components/ReportModal';
import { collection, getDocs, getDoc, doc, increment, serverTimestamp, query, orderBy, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useFirebase } from '../components/FirebaseProvider';

interface Cat {
  id: string;
  ownerId: string;
  name: string;
  cry: string;
  videoUrl: string;
  score: number;
  trimStart?: number;
  trimEnd?: number;
}

const FALLBACK_PAIRS = [
  {
    id: 1,
    cat1: {
      id: 'fallback_1',
      name: 'Mittens',
      cry: '"If I fits, I sits"',
      videoUrl: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.mp4',
      score: 0,
      ownerId: 'system'
    },
    cat2: {
      id: 'fallback_2',
      name: 'Luna',
      cry: '"Box destroyer 3000"',
      videoUrl: 'https://media.giphy.com/media/mlvseq9yvZhba/giphy.mp4',
      score: 0,
      ownerId: 'system'
    }
  }
];

export function VoteScreen() {
  const { user, signIn } = useFirebase();
  const [activeCommentCatId, setActiveCommentCatId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);
  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);

  const enterFullscreen = (ref: React.RefObject<HTMLVideoElement>, trimStart: number = 0) => {
    const v = ref.current as any;
    if (!v) return;
    // Restart from the beginning and turn sound on for fullscreen viewing
    try {
      v.loop = true;
      v.currentTime = trimStart || 0;
      v.muted = false;
      const playPromise = v.play();
      if (playPromise && playPromise.catch) playPromise.catch(() => {});
    } catch (e) { /* ignore */ }
    // Fallback loop: if the clip ever reaches the end, restart it from the top
    const onEnded = () => {
      v.currentTime = trimStart || 0;
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    };
    v.addEventListener('ended', onEnded);
    // Re-mute once the user leaves fullscreen so the split view stays silent
    const remute = () => {
      v.muted = true;
      v.removeEventListener('webkitendfullscreen', remute);
      v.removeEventListener('ended', onEnded);
      document.removeEventListener('fullscreenchange', onFsChange);
    };
    const onFsChange = () => {
      if (!document.fullscreenElement) remute();
    };
    v.addEventListener('webkitendfullscreen', remute);
    document.addEventListener('fullscreenchange', onFsChange);
    if (v.webkitEnterFullscreen) {
      v.webkitEnterFullscreen();
    } else if (v.requestFullscreen) {
      v.requestFullscreen();
    }
  };
  const [hasVoted, setHasVoted] = useState(false);
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const [currentPairIndex, setCurrentPairIndex] = useState(0);
  const [pairs, setPairs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCats = async () => {
      if (!user) {
        setPairs(FALLBACK_PAIRS);
        setCurrentPairIndex(0);
        setLoading(false);
        return;
      }

      try {
        const q = query(collection(db, 'cats'));
        const snapshot = await getDocs(q);
        const fetchedCats = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Cat))
          .filter((c: any) => !!c.videoUrl); // only real video entries can battle
        
        // Shuffle the cats array locally for random matchups
        for (let i = fetchedCats.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [fetchedCats[i], fetchedCats[j]] = [fetchedCats[j], fetchedCats[i]];
        }
        
        if (fetchedCats.length >= 1) {
          // If there's an odd number of cats, give the leftover a fallback
          // opponent so EVERY uploaded cat shows up in the battle rotation.
          const list: Cat[] = [...fetchedCats];
          if (list.length % 2 !== 0) {
            list.push(FALLBACK_PAIRS[0].cat2 as Cat);
          }
          const newPairs = [];
          for (let i = 0; i < list.length - 1; i += 2) {
            newPairs.push({
              id: i,
              cat1: list[i],
              cat2: list[i + 1]
            });
          }
          setPairs(newPairs);
          setCurrentPairIndex(0);
        } else {
          setPairs(FALLBACK_PAIRS);
          setCurrentPairIndex(0);
        }
      } catch (error) {
        console.error('Error fetching cats:', error);
        setPairs(FALLBACK_PAIRS);
        setCurrentPairIndex(0);
      } finally {
        setLoading(false);
      }
    };

    fetchCats();
  }, [user]);

  const currentPair = pairs[currentPairIndex];

  const handleNextBattle = () => {
    setHasVoted(false);
    setVotedFor(null);
    if (pairs.length === 0) return;
    if (pairs.length === 1) {
      // Swap the cats to make it look like a new battle if there's only 1 pair
      setPairs(prevPairs => {
        const pair = prevPairs[0];
        return [{
          ...pair,
          cat1: pair.cat2,
          cat2: pair.cat1
        }];
      });
    } else {
      setCurrentPairIndex((prev) => (prev + 1) % pairs.length);
    }
  };

  useEffect(() => {
    const handleCustomEvent = () => {
      handleNextBattle();
    };
    window.addEventListener('next-battle', handleCustomEvent);
    return () => window.removeEventListener('next-battle', handleCustomEvent);
  }, [pairs.length]);

  const handleVote = async (catId: string) => {
    if (hasVoted) return;
    
    let currentUser = user;
    if (!currentUser) {
      await signIn();
      currentUser = auth.currentUser;
      if (!currentUser) return;
    }

    setVotedFor(catId);
    setHasVoted(true);

    try {
      // If it's a fallback cat, don't try to update Firestore
      if (!catId.startsWith('fallback_')) {
        const voteRef = doc(db, 'votes', `${currentUser.uid}_${catId}`);
        const catRef = doc(db, 'cats', catId);

        // Check if user already voted to prevent permission error
        const voteSnap = await getDoc(voteRef);
        
        if (!voteSnap.exists()) {
          const batch = writeBatch(db);
          // Record the vote and increment score
          batch.set(voteRef, {
            userId: currentUser.uid,
            catId: catId,
            createdAt: serverTimestamp()
          });

          batch.update(catRef, {
            score: increment(1)
          });
          
          await batch.commit();
        }
      }
    } catch (error: any) {
      // Ignore permission errors as they likely mean the user already voted
      // and the security rules blocked the duplicate vote
      if (error.code !== 'permission-denied') {
        console.error('Error voting:', error);
      }
    }

    // Move to next pair after animation
    setTimeout(() => {
      handleNextBattle();
    }, 1500);
  };

  if (loading) {
    return (
      <div className="flex-1 bg-neutral-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
      </div>
    );
  }

  if (!currentPair) return null;

  return (
    <div className="flex-1 bg-neutral-900 relative overflow-hidden flex flex-col">
      {/* Videos Container (Split Screen) */}
      <div className="flex-1 flex flex-col relative z-10">
        {/* Top Video */}
        <div className="flex-1 relative overflow-hidden border-b-4 border-black">
          <video
            key={`vid-${currentPair.cat1.id}`}
            ref={video1Ref}
            src={currentPair.cat1.videoUrl}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay loop muted playsInline preload="auto"
            onCanPlay={(e) => { e.currentTarget.play().catch(() => {}); }}
            onLoadedMetadata={(e) => {
              if (currentPair.cat1.trimStart) e.currentTarget.currentTime = currentPair.cat1.trimStart;
            }}
            onTimeUpdate={(e) => {
              const { trimStart, trimEnd } = currentPair.cat1;
              if (trimStart !== undefined && trimEnd !== undefined) {
                if (e.currentTarget.currentTime >= trimEnd || e.currentTarget.currentTime < trimStart) {
                  e.currentTarget.currentTime = trimStart;
                }
              }
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none"></div>
          
          <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end pointer-events-none">
            <AnimatePresence mode="popLayout">
              <motion.div
                key={`text-${currentPair.cat1.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col"
              >
                <h3 className="text-white font-black text-2xl drop-shadow-md">{currentPair.cat1.name}</h3>
                <p className="text-white/80 font-medium text-sm whitespace-nowrap">{currentPair.cat1.cry}</p>
              </motion.div>
            </AnimatePresence>
            <div className="flex flex-col gap-3 items-center pointer-events-auto">
              <motion.button 
                onClick={() => handleVote(currentPair.cat1.id)}
                whileTap={{ scale: 0.8, rotate: -15 }}
                animate={!hasVoted ? { 
                  scale: [1, 1.08, 1],
                  rotate: [0, 8, -8, 0],
                  filter: ['hue-rotate(0deg)', 'hue-rotate(45deg)', 'hue-rotate(0deg)']
                } : {}}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                className="w-16 h-16 bg-gradient-to-br from-red-400 to-pink-500 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(236,72,153,0.5)] border-2 border-white relative z-10"
              >
                <PawPrint className="w-8 h-8 text-white fill-white drop-shadow-md" />
              </motion.button>

              <div className="relative bg-black/20 backdrop-blur-sm border border-white/20 text-white font-black text-[10px] px-2 py-2 rounded-xl shadow-xl uppercase tracking-widest flex flex-col items-center text-center leading-tight">
                <svg className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-2" viewBox="0 0 16 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 0L16 8H0L8 0Z" fill="rgba(0,0,0,0.2)" />
                </svg>
                <span>This</span>
                <span>one's</span>
                <span>cuter</span>
              </div>

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setActiveCommentCatId(currentPair.cat1.id)}
                className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-white/30 relative z-10"
              >
                <MessageCircle className="w-5 h-5 text-white fill-white" />
              </motion.button>

              {!String(currentPair.cat1.id).startsWith('fallback_') && (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setReportTarget({ id: currentPair.cat1.id, name: currentPair.cat1.name })}
                  className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-white/30 relative z-10"
                >
                  <Flag className="w-4 h-4 text-white/80" />
                </motion.button>
              )}
            </div>
          </div>

          {/* Fullscreen — top-left corner of the top video */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => enterFullscreen(video1Ref, currentPair.cat1.trimStart)}
            className="absolute top-3 left-3 w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-white/30 z-20"
            aria-label="View full screen"
          >
            <Maximize2 className="w-4 h-4 text-white/90" />
          </motion.button>
        </div>

        {/* Bottom Video */}
        <div className="flex-1 relative overflow-hidden">
          <video
            key={`vid-${currentPair.cat2.id}`}
            ref={video2Ref}
            src={currentPair.cat2.videoUrl}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay loop muted playsInline preload="auto"
            onCanPlay={(e) => { e.currentTarget.play().catch(() => {}); }}
            onLoadedMetadata={(e) => {
              if (currentPair.cat2.trimStart) e.currentTarget.currentTime = currentPair.cat2.trimStart;
            }}
            onTimeUpdate={(e) => {
              const { trimStart, trimEnd } = currentPair.cat2;
              if (trimStart !== undefined && trimEnd !== undefined) {
                if (e.currentTarget.currentTime >= trimEnd || e.currentTarget.currentTime < trimStart) {
                  e.currentTarget.currentTime = trimStart;
                }
              }
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/30 pointer-events-none"></div>
          
          <div className="absolute top-6 left-6 right-6 flex justify-between items-start pointer-events-none">
            <AnimatePresence mode="popLayout">
              <motion.div
                key={`text-${currentPair.cat2.id}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col"
              >
                <h3 className="text-white font-black text-2xl drop-shadow-md">{currentPair.cat2.name}</h3>
                <p className="text-white/80 font-medium text-sm whitespace-nowrap">{currentPair.cat2.cry}</p>
              </motion.div>
            </AnimatePresence>
            <div className="flex flex-col gap-3 items-center pointer-events-auto">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setActiveCommentCatId(currentPair.cat2.id)}
                className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-white/30 relative z-10"
              >
                <MessageCircle className="w-5 h-5 text-white fill-white" />
              </motion.button>

              {!String(currentPair.cat2.id).startsWith('fallback_') && (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setReportTarget({ id: currentPair.cat2.id, name: currentPair.cat2.name })}
                  className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-white/30 relative z-10"
                >
                  <Flag className="w-4 h-4 text-white/80" />
                </motion.button>
              )}

              <div className="relative bg-black/20 backdrop-blur-sm border border-white/20 text-white font-black text-[10px] px-2 py-2 rounded-xl shadow-xl uppercase tracking-widest flex flex-col items-center text-center leading-tight">
                <svg className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-2 rotate-180" viewBox="0 0 16 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 0L16 8H0L8 0Z" fill="rgba(0,0,0,0.2)" />
                </svg>
                <span>Nah!</span>
                <span>I'm</span>
                <span>cuter</span>
              </div>

              <motion.button 
                onClick={() => handleVote(currentPair.cat2.id)}
                whileTap={{ scale: 0.8, rotate: -15 }}
                animate={!hasVoted ? { 
                  scale: [1, 1.08, 1],
                  rotate: [0, -8, 8, 0],
                  filter: ['hue-rotate(0deg)', 'hue-rotate(-45deg)', 'hue-rotate(0deg)']
                } : {}}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="w-16 h-16 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.5)] border-2 border-white relative z-10"
              >
                <PawPrint className="w-8 h-8 text-white fill-white drop-shadow-md" />
              </motion.button>
            </div>
          </div>

          {/* Fullscreen — bottom-left corner of the bottom video */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => enterFullscreen(video2Ref, currentPair.cat2.trimStart)}
            className="absolute bottom-3 left-3 w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-white/30 z-20"
            aria-label="View full screen"
          >
            <Maximize2 className="w-4 h-4 text-white/90" />
          </motion.button>
        </div>

        {/* VS Badge */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center font-black text-xl text-neutral-900 shadow-2xl border-4 border-neutral-900 transform -rotate-12">
            VS
          </div>
        </div>

        {/* Voted Animation Overlay */}
        <AnimatePresence>
          {hasVoted && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none bg-black/40 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 5, opacity: 0, rotate: -20 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: "spring", damping: 12, stiffness: 200 }}
                className="relative"
              >
                <div className="absolute inset-0 bg-pink-500 blur-3xl opacity-50 rounded-full scale-150"></div>
                <PawPrint className="w-48 h-48 text-pink-500 fill-pink-500 drop-shadow-[0_0_40px_rgba(236,72,153,0.8)] relative z-10" />
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-white font-black text-3xl tracking-widest uppercase drop-shadow-lg whitespace-nowrap z-20"
                >
                  Voted!
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CommentsSheet isOpen={!!activeCommentCatId} catId={activeCommentCatId} onClose={() => setActiveCommentCatId(null)} />

      <ReportModal
        isOpen={!!reportTarget}
        onClose={() => setReportTarget(null)}
        targetType="cat"
        targetId={reportTarget?.id ?? null}
        targetName={reportTarget?.name}
      />
    </div>
  );
}
