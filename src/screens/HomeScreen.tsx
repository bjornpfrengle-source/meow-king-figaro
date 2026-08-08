import { useState, useEffect, useRef, type RefObject } from 'react';
import { motion } from 'motion/react';
import { Clock, Play, ChevronRight, Sparkles, Gift, Bell, TrendingUp, MessageCircle, Share2, Plus, Star, Flame, PawPrint, Loader2, Flag, ShieldCheck, Maximize2, Heart, Megaphone, Lock, Crown } from 'lucide-react';
import { CommentsSheet } from '../components/CommentsSheet';
import { useThemes, Countdown, isThemeRevealed } from '../components/themes';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, limit, getDocs, doc, getDoc, onSnapshot, where, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase';
import { ReportModal } from '../components/ReportModal';
import { BadgedAvatar } from '../components/BadgedAvatar';
import { LazyVideo } from '../components/LazyVideo';
import { topBadgeId } from '../components/rewards';
import { FOUNDING_PERIOD_OPEN } from '../components/limits';
import { YourCatToday } from '../components/YourCatToday';
import { NeedsAVote } from '../components/NeedsAVote';

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
  cry2?: string;
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

/**
 * The stats bar used to show an invented number here — a per-day random 850
 * to 1400 that climbed through the day, with the real count added on top. It
 * was scaffolding to keep an empty arena from looking dead, but it was a
 * factual claim made to users, and it would have gone on the App Store.
 *
 * It's now a real count. The honest framing problem it was hiding is solved a
 * different way: while the arena is small, lead with founding-member scarcity
 * (which is true, and flattering) rather than a crowd that isn't there.
 */

/**
 * Home's data, kept alive across navigation.
 *
 * React Router unmounts this screen the moment you tap Vote or Arena, so
 * coming back re-ran every fetch on it — a top-cats snapshot with a user
 * lookup each, a count query, then 25 cat docs plus 10 owner docs for Kitty
 * Kingdom. Roughly 40 reads and a completely fresh set of <video> elements
 * every time you returned to Home, which is why it re-loaded and stuttered on
 * each visit rather than loading once when the app opened.
 *
 * Module scope rather than state, so it genuinely survives unmount. The screen
 * paints from this instantly and refreshes underneath.
 */
const homeCache: {
  topCats: Cat[] | null;
  kingdom: KingdomCat[] | null;
  catCount: number | null;
  fetchedAt: number;
} = { topCats: null, kingdom: null, catCount: null, fetchedAt: 0 };

/** How long cached Home data is served before a background refresh. */
const HOME_CACHE_MS = 5 * 60 * 1000;

