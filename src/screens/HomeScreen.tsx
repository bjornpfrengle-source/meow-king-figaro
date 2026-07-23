import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Clock, Play, ChevronRight, Sparkles, Gift, Bell, TrendingUp, MessageCircle, Share2, Plus, Star, Flame, PawPrint, Loader2, Flag, ShieldCheck, Maximize2, Heart } from 'lucide-react';
import { CommentsSheet } from '../components/CommentsSheet';
import { useThemes, Countdown } from '../components/themes';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, limit, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { ReportModal } from '../components/ReportModal';

interface Cat {
  id: string;
  name: string;
  cry: string;
  videoUrl: string;
  score: number;
  ownerId?: string;
  ownerImg?: string;
  isVerified?: boolean;
  trimStart?: number;
  trimEnd?: number;
}

interface KingdomCat {
  id: string;
  name: string;
  cry: string;
  videoUrl: string;
  trimStart?: number;
  catImg?: string;
  catImg2?: string;
  catName2?: string;
  score: number;
  ownerId: string;
  ownerName: string;
  ownerHandle: string;
  ownerImg?: string;
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

import { useFirebase } from '../components/FirebaseProvider';

// A believable "cats competing today" base: modest, varies by day, climbs
// through the day. Computed synchronously so the counter never flashes 0.
function computeActivityBase() {
  const now = new Date();
  const dayIndex = Math.floor(now.getTime() / 86400000);
  const seed = Math.abs(Math.sin(dayIndex * 12.9898) * 43758.5453) % 1; // stable per day
  const dailyBase = 850 + Math.floor(seed * 550); // ~850–1400, varies daily
  const frac = (now.getHours() * 60 + now.getMinutes()) / 1440;
  const curve = 0.45 + 0.55 * frac; // climbs as the day goes on
  return Math.round(dailyBase * curve);
}

export function HomeScreen() {
  const navigate = useNavigate();
  const { user, userProfile, signIn } = useFirebase();
  const { active, upcoming } = useThemes();
  const [topCats, setTopCats] = useState<Cat[]>([]);
  const [totalCats, setTotalCats] = useState(computeActivityBase);
  const [realCatCount, setRealCatCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);
  const [activeCommentCatId, setActiveCommentCatId] = useState<string | null>(null);
  const [kingdomCats, setKingdomCats] = useState<KingdomCat[]>([]);
  const [kingdomLikes, setKingdomLikes] = useState<Record<string, boolean>>({});
  const [kingdomVideo, setKingdomVideo] = useState<KingdomCat | null>(null);

  // Ticks the counter up over time so it feels live (starts from the base,
  // which is already the initial state — no flash of 0).
  useEffect(() => {
    const id = setInterval(() => {
      setTotalCats((c) => c + (Math.random() < 0.65 ? Math.floor(Math.random() * 3) : 0));
    }, 5000);
    return () => clearInterval(id);
  }, []);
  const trendingVideoRef = useRef<HTMLVideoElement>(null);

  const playFullscreen = (v: any, trimStart: number = 0) => {
    if (!v) return;
    try {
      v.loop = true;
      v.currentTime = trimStart || 0;
      v.muted = false;
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* ignore */ }
    const remute = () => {
      v.muted = true;
      v.removeEventListener('webkitendfullscreen', remute);
      document.removeEventListener('fullscreenchange', onFsChange);
    };
    const onFsChange = () => { if (!document.fullscreenElement) remute(); };
    v.addEventListener('webkitendfullscreen', remute);
    document.addEventListener('fullscreenchange', onFsChange);
    if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
    else if (v.requestFullscreen) v.requestFullscreen();
  };

  const enterFullscreen = (ref: React.RefObject<HTMLVideoElement>, trimStart: number = 0) => {
    playFullscreen(ref.current, trimStart);
  };

  useEffect(() => {
    const q = query(collection(db, 'cats'), orderBy('score', 'desc'), limit(4));
    
    const unsubscribeTopCats = onSnapshot(q, async (snapshot) => {
      try {
        const fetchedCats = await Promise.all(snapshot.docs.map(async (catDoc) => {
          const data = catDoc.data();
          let ownerImg = undefined;
          if (data.ownerId) {
            try {
              const userDoc = await getDoc(doc(db, 'users', data.ownerId));
              if (userDoc.exists() && userDoc.data().photoURL) {
                ownerImg = userDoc.data().photoURL;
              }
            } catch (e) {
              console.error('Error fetching user for home screen:', e);
            }
          }
          return { id: catDoc.id, ...data, ownerImg } as Cat;
        }));
        setTopCats(fetchedCats);
      } catch (error) {
        console.error('Error processing top cats:', error);
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error('Error fetching top cats:', error);
      setLoading(false);
    });

    const unsubscribeTotal = onSnapshot(collection(db, 'cats'), (snapshot) => {
      setRealCatCount(snapshot.size);
    });

    return () => {
      unsubscribeTopCats();
      unsubscribeTotal();
    };
  }, []);

  useEffect(() => {
    const fetchKingdom = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'cats'), orderBy('score', 'desc'), limit(25)));
        const cats = snap.docs
          .map(d => ({ id: d.id, ...(d.data() as any) }))
          .filter((c: any) => !!c.videoUrl);

        const dayIndex = Math.floor(Date.now() / 86400000);
        const featured = seededShuffle(cats, dayIndex).slice(0, 10);

        const withOwners = await Promise.all(featured.map(async (cat: any) => {
          let ownerHandle = '';
          let ownerName = '';
          let ownerImg: string | undefined;
          let catImg: string | undefined = cat.thumbnailUrl;
          let catImg2: string | undefined;
          let catName2: string | undefined;
          try {
            const uDoc = await getDoc(doc(db, 'users', cat.ownerId));
            if (uDoc.exists()) {
              const u = uDoc.data() as any;
              ownerHandle = u.socialHandle || u.email?.split('@')[0] || '';
              ownerName = u.displayName || '';
              ownerImg = u.photoURL;
              if (u.catThumbnailUrl) catImg = u.catThumbnailUrl;
              if (u.catThumbnailUrl2) catImg2 = u.catThumbnailUrl2;
              if (u.catName2) catName2 = u.catName2;
            }
          } catch (_) {}
          return {
            id: cat.id,
            name: cat.name || 'Unknown Cat',
            cry: cat.cry || '',
            videoUrl: cat.videoUrl,
            trimStart: cat.trimStart,
            catImg,
            catImg2,
            catName2,
            score: cat.score || 0,
            ownerId: cat.ownerId,
            ownerName,
            ownerHandle,
            ownerImg,
          } as KingdomCat;
        }));

        setKingdomCats(withOwners);
      } catch (e) {
        console.error('Error fetching Kitty Kingdom:', e);
      }
    };
    fetchKingdom();
  }, []);

  const trendingCat = topCats.length > 0 ? topCats[0] : null;
  const recentWinners = topCats.slice(0, 3);

  return (
    <div className="flex-1 overflow-y-auto bg-[#FFF5F5] relative pb-24">
      {/* Subtle paw print background pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M15 25c0 3.314-2.686 6-6 6s-6-2.686-6-6 2.686-6 6-6 6 2.686 6 6zm12-10c0 3.314-2.686 6-6 6s-6-2.686-6-6 2.686-6 6-6 6 2.686 6 6zm12 0c0 3.314-2.686 6-6 6s-6-2.686-6-6 2.686-6 6-6 6 2.686 6 6zm12 10c0 3.314-2.686 6-6 6s-6-2.686-6-6 2.686-6 6-6 6 2.686 6 6zM30 45c8.284 0 15-6.716 15-15 0-5.523-4.477-10-10-10-2.761 0-5 2.239-5 5s-2.239 5-5 5-5-2.239-5-5-2.239-5-5-5c-5.523 0-10 4.477-10 10 0 8.284 6.716 15 15 15z\' fill=\'%23000000\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")' }}></div>

      {/* Header */}
      <div className="pt-4 pb-4 px-6 flex justify-between items-center bg-[#FFF5F5]/70 backdrop-blur-xl sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-red-400 rounded-full flex items-center justify-center shadow-sm">
            <PawPrint className="w-5 h-5 text-white fill-white" />
          </div>
          <h1 className="text-xl font-black text-red-400">
            Meow Mayhem
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/chat')} className="relative active:scale-95 transition-transform">
            <MessageCircle className="w-6 h-6 text-red-400" />
          </button>
          <button onClick={() => navigate('/prizes')} className="relative active:scale-95 transition-transform">
            <Gift className="w-6 h-6 text-red-400" />
          </button>
          <button onClick={() => navigate('/notifications')} className="relative active:scale-95 transition-transform">
            <Bell className="w-6 h-6 text-red-400 fill-red-400" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-teal-400 rounded-full border-2 border-[#FFF5F5]"></span>
          </button>
          <button onClick={() => user ? navigate('/profile') : signIn()} className="active:scale-95 transition-transform">
            {user ? (
              <img src={userProfile?.photoURL || user.photoURL || "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80"} alt="Profile" className="w-10 h-10 rounded-full border-2 border-red-400 object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 rounded-full border-2 border-red-400 bg-white flex items-center justify-center text-red-400 font-bold text-xs">Login</div>
            )}
          </button>
        </div>
      </div>

      <div className="px-6">
        {/* Hero Banner */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[2rem] text-white shadow-lg relative overflow-hidden mt-2 p-6 bg-gradient-to-br from-red-400 via-orange-400 to-orange-300"
        >
          <div className="absolute top-4 right-4 opacity-50">
            <PawPrint className="w-12 h-12 text-yellow-200 fill-yellow-200" />
          </div>
          
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div>
              <div className="bg-white/20 w-fit px-3 py-1 rounded-full backdrop-blur-sm mb-3 text-xs font-bold tracking-wider uppercase">
                Daily Theme
              </div>
              <h2 className="text-3xl font-black mb-2 leading-tight">{active ? active.title : 'No active theme'}</h2>

              <motion.div
                animate={{ opacity: [1, 0.7, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="flex items-center gap-1.5 text-white/90"
              >
                <Clock className="w-4 h-4" />
                {active ? (
                  <span className="text-sm font-bold"><Countdown toMs={active.endMs} /> left</span>
                ) : (
                  <span className="text-sm font-bold">New challenge coming soon</span>
                )}
              </motion.div>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                onClick={() => navigate(active ? `/upload?event=${encodeURIComponent(active.slug)}` : '/theme')}
                className="bg-white text-red-400 px-6 py-3 rounded-full font-black text-sm shadow-md active:scale-95 transition-transform"
              >
                ENTER NOW
              </button>
            </div>
          </div>
        </motion.div>

        {/* Upcoming Event Banners */}
        {upcoming.length > 0 && (
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 mt-4 pb-2 -mx-6 px-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {upcoming.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * (i + 1) }}
                className="min-w-[85%] shrink-0 snap-center rounded-[2rem] shadow-sm relative overflow-hidden p-5 bg-white border-2 border-neutral-100"
              >
                <div className="absolute -right-2 -bottom-2 opacity-5 pointer-events-none">
                  <Sparkles className="w-24 h-24 text-neutral-800" />
                </div>

                <div className="relative z-10 flex flex-row items-center justify-between">
                  <div>
                    <div className="bg-neutral-100 text-neutral-500 w-fit px-2.5 py-1 rounded-full mb-2 text-[10px] font-bold tracking-wider uppercase">
                      Upcoming Theme
                    </div>
                    <h2 className="text-xl font-black mb-1.5 leading-tight text-neutral-800">{t.title}</h2>

                    <div className="flex items-center gap-1.5 text-neutral-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-xs font-bold">Starts in <Countdown toMs={t.startMs} /></span>
                    </div>
                  </div>

                  <button onClick={() => navigate('/theme')} className="bg-neutral-100 text-neutral-600 p-3 rounded-full active:scale-95 transition-transform flex-shrink-0">
                    <Bell className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Stats Bar */}
        <div className="flex items-center justify-between bg-teal-50/80 backdrop-blur-sm px-4 py-3 rounded-full mt-6 mb-8 border border-teal-100">
          <div className="flex items-center">
            <div className="flex -space-x-2">
              <img src={topCats[0]?.ownerImg || "https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80"} alt="Cat" className="w-8 h-8 rounded-full border-2 border-white object-cover" referrerPolicy="no-referrer" />
              <img src={topCats[1]?.ownerImg || "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80"} alt="Cat" className="w-8 h-8 rounded-full border-2 border-white object-cover" referrerPolicy="no-referrer" />
              <div className="w-8 h-8 rounded-full border-2 border-white bg-teal-400 flex items-center justify-center text-white z-10">
                <Plus className="w-4 h-4" />
              </div>
            </div>
            <span className="ml-3 text-teal-600 font-bold text-sm">{(totalCats + realCatCount).toLocaleString()} cats competing today</span>
          </div>
          <TrendingUp className="w-5 h-5 text-teal-500" />
        </div>

        {/* ⭐ Kitty Kingdom */}
        {kingdomCats.length > 0 && (
          <div className="mb-8">
            <div className="flex justify-between items-end mb-3">
              <div>
                <h3 className="text-2xl font-black text-neutral-800 flex items-center gap-2">
                  <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
                  Kitty Kingdom
                </h3>
                <p className="text-xs font-bold text-neutral-400 mt-0.5">Today's featured cats · refreshes daily</p>
              </div>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 [&::-webkit-scrollbar]:hidden snap-x snap-mandatory scroll-pl-6">
            {(() => {
              const KP = [
                { bg: '#fdf2f8', border: '#f472b6', nameTxt: '#701a75', cryTxt: '#be185d', ringA: '#f9a8d4', ringB: '#ec4899', handleBg: '#fce7f3', handleTxt: '#9d174d', emptyBg: '#fce7f3', shadow: 'rgba(244,114,182,0.25)' },
                { bg: '#fff7ed', border: '#fb923c', nameTxt: '#7c2d12', cryTxt: '#c2410c', ringA: '#fdba74', ringB: '#ea580c', handleBg: '#ffedd5', handleTxt: '#9a3412', emptyBg: '#ffedd5', shadow: 'rgba(251,146,60,0.25)' },
                { bg: '#f0fdfa', border: '#2dd4bf', nameTxt: '#134e4a', cryTxt: '#0f766e', ringA: '#5eead4', ringB: '#0d9488', handleBg: '#ccfbf1', handleTxt: '#115e59', emptyBg: '#ccfbf1', shadow: 'rgba(45,212,191,0.25)' },
                { bg: '#fefce8', border: '#eab308', nameTxt: '#713f12', cryTxt: '#a16207', ringA: '#fde047', ringB: '#ca8a04', handleBg: '#fef9c3', handleTxt: '#713f12', emptyBg: '#fef9c3', shadow: 'rgba(234,179,8,0.25)' },
                { bg: '#faf5ff', border: '#c084fc', nameTxt: '#4c1d95', cryTxt: '#7c3aed', ringA: '#d8b4fe', ringB: '#a855f7', handleBg: '#f3e8ff', handleTxt: '#5b21b6', emptyBg: '#f3e8ff', shadow: 'rgba(192,132,252,0.25)' },
              ];
              return kingdomCats.map((cat, i) => {
                const p = KP[i % KP.length];
                return (
                  <motion.div
                    key={cat.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => setKingdomVideo(cat)}
                    className="min-w-[calc(100%-32px)] h-[300px] flex-shrink-0 snap-start cursor-pointer rounded-[2rem] overflow-hidden relative active:scale-[0.985] transition-transform"
                    style={{
                      backgroundColor: p.bg,
                      border: `4px solid ${p.border}`,
                      boxShadow: `0 16px 48px -8px ${p.shadow}, 0 4px 16px -4px ${p.shadow}`,
                    }}
                  >
                    {/* TOP-LEFT quadrant: cat 1 photo */}
                    <div
                      className="absolute top-0 left-0 w-[48%] h-[50%] overflow-hidden"
                      style={{ borderBottomRightRadius: '1.5rem', borderBottom: `4px solid ${p.border}`, borderRight: `4px solid ${p.border}` }}
                    >
                      {cat.catImg ? (
                        <img src={cat.catImg} alt={cat.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-5xl" style={{ backgroundColor: p.emptyBg }}>🐱</div>
                      )}
                    </div>

                    {/* BOTTOM-RIGHT quadrant: cat 2 photo */}
                    <div
                      className="absolute bottom-0 right-0 w-[48%] h-[50%] overflow-hidden"
                      style={{ borderTopLeftRadius: '1.5rem', borderTop: `4px solid ${p.border}`, borderLeft: `4px solid ${p.border}` }}
                    >
                      {cat.catImg2 ? (
                        <img src={cat.catImg2} alt={cat.catName2 || ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl" style={{ backgroundColor: p.emptyBg }}>🐾</div>
                      )}
                    </div>

                    {/* TOP-RIGHT: cat 1 name + battle cry */}
                    <div className="absolute top-0 right-0 w-[52%] h-[50%] flex flex-col items-end justify-center pt-2 pr-4 pl-3">
                      <p className="font-black text-2xl leading-tight text-right" style={{ color: p.nameTxt }}>{cat.name}</p>
                      {cat.cry && (
                        <p className="text-sm italic leading-snug text-right mt-2 line-clamp-3" style={{ color: p.cryTxt }}>"{cat.cry}"</p>
                      )}
                    </div>

                    {/* BOTTOM-LEFT: cat 2 name */}
                    <div className="absolute bottom-0 left-0 w-[52%] h-[50%] flex flex-col items-start justify-center pb-2 pl-4 pr-3">
                      {cat.catName2 ? (
                        <p className="font-black text-2xl leading-tight" style={{ color: p.nameTxt }}>{cat.catName2}</p>
                      ) : (
                        <span className="text-xs font-bold italic" style={{ color: p.cryTxt, opacity: 0.5 }}>—</span>
                      )}
                    </div>

                    {/* CENTER: user avatar + handle + heart */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 z-10">
                      <div className="p-[3px] rounded-full shadow-lg" style={{ background: `linear-gradient(135deg, ${p.ringA}, ${p.ringB})` }}>
                        {cat.ownerImg ? (
                          <img src={cat.ownerImg} alt="" className="w-16 h-16 rounded-full object-cover" style={{ border: `3px solid ${p.bg}` }} referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl" style={{ border: `3px solid ${p.bg}`, backgroundColor: p.emptyBg }}>😺</div>
                        )}
                      </div>
                      {cat.ownerHandle && (
                        <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full" style={{ backgroundColor: p.handleBg, color: p.handleTxt }}>@{cat.ownerHandle}</span>
                      )}
                      <motion.button
                        whileTap={{ scale: 0.7 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setKingdomLikes(prev => ({ ...prev, [cat.id]: !prev[cat.id] }));
                        }}
                        className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm"
                        style={{ backgroundColor: p.handleBg }}
                      >
                        <Heart className={`w-4 h-4 transition-colors ${kingdomLikes[cat.id] ? 'fill-pink-500 text-pink-500' : ''}`} style={!kingdomLikes[cat.id] ? { color: p.border } : {}} />
                      </motion.button>
                    </div>

                    {/* Featured badge */}
                    <div className="absolute top-3 left-3 text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 z-10 shadow-sm" style={{ backgroundColor: p.handleBg, color: p.nameTxt, border: `1.5px solid ${p.border}` }}>
                      <Star className="w-3 h-3" style={{ fill: p.nameTxt, color: p.nameTxt }} /> Featured
                    </div>
                  </motion.div>
                );
              });
            })()}
            {/* Right padding sentinel */}
            <div className="w-2 flex-shrink-0" />
            </div>
          </div>
        )}

        {/* Recent Winners */}
        <div className="mb-8">
          <div className="flex justify-between items-end mb-4">
            <h3 className="text-2xl font-black text-neutral-800">Recent Winners</h3>
            <button onClick={() => navigate('/hall-of-fame')} className="text-sm text-red-400 font-bold active:scale-95 transition-transform">See Hall of Fame</button>
          </div>
          
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
            </div>
          ) : recentWinners.length > 0 ? (
            <div className="flex justify-between gap-4">
              {recentWinners.map((cat, index) => (
                <motion.div layout key={cat.id} className="flex flex-col items-center flex-1">
                  <div className={`relative w-full aspect-square rounded-full border-4 p-1 mb-2 ${index === 0 ? 'border-yellow-400' : 'border-neutral-200'}`}>
                    <video
                      src={cat.videoUrl}
                      className="w-full h-full object-cover rounded-full cursor-pointer"
                      autoPlay loop muted playsInline
                      onClick={(e) => playFullscreen(e.currentTarget, cat.trimStart)}
                      onLoadedMetadata={(e) => {
                        if (cat.trimStart) e.currentTarget.currentTime = cat.trimStart;
                      }}
                      onTimeUpdate={(e) => {
                        if (cat.trimStart !== undefined && cat.trimEnd !== undefined) {
                          if (e.currentTarget.currentTime >= cat.trimEnd || e.currentTarget.currentTime < cat.trimStart) {
                            e.currentTarget.currentTime = cat.trimStart;
                          }
                        }
                      }}
                    />
                    <div className={`absolute -top-2 -left-2 text-white w-7 h-7 rounded-full flex items-center justify-center font-black text-xs border-2 border-white ${index === 0 ? 'bg-yellow-400 text-neutral-900' : 'bg-teal-400'}`}>
                      #{index + 1}
                    </div>
                    {index === 0 && (
                      <div className="absolute -bottom-2 -right-2 bg-yellow-400 w-10 h-10 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                        <Star className="w-5 h-5 text-white fill-white" />
                      </div>
                    )}
                  </div>
                  <p className={`font-bold text-xs text-center flex items-center justify-center gap-1 ${index === 0 ? 'text-red-400 uppercase leading-tight' : 'text-neutral-500'}`}>
                    {cat.name}
                    {cat.isVerified && <ShieldCheck className="w-3 h-3 text-blue-500" />}
                  </p>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-neutral-500 text-center py-4">No winners yet. Be the first!</p>
          )}
        </div>

        {/* Trending Mayhem */}
        <div>
          <h3 className="text-2xl font-black text-neutral-800 mb-4">Trending Mayhem</h3>
          
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
            </div>
          ) : trendingCat ? (
            <div className="relative rounded-3xl overflow-hidden h-[280px] shadow-md">
              <video
                ref={trendingVideoRef}
                src={trendingCat.videoUrl}
                className="w-full h-full object-cover"
                autoPlay loop muted playsInline
                onLoadedMetadata={(e) => {
                  if (trendingCat.trimStart) e.currentTarget.currentTime = trendingCat.trimStart;
                }}
                onTimeUpdate={(e) => {
                  if (trendingCat.trimStart !== undefined && trendingCat.trimEnd !== undefined) {
                    if (e.currentTarget.currentTime >= trendingCat.trimEnd || e.currentTarget.currentTime < trendingCat.trimStart) {
                      e.currentTarget.currentTime = trendingCat.trimStart;
                    }
                  }
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>

              {/* Actions: watch fullscreen, comment, report */}
              <div className="absolute right-4 bottom-4 flex flex-col gap-3">
                <button
                  onClick={() => enterFullscreen(trendingVideoRef, trendingCat.trimStart)}
                  className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform border border-white/20"
                  aria-label="Watch full screen"
                >
                  <Maximize2 className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={() => setActiveCommentCatId(trendingCat.id)}
                  className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform border border-white/20"
                  aria-label="Comments"
                >
                  <MessageCircle className="w-5 h-5 text-white fill-white" />
                </button>
                <button onClick={() => setReportTarget({ id: trendingCat.id, name: trendingCat.name })} className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform border border-white/20">
                  <Flag className="w-5 h-5 text-red-400" />
                </button>
              </div>

              {/* Bottom Info */}
              <div className="absolute bottom-4 left-4 right-20">
                <h4 className="text-white font-black text-xl mb-1 flex items-center gap-2">
                  {trendingCat.name}
                  {trendingCat.isVerified && <ShieldCheck className="w-5 h-5 text-blue-400" />}
                </h4>
                <p className="text-white/90 text-sm mb-1 leading-tight">{trendingCat.cry}</p>
                <p className="text-yellow-400 text-sm font-bold flex items-center gap-1">
                  <Flame className="w-4 h-4 fill-yellow-400" /> {trendingCat.score} Votes
                </p>
              </div>
            </div>
          ) : (
            <p className="text-neutral-500 text-center py-4">Upload a cat to start the mayhem!</p>
          )}
        </div>
      </div>

      {/* Kingdom video modal */}
      {kingdomVideo && (
        <div className="fixed inset-0 z-[80] bg-black flex flex-col" onClick={() => setKingdomVideo(null)}>
          {/* Video */}
          <div className="relative flex-1 overflow-hidden" onClick={e => e.stopPropagation()}>
            <video
              key={kingdomVideo.id}
              src={kingdomVideo.videoUrl}
              className="w-full h-full object-cover"
              autoPlay loop muted playsInline
              onLoadedMetadata={e => { if (kingdomVideo.trimStart) e.currentTarget.currentTime = kingdomVideo.trimStart; }}
              onClick={e => { const v = e.currentTarget; v.muted = !v.muted; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/50 pointer-events-none" />

            {/* Top bar: close + view profile */}
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-12 pb-4">
              <button
                onClick={() => setKingdomVideo(null)}
                className="w-10 h-10 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20"
              >
                <span className="text-white text-xl font-bold leading-none">×</span>
              </button>
              <button
                onClick={() => { setKingdomVideo(null); navigate(`/user/${kingdomVideo.ownerId}`); }}
                className="flex items-center gap-1.5 bg-white/15 backdrop-blur-md border border-white/25 text-white text-xs font-bold px-4 py-2 rounded-full active:scale-95 transition-transform"
              >
                {kingdomVideo.ownerImg && (
                  <img src={kingdomVideo.ownerImg} alt="" className="w-5 h-5 rounded-full object-cover border border-white/30" referrerPolicy="no-referrer" />
                )}
                View Profile →
              </button>
            </div>

            {/* Right side action buttons */}
            <div className="absolute right-4 bottom-24 flex flex-col gap-3">
              <button
                onClick={e => { e.stopPropagation(); const v = e.currentTarget.closest('.relative')?.querySelector('video') as HTMLVideoElement; if (v) playFullscreen(v, kingdomVideo.trimStart); }}
                className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 active:scale-95 transition-transform"
              >
                <Maximize2 className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); setKingdomVideo(null); setActiveCommentCatId(kingdomVideo.id); }}
                className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 active:scale-95 transition-transform"
              >
                <MessageCircle className="w-5 h-5 text-white fill-white" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); setKingdomVideo(null); setReportTarget({ id: kingdomVideo.id, name: kingdomVideo.name }); }}
                className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 active:scale-95 transition-transform"
              >
                <Flag className="w-5 h-5 text-red-400" />
              </button>
            </div>

            {/* Bottom info */}
            <div className="absolute bottom-0 left-0 right-20 px-4 pb-6">
              <h4 className="text-white font-black text-2xl mb-1 leading-tight">{kingdomVideo.name}</h4>
              {kingdomVideo.cry && <p className="text-white/80 text-sm mb-2 leading-snug">{kingdomVideo.cry}</p>}
              <p className="text-yellow-400 text-sm font-bold flex items-center gap-1.5">
                <Flame className="w-4 h-4 fill-yellow-400" /> {kingdomVideo.score} Votes
              </p>
            </div>
          </div>
        </div>
      )}

      <ReportModal
        isOpen={!!reportTarget}
        onClose={() => setReportTarget(null)}
        targetType="cat"
        targetId={reportTarget?.id ?? null}
        targetName={reportTarget?.name}
      />

      <CommentsSheet
        isOpen={!!activeCommentCatId}
        catId={activeCommentCatId}
        onClose={() => setActiveCommentCatId(null)}
      />
    </div>
  );
}
