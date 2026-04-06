import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, MessageCircle, PawPrint, Loader2 } from 'lucide-react';
import { CommentsSheet } from '../components/CommentsSheet';
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
        const q = query(collection(db, 'cats'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const fetchedCats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cat));
        
        if (fetchedCats.length >= 2) {
          // Create pairs
          const newPairs = [];
          for (let i = 0; i < fetchedCats.length - 1; i += 2) {
            newPairs.push({
              id: i,
              cat1: fetchedCats[i],
              cat2: fetchedCats[i + 1]
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
      {/* Header */}
      <div className="absolute top-0 left-0 w-full pt-6 pb-4 px-6 flex justify-between items-center z-20 pointer-events-none">
        <div className="bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 pointer-events-auto">
          <span className="text-white font-bold text-sm">Round {currentPairIndex + 1} of {pairs.length}</span>
        </div>
        <div className="bg-gradient-to-r from-pink-500 to-orange-400 px-3 py-1.5 rounded-full flex items-center gap-1 shadow-lg pointer-events-auto">
          <Zap className="w-4 h-4 text-white fill-white" />
          <span className="text-white font-bold text-xs">5 Day Streak!</span>
        </div>
      </div>

      {/* Videos Container (Split Screen) */}
      <div className="flex-1 flex flex-col relative z-10">
        {/* Top Video */}
        <div className="flex-1 relative overflow-hidden border-b-4 border-black">
          <AnimatePresence mode="popLayout">
            <motion.video 
              key={`vid-${currentPair.cat1.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              src={currentPair.cat1.videoUrl} 
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay loop muted playsInline
            />
          </AnimatePresence>
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

              <div className="relative bg-white/30 backdrop-blur-md border border-white/40 text-white font-black text-xs px-4 py-2.5 rounded-2xl shadow-xl whitespace-nowrap uppercase tracking-wide">
                <svg className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-2" viewBox="0 0 16 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 0L16 8H0L8 0Z" fill="rgba(255,255,255,0.3)" />
                </svg>
                This one's cuter!
              </div>

              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={() => setActiveCommentCatId(currentPair.cat1.id)}
                className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-white/30 relative z-10"
              >
                <MessageCircle className="w-5 h-5 text-white fill-white" />
              </motion.button>
            </div>
          </div>
        </div>

        {/* Bottom Video */}
        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="popLayout">
            <motion.video 
              key={`vid-${currentPair.cat2.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              src={currentPair.cat2.videoUrl} 
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay loop muted playsInline
            />
          </AnimatePresence>
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

              <div className="relative bg-white/30 backdrop-blur-md border border-white/40 text-white font-black text-xs px-4 py-2.5 rounded-2xl shadow-xl whitespace-nowrap uppercase tracking-wide">
                <svg className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-2 rotate-180" viewBox="0 0 16 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 0L16 8H0L8 0Z" fill="rgba(255,255,255,0.3)" />
                </svg>
                Nah, I'm cuter!
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
    </div>
  );
}