export function HomeScreen() {
  const navigate = useNavigate();
  const { user, userProfile, signIn, isPremium } = useFirebase();
  const { active, upcoming } = useThemes();
  const [topCats, setTopCats] = useState<Cat[]>(homeCache.topCats ?? []);
  const [realCatCount, setRealCatCount] = useState(homeCache.catCount ?? 0);
  // Only show the spinner on a genuinely cold start. Returning to Home with
  // cached data should paint immediately, not flash a loader.
  const [loading, setLoading] = useState(homeCache.topCats === null);
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);
  const [activeCommentCatId, setActiveCommentCatId] = useState<string | null>(null);
  const [kingdomCats, setKingdomCats] = useState<KingdomCat[]>(homeCache.kingdom ?? []);
  const [kingdomLikes, setKingdomLikes] = useState<Record<string, boolean>>({});
  const [kingdomVideo, setKingdomVideo] = useState<KingdomCat | null>(null);
  const [announcement, setAnnouncement] = useState<{ id: string; title: string; body?: string; videoUrl?: string; ctaLabel?: string; ctaUrl?: string } | null>(null);

  // Check for active announcements — shown once per announcement, ever.
  //
  // This used sessionStorage, which the WKWebView clears every time the app is
  // closed, so the popup reappeared on every single launch. localStorage
  // persists, so dismissing it once is permanent on that device. The key is
  // per-announcement id, so publishing a new announcement still shows to
  // everyone — it's only the same one that won't nag.
  useEffect(() => {
    const check = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'announcements'), where('isActive', '==', true), limit(5)));
        if (snap.empty) return;
        // Pick the most recently created active announcement
        const sorted = snap.docs.sort((a, b) => {
          const aMs = a.data().createdAt?.toMillis?.() ?? 0;
          const bMs = b.data().createdAt?.toMillis?.() ?? 0;
          return bMs - aMs;
        });
        const d = sorted[0];
        const seenKey = `announce_seen_${d.id}`;
        if (localStorage.getItem(seenKey)) return;
        localStorage.setItem(seenKey, '1');
        setAnnouncement({ id: d.id, ...(d.data() as any) });
      } catch (e) {
        // no-op: announcements are optional
      }
    };
    check();
  }, []);

  // (Removed: a 5s interval that randomly incremented the invented counter to
  // make it "feel live". The counter is a real figure now, so a timer that
  // inflates it would be straightforwardly false rather than decorative.)
  const trendingVideoRef = useRef<HTMLVideoElement>(null);

  const shareCat = async (name: string, cry?: string) => {
    const url = 'https://meow-king-figaro-production.up.railway.app';
    const text = cry ? `🐱 ${name}: "${cry}" — Vote now on Cat Chaos Arena!` : `🐱 ${name} is competing on Cat Chaos Arena!`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Cat Chaos Arena', text, url });
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        alert('Link copied!');
      }
    } catch (e) { /* user cancelled share */ }
  };

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

  const enterFullscreen = (ref: RefObject<HTMLVideoElement>, trimStart: number = 0) => {
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
        homeCache.topCats = fetchedCats;
        homeCache.fetchedAt = Date.now();
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

    // The "N cats competing today" figure is a headline number, not live data.
    // This used to be an onSnapshot over the entire cats collection, which meant
    // downloading every cat document — video URLs and all — and holding the
    // subscription open, purely to read snapshot.size. getCountFromServer
    // returns the count alone and costs a single read.
    let cancelled = false;
    getCountFromServer(collection(db, 'cats'))
      .then((res) => {
        homeCache.catCount = res.data().count;
        if (!cancelled) setRealCatCount(res.data().count);
      })
      .catch((e) => console.error('Error counting cats:', e));

    return () => {
      cancelled = true;
      unsubscribeTopCats();
    };
  }, []);

  useEffect(() => {
    // Kitty Kingdom is 25 cat docs plus 10 owner lookups — by far the most
    // expensive thing on this screen, and it re-ran on every return to Home.
    // It's a daily-shuffled feature row, not live data, so serving it from
    // cache for a few minutes is exactly right.
    if (homeCache.kingdom && Date.now() - homeCache.fetchedAt < HOME_CACHE_MS) {
      return;
    }
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
          let cry2: string | undefined;
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
              if (u.battleCry2) cry2 = u.battleCry2;
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
            cry2,
            score: cat.score || 0,
            ownerId: cat.ownerId,
            ownerName,
            ownerHandle,
            ownerImg,
          } as KingdomCat;
        }));

        homeCache.kingdom = withOwners;
        homeCache.fetchedAt = Date.now();
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
      {/* pt clears the status bar / notch — without it the header's top edge
          runs underneath system UI and taps land short. */}
      {/* Solid background, not backdrop-blur. A blurred sticky bar has to
          recomposite the blur every frame against whatever scrolls beneath it,
          and with autoplaying video underneath that runs on the main thread
          and makes the header itself feel laggy to tap. */}
      <div className="pt-[max(1rem,env(safe-area-inset-top))] pb-4 px-6 flex justify-between items-center bg-[#FFF5F5] sticky top-0 z-20 border-b border-pink-100/50">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-red-400 rounded-full flex items-center justify-center shadow-sm">
            <PawPrint className="w-5 h-5 text-white fill-white" />
          </div>
          <h1 className="text-xl font-black text-red-400">
            Meow Mayhem
          </h1>
        </div>
        {/* p-2.5 -m-2.5 grows the actual tap target to ~44px (Apple's minimum)
            without widening the visual gap between icons — these were bare
            w-6 h-6 icons with zero hit-area padding, well under that minimum,
            which is what made this bar specifically need repeated taps. */}
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/chat')} className="relative p-2.5 -m-2.5 active:scale-95 transition-transform">
            <MessageCircle className="w-6 h-6 text-red-400" />
          </button>
          <button onClick={() => navigate('/prizes')} className="relative p-2.5 -m-2.5 active:scale-95 transition-transform">
            <Gift className="w-6 h-6 text-red-400" />
          </button>
          <button onClick={() => navigate('/notifications')} className="relative p-2.5 -m-2.5 active:scale-95 transition-transform">
            <Bell className="w-6 h-6 text-red-400 fill-red-400" />
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-teal-400 rounded-full border-2 border-[#FFF5F5]"></span>
          </button>
          <button onClick={() => user ? navigate('/profile') : signIn()} className="p-1.5 -m-1.5 active:scale-95 transition-transform">
            {user ? (
              <BadgedAvatar
                src={userProfile?.photoURL || user.photoURL || "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80"}
                name={userProfile?.displayName || user.displayName}
                badgeId={topBadgeId(userProfile?.badges)}
                size={40}
              />
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
            {/* Only the next few. The roster is seeded a year out, so the full
                upcoming list is a long swipe of mostly-locked placeholder
                cards — which reads as a paywall wall rather than a tease. */}
            {upcoming.slice(0, 5).map((t, i) => (
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
                  <div className="min-w-0 flex-1">
                    {isThemeRevealed(t, isPremium) ? (
                      <>
                        <div className="bg-neutral-100 text-neutral-500 w-fit px-2.5 py-1 rounded-full mb-2 text-[10px] font-bold tracking-wider uppercase">
                          Upcoming Theme
                        </div>
                        <h2 className="text-xl font-black mb-1.5 leading-tight text-neutral-800">{t.title}</h2>
                      </>
                    ) : (
                      <>
                        {/* Title stays hidden until it unlocks — otherwise early
                            access means nothing, since the name is the whole secret. */}
                        <div className="bg-amber-100 text-amber-600 w-fit px-2.5 py-1 rounded-full mb-2 text-[10px] font-black tracking-wider uppercase flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> Locked
                        </div>
                        <div className="h-5 w-32 rounded-md bg-neutral-200 mb-2.5" />
                      </>
                    )}

                    <div className="flex items-center gap-1.5 text-neutral-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-xs font-bold">Starts in <Countdown toMs={t.startMs} /></span>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(isThemeRevealed(t, isPremium) ? '/theme' : '/premium')}
                    className={`p-3 rounded-full active:scale-95 transition-transform flex-shrink-0 ${
                      isThemeRevealed(t, isPremium)
                        ? 'bg-neutral-100 text-neutral-600'
                        : 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-md'
                    }`}
                  >
                    {isThemeRevealed(t, isPremium) ? <Bell className="w-5 h-5" /> : <Crown className="w-5 h-5" />}
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
            <span className="ml-3 text-teal-600 font-bold text-sm">
              {realCatCount.toLocaleString()} {realCatCount === 1 ? 'cat has' : 'cats have'} entered the arena
            </span>
          </div>
          <TrendingUp className="w-5 h-5 text-teal-500" />
        </div>

        {/* Founding-member framing. While the arena is genuinely small, "you're
            early" is both true and more appealing than a headcount — and it
            disappears on its own when FOUNDING_PERIOD_OPEN is flipped off. */}
        {FOUNDING_PERIOD_OPEN && userProfile?.isFoundingMember && (
          <div className="flex items-center gap-2 -mt-4 mb-8 px-4 py-2.5 rounded-full bg-amber-50 border border-amber-200">
            <Crown className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
            <span className="text-amber-700 font-bold text-xs">
              You're a founding member — unlimited uploads, for life
            </span>
          </div>
        )}

        <YourCatToday activeTheme={active} />

        <NeedsAVote activeTheme={active} />

        {/* Trending Mayhem */}
        <div className="mb-8">
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
                // The hero of this screen, so it's the one video that loads
                // eagerly. Everything else on Home is lazy so this gets the
                // bandwidth and the decoder slot instead of queueing behind
                // three thumbnail-sized clips.
                preload="auto"
                poster={(trendingCat as any).thumbnailUrl || undefined}
                autoPlay loop muted playsInline
                onLoadedMetadata={(e) => {
                  if (trendingCat.trimStart) e.currentTarget.currentTime = trendingCat.trimStart;
                  e.currentTarget.play().catch(() => {});
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

              {/* Actions: watch fullscreen, comment, share, report */}
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
                <button
                  onClick={() => shareCat(trendingCat.name, trendingCat.cry)}
                  className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform border border-white/20"
                  aria-label="Share"
                >
                  <Share2 className="w-5 h-5 text-white" />
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
                  {/* Deliberately a tall oval (3/5), not a circle. This used to
                      be aspect-square, but the video inside pushed the frame
                      taller than square and it rendered as an ellipse — which
                      is the look we actually want. Relying on that overflow
                      meant the shape came out differently in Chrome vs
                      WKWebView, so the ratio is now stated outright and both
                      render identically. Change this number, not the video, if
                      the shape ever needs adjusting. */}
                  <div className={`relative w-full aspect-[3/5] rounded-full border-4 p-1 mb-2 ${index === 0 ? 'border-yellow-400' : 'border-neutral-200'}`}>
                    {/* Lazy: these are ~80px circles that were each pulling a
                        full 720p clip on load, starving the Trending hero
                        above them of bandwidth and decode slots. */}
                    <LazyVideo
                      src={cat.videoUrl}
                      wrapperClassName="w-full h-full"
                      className="w-full h-full object-cover rounded-full cursor-pointer"
                      trimStart={cat.trimStart}
                      trimEnd={cat.trimEnd}
                      onClick={(el) => playFullscreen(el, cat.trimStart)}
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

        {/* ⭐ Kitty Kingdom */}
        {kingdomCats.length > 0 && (
          <div className="mb-8">
            <div className="flex justify-between items-end mb-3">
              <div>
                <h3 className="text-2xl font-black text-neutral-800 flex items-center gap-2">
                  <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
                  Kitty Kingdom
                </h3>
                <p className="text-xs font-black mt-0.5 bg-gradient-to-r from-pink-500 via-fuchsia-500 to-orange-400 bg-clip-text text-transparent">Today's featured cats · refreshes daily</p>
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
                // Cat2 only exists for Catnip Club members. Most cards are single-cat,
                // so that's the primary design — full-bleed photo like a real feature
                // card — rather than a quadrant layout with an empty placeholder half.
                const hasCat2 = !!(cat.catImg2 || cat.catName2);
                const heartBtn = (
                  <motion.button
                    whileTap={{ scale: 0.7 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setKingdomLikes(prev => ({ ...prev, [cat.id]: !prev[cat.id] }));
                    }}
                    className="absolute top-3 left-3 w-9 h-9 rounded-full flex items-center justify-center shadow-sm bg-black/40 backdrop-blur-sm z-10"
                  >
                    <Heart className={`w-4 h-4 transition-colors ${kingdomLikes[cat.id] ? 'fill-pink-500 text-pink-500' : 'text-white'}`} />
                  </motion.button>
                );
                const ownerBadge = (
                  <div className="absolute top-3 right-3 flex flex-col items-center gap-1 z-10">
                    <div className="p-[3px] rounded-full shadow-lg" style={{ background: `linear-gradient(135deg, ${p.ringA}, ${p.ringB})` }}>
                      {cat.ownerImg ? (
                        <img src={cat.ownerImg} alt="" className="w-11 h-11 rounded-full object-cover border-2 border-white" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-11 h-11 rounded-full flex items-center justify-center text-lg bg-white/90 border-2 border-white">😺</div>
                      )}
                    </div>
                    {cat.ownerHandle && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-black/50 text-white backdrop-blur-sm">@{cat.ownerHandle}</span>
                    )}
                  </div>
                );

                if (!hasCat2) {
                  return (
                    <motion.div
                      key={cat.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => setKingdomVideo(cat)}
                      className="min-w-[calc(100%-32px)] h-[300px] flex-shrink-0 snap-start cursor-pointer rounded-[2rem] overflow-hidden relative active:scale-[0.985] transition-transform"
                      style={{
                        border: `4px solid ${p.border}`,
                        boxShadow: `0 16px 48px -8px ${p.shadow}, 0 4px 16px -4px ${p.shadow}`,
                      }}
                    >
                      {cat.catImg ? (
                        <img src={cat.catImg} alt={cat.name} className="absolute inset-0 w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-7xl" style={{ backgroundColor: p.emptyBg }}>🐱</div>
                      )}

                      {/* Bottom scrim so name/cry stay legible over any photo */}
                      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/25 to-transparent pointer-events-none" />

                      {heartBtn}
                      {ownerBadge}

                      <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
                        <p className="font-black text-2xl leading-tight text-white drop-shadow-md">{cat.name}</p>
                        {cat.cry && (
                          <p className="text-sm italic leading-snug text-white/90 mt-1 line-clamp-2 drop-shadow-md">"{cat.cry}"</p>
                        )}
                      </div>
                    </motion.div>
                  );
                }

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

                    {/* BOTTOM-LEFT: cat 2 name + battle cry */}
                    <div className="absolute bottom-0 left-0 w-[52%] h-[50%] flex flex-col items-start justify-center pb-2 pl-4 pr-3">
                      <p className="font-black text-2xl leading-tight" style={{ color: p.nameTxt }}>{cat.catName2}</p>
                      {cat.cry2 && (
                        <p className="text-sm italic leading-snug mt-2 line-clamp-3" style={{ color: p.cryTxt }}>"{cat.cry2}"</p>
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
                  </motion.div>
                );
              });
            })()}
            {/* Right padding sentinel */}
            <div className="w-2 flex-shrink-0" />
            </div>
          </div>
        )}
      </div>

      {/* Announcement popup modal */}
      {announcement && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4 pb-8">
          <div className="w-full max-w-sm bg-white rounded-[2rem] overflow-hidden shadow-2xl">
            {announcement.videoUrl && (
              <div className="relative w-full aspect-video bg-black">
                <video
                  src={announcement.videoUrl}
                  className="w-full h-full object-cover"
                  autoPlay loop muted playsInline
                  onClick={e => { const v = e.currentTarget; v.muted = !v.muted; }}
                />
              </div>
            )}
            <div className="px-6 pt-5 pb-6">
              <div className="flex items-center gap-2 mb-3">
                <Megaphone className="w-5 h-5 text-purple-500 shrink-0" />
                <h2 className="font-black text-neutral-800 text-lg leading-tight">{announcement.title}</h2>
              </div>
              {announcement.body && (
                <p className="text-sm text-neutral-600 leading-relaxed mb-4">{announcement.body}</p>
              )}
              <div className="flex flex-col gap-2">
                {announcement.ctaLabel && announcement.ctaUrl && (
                  <a
                    href={announcement.ctaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-purple-500 text-white py-3 rounded-xl font-black text-center active:scale-95 transition-transform text-sm"
                  >
                    {announcement.ctaLabel}
                  </a>
                )}
                <button
                  onClick={() => setAnnouncement(null)}
                  className="w-full bg-neutral-100 text-neutral-600 py-3 rounded-xl font-bold text-sm active:scale-95 transition-transform"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                onClick={e => { e.stopPropagation(); shareCat(kingdomVideo.name, kingdomVideo.cry); }}
                className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 active:scale-95 transition-transform"
              >
                <Share2 className="w-5 h-5 text-white" />
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
