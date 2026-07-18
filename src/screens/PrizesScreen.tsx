import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Gift, Star, Lock, Check, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { useFirebase } from '../components/FirebaseProvider';
import { DIGITAL_REWARDS } from '../components/rewards';

export function PrizesScreen() {
  const navigate = useNavigate();
  const { user, userProfile } = useFirebase();
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  const claimed: string[] = userProfile?.badges || [];

  useEffect(() => {
    const fetchPoints = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const q = query(collection(db, 'cats'), where('ownerId', '==', user.uid));
        const snapshot = await getDocs(q);
        let points = 0;
        snapshot.forEach(doc => {
          points += (doc.data().score || 0);
        });
        setTotalPoints(points);
      } catch (error) {
        console.error("Error fetching points:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPoints();
  }, [user]);

  const handleClaim = async (rewardId: string, cost: number) => {
    if (!user) return;
    if (totalPoints < cost) {
      alert(`You need ${cost - totalPoints} more points to unlock this!`);
      return;
    }
    if (claimed.includes(rewardId)) return;
    setClaiming(rewardId);
    try {
      await updateDoc(doc(db, 'users', user.uid), { badges: arrayUnion(rewardId) });
    } catch (e) {
      console.error('Error claiming badge:', e);
      alert('Could not claim right now. Please try again.');
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div className="flex-1 bg-[#FFF5F5] flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="pt-4 pb-4 px-6 flex items-center gap-4 bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-red-100">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 bg-red-50 rounded-full text-red-400 active:scale-95 transition-transform">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-black text-neutral-800">Rewards</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-12">
        {/* Points Balance */}
        <div className="bg-gradient-to-br from-red-400 to-orange-400 rounded-3xl p-6 mt-6 mb-8 text-white shadow-lg text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-10 transform translate-x-4 -translate-y-4">
            <Gift className="w-32 h-32" />
          </div>
          <p className="text-white/80 font-bold text-sm uppercase tracking-wider mb-1 relative z-10">Your Total Points</p>
          {loading ? (
            <div className="flex justify-center py-2 relative z-10">
              <Loader2 className="w-8 h-8 animate-spin text-white" />
            </div>
          ) : (
            <h2 className="text-5xl font-black relative z-10">{totalPoints.toLocaleString()}</h2>
          )}
          <p className="text-white/90 text-sm mt-2 relative z-10">Keep uploading and getting votes to unlock more!</p>
        </div>

        {/* Digital Rewards */}
        <div className="mb-10">
          <h3 className="font-black text-xl text-neutral-800 flex items-center gap-2 mb-1">
            <Star className="w-6 h-6 text-yellow-500" /> Profile Badges
          </h3>
          <p className="text-sm text-neutral-500 mb-4">Earn votes to unlock badges that show off on your profile.</p>
          <div className="space-y-3">
            {DIGITAL_REWARDS.map((reward, index) => {
              const isUnlocked = totalPoints >= reward.cost;
              const isClaimed = claimed.includes(reward.id);
              const Icon = reward.icon;
              return (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  key={reward.id}
                  className={`bg-white p-4 rounded-2xl border ${isClaimed ? 'border-green-200 shadow-sm' : isUnlocked ? 'border-yellow-200 shadow-sm' : 'border-neutral-100 opacity-75'} flex items-center gap-4`}
                >
                  <div className={`w-12 h-12 rounded-full ${reward.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-6 h-6 ${reward.color}`} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-neutral-800">{reward.title}</h4>
                    <p className="text-xs font-bold text-neutral-500">
                      {isClaimed ? 'Earned ✓' : `${reward.cost} pts to unlock`}
                    </p>
                  </div>
                  {isClaimed ? (
                    <div className="px-4 py-2 rounded-full bg-green-100 text-green-600 font-bold text-sm flex items-center gap-1">
                      <Check className="w-4 h-4" /> Owned
                    </div>
                  ) : isUnlocked ? (
                    <button
                      onClick={() => handleClaim(reward.id, reward.cost)}
                      disabled={claiming === reward.id}
                      className="px-4 py-2 rounded-full bg-yellow-400 text-white font-bold text-sm active:scale-95 transition-transform disabled:opacity-60"
                    >
                      {claiming === reward.id ? '...' : 'Claim'}
                    </button>
                  ) : (
                    <div className="p-3 rounded-full bg-neutral-100 text-neutral-400 flex-shrink-0">
                      <Lock className="w-5 h-5" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
