import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Gift, Star, ShoppingBag, Award, ExternalLink, Lock, Unlock, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useFirebase } from '../components/FirebaseProvider';

export function PrizesScreen() {
  const navigate = useNavigate();
  const { user } = useFirebase();
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);

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

  const digitalRewards = [
    { id: 'd1', title: 'Golden Crown Badge', cost: 10, icon: Award, color: 'text-yellow-500', bg: 'bg-yellow-50' },
    { id: 'd2', title: 'Neon Laser Frame', cost: 50, icon: Star, color: 'text-pink-500', bg: 'bg-pink-50' },
    { id: 'd3', title: 'VIP Yarn Ball Icon', cost: 100, icon: Gift, color: 'text-purple-500', bg: 'bg-purple-50' },
  ];

  const partnerDiscounts = [
    {
      id: 'p1',
      title: '10% off Premium Catnip',
      sponsor: 'MeowMagic Co.',
      cost: 250,
      image: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    },
    {
      id: 'p2',
      title: 'Free Bag of Treats',
      sponsor: 'FelineFine Tech',
      cost: 500,
      image: 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    },
    {
      id: 'p3',
      title: '50% off Luxury Cat Bed',
      sponsor: 'Pawsome Living',
      cost: 1000,
      image: 'https://images.unsplash.com/photo-1543852786-1cf6624b9987?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    }
  ];

  const handleRedeem = (title: string, cost: number) => {
    if (totalPoints >= cost) {
      alert(`🎉 You unlocked: ${title}! (This is a preview, full redemption coming soon)`);
    } else {
      alert(`You need ${cost - totalPoints} more points to unlock this!`);
    }
  };

  return (
    <div className="flex-1 bg-[#FFF5F5] flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="pt-12 pb-4 px-6 flex items-center gap-4 bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-red-100">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 bg-red-50 rounded-full text-red-400 active:scale-95 transition-transform">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-black text-neutral-800">Rewards & Discounts</h1>
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
          <h3 className="font-black text-xl text-neutral-800 flex items-center gap-2 mb-4">
            <Star className="w-6 h-6 text-yellow-500" /> Digital Profile Rewards
          </h3>
          <div className="space-y-3">
            {digitalRewards.map((reward, index) => {
              const isUnlocked = totalPoints >= reward.cost;
              const Icon = reward.icon;
              return (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  key={reward.id} 
                  className={`bg-white p-4 rounded-2xl border ${isUnlocked ? 'border-green-200 shadow-sm' : 'border-neutral-100 opacity-75'} flex items-center gap-4`}
                >
                  <div className={`w-12 h-12 rounded-full ${reward.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-6 h-6 ${reward.color}`} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-neutral-800">{reward.title}</h4>
                    <p className="text-xs font-bold text-neutral-500">{reward.cost} pts required</p>
                  </div>
                  <button 
                    onClick={() => handleRedeem(reward.title, reward.cost)}
                    className={`p-3 rounded-full flex-shrink-0 transition-colors ${isUnlocked ? 'bg-green-100 text-green-600' : 'bg-neutral-100 text-neutral-400'}`}
                  >
                    {isUnlocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Partner Discounts */}
        <div className="space-y-6 mb-10">
          <h3 className="font-black text-xl text-neutral-800 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-red-400" /> Partner Discounts
          </h3>
          
          {partnerDiscounts.map((prize, index) => {
            const isUnlocked = totalPoints >= prize.cost;
            return (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                key={prize.id} 
                className={`bg-white rounded-3xl overflow-hidden border ${isUnlocked ? 'border-green-200 shadow-md' : 'border-neutral-100 shadow-sm opacity-80'}`}
              >
                <div className="h-32 relative">
                  <img src={prize.image} alt={prize.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                    <div className="bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-black text-neutral-800 shadow-sm">
                      {prize.sponsor}
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-black shadow-md flex items-center gap-1 ${isUnlocked ? 'bg-green-500 text-white' : 'bg-neutral-800/80 text-white backdrop-blur-sm'}`}>
                      {isUnlocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      {prize.cost} pts
                    </div>
                  </div>
                </div>
                <div className="p-5 flex justify-between items-center gap-4">
                  <div>
                    <h4 className="font-black text-lg text-neutral-800 leading-tight">{prize.title}</h4>
                  </div>
                  <button 
                    onClick={() => handleRedeem(prize.title, prize.cost)}
                    className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-colors ${isUnlocked ? 'bg-green-500 text-white active:scale-95' : 'bg-neutral-100 text-neutral-400'}`}
                  >
                    {isUnlocked ? 'Redeem' : 'Locked'}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
