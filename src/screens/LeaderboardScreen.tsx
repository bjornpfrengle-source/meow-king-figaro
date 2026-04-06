import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Trophy, Medal, Crown, ChevronDown, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, limit, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useFirebase } from '../components/FirebaseProvider';

interface Leader {
  id: string;
  rank: number;
  name: string;
  owner: string;
  score: string;
  img: string;
}

const FALLBACK_LEADERS: Leader[] = [
  { id: 'f1', rank: 1, name: 'Sir Pounce', owner: '@catlover99', score: '15.2k', img: '1513360371669-4adf3dd7dff8' },
  { id: 'f2', rank: 2, name: 'Luna', owner: '@mooncat', score: '14.8k', img: '1514888286974-6c03e2ca1dba' },
  { id: 'f3', rank: 3, name: 'Garfield', owner: '@lasagna', score: '13.5k', img: '1543852786175-31bf590ce6ea' },
  { id: 'f4', rank: 4, name: 'Mochi', owner: '@sweetmochi', score: '12.1k', img: '1573865526739-10659fec78a5' },
  { id: 'f5', rank: 5, name: 'Oreo', owner: '@cookiecat', score: '11.9k', img: '1529778458776-36911447af62' },
];

export function LeaderboardScreen() {
  const navigate = useNavigate();
  const { user, signIn } = useFirebase();
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLeaders(FALLBACK_LEADERS);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'cats'), orderBy('score', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const fetchedLeaders = await Promise.all(snapshot.docs.map(async (catDoc, index) => {
        const data = catDoc.data();
        let ownerName = 'Anonymous';
        let ownerImg = '1514888286974-6c03e2ca1dba'; // Default placeholder
        let isRealImage = false;

        if (data.ownerId) {
          try {
            const userDoc = await getDoc(doc(db, 'users', data.ownerId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              ownerName = userData.displayName || 'Anonymous';
              if (userData.photoURL) {
                ownerImg = userData.photoURL;
                isRealImage = true;
              }
            }
          } catch (e) {
            console.error('Error fetching user:', e);
          }
        }

        return {
          id: catDoc.id,
          rank: index + 1,
          name: data.name,
          owner: ownerName,
          score: data.score.toString(),
          img: ownerImg,
          isRealImage
        };
      }));
      
      if (fetchedLeaders.length > 0) {
        setLeaders(fetchedLeaders);
      } else {
        setLeaders(FALLBACK_LEADERS);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error fetching leaderboard:', error);
      setLeaders(FALLBACK_LEADERS);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#FFF5F5] flex flex-col">
      {/* Header */}
      <div className="pt-12 pb-6 px-6 bg-gradient-to-b from-pink-100 to-[#FFF5F5] sticky top-0 z-20">
        <div className="flex justify-between items-center mb-4">
          <div className="w-10"></div> {/* Spacer to keep title centered */}
          <div className="text-center">
            <h1 className="text-2xl font-black text-neutral-800">Cat Chaos Arena</h1>
            <p className="text-xs font-bold text-pink-500 uppercase tracking-widest mt-1">Leaderboard</p>
          </div>
          <button 
            onClick={() => navigate('/premium')}
            className="w-10 h-10 bg-gradient-to-br from-amber-300 to-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30 border-2 border-white active:scale-95 transition-transform"
          >
            <Crown className="w-5 h-5 text-white fill-white" />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex bg-white rounded-full p-1 shadow-sm border border-pink-100">
          <button className="flex-1 bg-pink-500 text-white rounded-full py-2 text-sm font-bold shadow-sm">Daily</button>
          <button className="flex-1 text-neutral-500 rounded-full py-2 text-sm font-bold">Weekly</button>
          <button className="flex-1 text-neutral-500 rounded-full py-2 text-sm font-bold">All-Time</button>
        </div>
      </div>

      <div className="px-6 pb-24">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-black text-lg text-neutral-800">Top Box Conquerors</h2>
          <button className="flex items-center gap-1 text-sm font-bold text-pink-500 bg-pink-50 px-3 py-1.5 rounded-full">
            All Cats <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {leaders.map((leader, index) => (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ 
                  layout: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 },
                  y: { duration: 0.2 }
                }}
                key={leader.id}
                className={`flex items-center gap-4 p-3 rounded-2xl ${index === 0 ? 'bg-gradient-to-r from-yellow-50 to-yellow-100/50 border border-yellow-200 shadow-sm' : 'bg-white border border-pink-50 shadow-sm'}`}
              >
                <div className="w-8 font-black text-xl text-center text-neutral-400 flex justify-center">
                  {index === 0 ? <Crown className="w-6 h-6 text-yellow-500 fill-yellow-500" /> : 
                   index === 1 ? <Medal className="w-6 h-6 text-neutral-400 fill-neutral-400" /> : 
                   index === 2 ? <Medal className="w-6 h-6 text-orange-400 fill-orange-400" /> : 
                   leader.rank}
                </div>
                
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0">
                  <img 
                    src={(leader as any).isRealImage ? leader.img : `https://images.unsplash.com/photo-${leader.img}?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80`} 
                    alt={leader.name} 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer" 
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-neutral-800 truncate text-base">{leader.name}</h3>
                  <p className="text-xs text-neutral-500 truncate">{leader.owner}</p>
                </div>
                
                <div className="text-right shrink-0">
                  <p className="font-black text-pink-500">{leader.score}</p>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase">Pts</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
