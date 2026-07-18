import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Clock, Play, ChevronRight, Sparkles, Gift, Bell, TrendingUp, MessageCircle, Share2, Plus, Star, Flame, PawPrint, Loader2, Flag, ShieldCheck, Maximize2 } from 'lucide-react';
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

  const trendingCat = topCats.length > 0 ? topCats[0] : null;
  const recentWinners = topCats.slice(0, 3);

  return (
    <div className="flex-1 overflow-y-auto bg-[#FFF5F5] relative pb-24">
      {/* Subtle paw print background pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M15 25c0 3.314-2.686 6-6 6s-6-2.686-6-6 2.686-6 6-6 6 2.686 6 6zm12-10c0 3.314-2.686 6-6 6s-6-2.686-6-6 2.686-6 6-6 6 2.686 6 6zm12 0c0 3.314-2.686 6-6 6s-6-2.686-6-6 2.686-6 6-6 6 2.686 6 6zm12 10c0 3.314-2.686 6-6 6s-6-2.686-6-6 2.686-6 6-6 6 2.686 6 6zM30 45c8.284 0 15-6.716 15-15 0-5.523-4.477-10-10-10-2.761 0-5 2.239-5 5s-2.239 5-5 5-5-2.239-5-5-2.239-5-5-5c-5.523 0-10 4.477-10 10 0 8.284 6.716 15 15 15z\' fill=\'%23000000\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")' }}></div>

      {/* Header */}
      <div className="pt-4 pb-4 px-6 flex justify-between items-center bg-[#FFF5F5] sticky top-0 z-20">
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
