import { useState, useEffect } from 'react';
import { ChevronLeft, Loader2, Crown, Flame, ShieldCheck, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, limit, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useFirebase } from '../components/FirebaseProvider';

interface HofCat {
  id: string;
  name: string;
  cry?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  score: number;
  ownerName: string;
  isVerified?: boolean;
  trimStart?: number;
}

export function HallOfFameScreen() {
  const navigate = useNavigate();
  const { user } = useFirebase();
  const [cats, setCats] = useState<HofCat[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchHof = async () => {
      try {
        const q = query(collection(db, 'cats'), orderBy('score', 'desc'), limit(50));
        const snapshot = await getDocs(q);
        const fetched = await Promise.all(snapshot.docs.map(async (catDoc) => {
          const data = catDoc.data();
          let ownerName = 'Anonymous';
          if (data.ownerId) {
            try {
              const userDoc = await getDoc(doc(db, 'users', data.ownerId));
              if (userDoc.exists()) ownerName = userDoc.data().displayName || 'Anonymous';
            } catch (e) { /* ignore */ }
          }
          return {
            id: catDoc.id,
            name: data.name,
            cry: data.cry,
            videoUrl: data.videoUrl,
            thumbnailUrl: data.thumbnailUrl,
            score: data.score || 0,
            ownerName,
            isVerified: data.isVerified,
            trimStart: data.trimStart,
          } as HofCat;
        }));
        setCats(fetched);
      } catch (error) {
        console.error('Error loading hall of fame:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHof();
  }, [user]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#FFF5F5] flex flex-col pb-24">
      {/* Header */}
      <div className="pt-4 pb-4 px-6 flex items-center gap-4 bg-gradient-to-b from-yellow-50 to-[#FFF5F5] sticky top-0 z-20">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 bg-white rounded-full text-neutral-600 shadow-sm active:scale-95 transition-transform">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-500 fill-yellow-500" />
          <h1 className="text-xl font-black text-neutral-800">Hall of Fame</h1>
        </div>
      </div>

      <div className="px-5 space-y-3">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
          </div>
        ) : !user ? (
          <p className="text-neutral-500 text-center py-16 font-bold">Sign in to see the Hall of Fame.</p>
        ) : cats.length === 0 ? (
          <p className="text-neutral-500 text-center py-16 font-bold">No champions yet. Be the first!</p>
        ) : (
          cats.map((cat, index) => (
            <div
              key={cat.id}
              className={`flex items-center gap-4 p-3 rounded-2xl shadow-sm ${index === 0 ? 'bg-gradient-to-r from-yellow-50 to-yellow-100/50 border border-yellow-200' : 'bg-white border border-pink-50'}`}
            >
              <div className="w-8 shrink-0 flex justify-center font-black text-lg text-neutral-400">
                {index === 0 ? <Crown className="w-6 h-6 text-yellow-500 fill-yellow-500" /> : index + 1}
              </div>

              {/* Tappable video / thumbnail */}
              <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white shadow-sm shrink-0 bg-black">
                {cat.videoUrl ? (
                  <video
                    src={cat.videoUrl}
                    className="w-full h-full object-cover cursor-pointer"
                    autoPlay loop muted playsInline
                    onClick={(e) => playFullscreen(e.currentTarget, cat.trimStart)}
                    onLoadedMetadata={(e) => { if (cat.trimStart) e.currentTarget.currentTime = cat.trimStart; }}
                  />
                ) : (
                  <img src={cat.thumbnailUrl || 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=150&q=80'} alt={cat.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-neutral-800 truncate text-base flex items-center gap-1">
                  {cat.name}
                  {cat.isVerified && <ShieldCheck className="w-4 h-4 text-blue-500" />}
                </h3>
                {cat.cry && <p className="text-xs text-neutral-500 truncate italic">"{cat.cry}"</p>}
                <p className="text-[11px] text-neutral-400 truncate">{cat.ownerName}</p>
              </div>

              <div className="text-right shrink-0">
                <p className="font-black text-pink-500 flex items-center gap-1 justify-end">
                  <Flame className="w-4 h-4 fill-orange-400 text-orange-400" /> {cat.score}
                </p>
                <p className="text-[10px] font-bold text-neutral-400 uppercase">Votes</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
