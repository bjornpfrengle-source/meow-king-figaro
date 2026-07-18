import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Medal, Crown, Loader2, Flag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useFirebase } from '../components/FirebaseProvider';
import { useThemes } from '../components/themes';
import { ReportModal } from '../components/ReportModal';

interface Leader {
  id: string;
  rank: number;
  name: string;
  owner: string;
  score: string;
  img: string;
  isRealImage?: boolean;
}

const FALLBACK_LEADERS: Leader[] = [
  { id: 'f1', rank: 1, name: 'Sir Pounce', owner: '@catlover99', score: '15.2k', img: '1513360371669-4adf3dd7dff8' },
  { id: 'f2', rank: 2, name: 'Luna', owner: '@mooncat', score: '14.8k', img: '1514888286974-6c03e2ca1dba' },
  { id: 'f3', rank: 3, name: 'Garfield', owner: '@lasagna', score: '13.5k', img: '1543852786175-31bf590ce6ea' },
  { id: 'f4', rank: 4, name: 'Mochi', owner: '@sweetmochi', score: '12.1k', img: '1573865526739-10659fec78a5' },
  { id: 'f5', rank: 5, name: 'Oreo', owner: '@cookiecat', score: '11.9k', img: '1529778458776-36911447af62' },
];

type Tab = 'daily' | 'weekly' | 'alltime';

export function LeaderboardScreen() {
  const navigate = useNavigate();
  const { user } = useFirebase();
  const { active } = useThemes();
  const [allCats, setAllCats] = useState<any[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('daily');
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);

  // Fetch every real (video) entry once; tabs filter it client-side.
  useEffect(() => {
    if (!user) {
      setLeaders(FALLBACK_LEADERS);
      setLoading(false);
      return;
    }
    const fetchCats = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'cats')));
        setAllCats(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c: any) => !!c.videoUrl));
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCats();
  }, [user]);

  // Recompute the ranked list whenever the tab, data, or active theme changes.
  useEffect(() => {
    if (!user) return;
    const build = async () => {
      let list = [...allCats];
      if (tab === 'daily') {
        list = active ? list.filter((c: any) => c.theme === active.slug) : [];
      } else if (tab === 'weekly') {
        const weekAgo = Date.now() - 7 * 86400000;
        list = list.filter((c: any) => (c.createdAt?.toMillis?.() ?? 0) >= weekAgo);
      }
      list.sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
      list = list.slice(0, 10);

      const enriched = await Promise.all(
        list.map(async (data: any, index: number) => {
          let ownerName = 'Anonymous';
          let catImg = data.thumbnailUrl || data.catThumbnailUrl;
          if (data.ownerId) {
            try {
              const userDoc = await getDoc(doc(db, 'users', data.ownerId));
              if (userDoc.exists()) {
                const ud = userDoc.data();
                ownerName = ud.displayName || 'Anonymous';
                if (!catImg) catImg = data.selectedCatId === 'cat2' ? ud.catThumbnailUrl2 : ud.catThumbnailUrl;
              }
            } catch (e) { /* ignore */ }
          }
          return {
            id: data.id,
            rank: index + 1,
            name: data.name,
            owner: ownerName,
            score: (data.score || 0).toString(),
            img: catImg || '1514888286974-6c03e2ca1dba',
            isRealImage: !!catImg,
          } as Leader;
        })
      );
      setLeaders(enriched);
    };
    build();
  }, [tab, allCats, active, user]);

  const heading =
    tab === 'daily'
      ? active ? `Today · ${active.title}` : "Today's Theme"
      : tab === 'weekly'
      ? "This Week's Top Cats"
      : 'All-Time Champions';

  const tabBtn = (key: Tab, label: string) => (
    <button
      onClick={() => setTab(key)}
      className={`flex-1 rounded-full py-2 text-sm font-bold transition-colors ${tab === key ? 'bg-pink-500 text-white shadow-sm' : 'text-neutral-500'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-[#FFF5F5] flex flex-col">
      {/* Header */}
      <div className="pt-4 pb-6 px-6 bg-gradient-to-b from-pink-100 to-[#FFF5F5] sticky top-0 z-20">
        <div className="flex justify-between items-center mb-4">
          <div className="w-10"></div>
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
          {tabBtn('daily', 'Daily')}
          {tabBtn('weekly', 'Weekly')}
          {tabBtn('alltime', 'All-Time')}
        </div>
      </div>

      <div className="px-6 pb-24">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-black text-lg text-neutral-800">{heading}</h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
          </div>
        ) : leaders.length === 0 ? (
          <div className="bg-white border border-pink-50 rounded-2xl p-6 text-center shadow-sm">
            <p className="text-sm font-medium text-neutral-500">
              {tab === 'daily' ? 'No entries in the current theme yet — be the first!' : 'No cats here yet. Upload to compete!'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {leaders.map((leader, index) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ layout: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.2 }, y: { duration: 0.2 } }}
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
                    src={leader.isRealImage ? leader.img : `https://images.unsplash.com/photo-${leader.img}?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80`}
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

                {!/^f\d$/.test(leader.id) && (
                  <button
                    onClick={() => setReportTarget({ id: leader.id, name: leader.name })}
                    className="shrink-0 p-2 text-neutral-300 hover:text-red-500 active:scale-90 transition-all"
                    aria-label="Report cat"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

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
