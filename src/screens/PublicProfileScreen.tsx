import { useState, useEffect } from 'react';
import { ChevronLeft, Loader2, Trophy, Flame, Ban, Check } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, query, where, getDocs, getDoc, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { useFirebase } from '../components/FirebaseProvider';

interface Cat {
  id: string;
  name: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  score: number;
  theme?: string;
  trimStart?: number;
  framePosition?: number;
}

export function PublicProfileScreen() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useFirebase();
  const [profile, setProfile] = useState<any>(null);
  const [cats, setCats] = useState<Cat[]>([]);
  const [wins, setWins] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const isSelf = user?.uid === uid;
  const isBlocked = (userProfile?.blockedUserIds || []).includes(uid || '');

  const playFullscreen = (v: any, trimStart: number = 0) => {
    if (!v) return;
    try {
      v.loop = true;
      v.currentTime = trimStart || 0;
      v.muted = false;
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* ignore */ }
    const remute = () => { v.muted = true; v.removeEventListener('webkitendfullscreen', remute); document.removeEventListener('fullscreenchange', onFs); };
    const onFs = () => { if (!document.fullscreenElement) remute(); };
    v.addEventListener('webkitendfullscreen', remute);
    document.addEventListener('fullscreenchange', onFs);
    if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
    else if (v.requestFullscreen) v.requestFullscreen();
  };

  useEffect(() => {
    if (!uid) return;
    const load = async () => {
      try {
        const uDoc = await getDoc(doc(db, 'users', uid));
        setProfile(uDoc.exists() ? uDoc.data() : null);

        const snap = await getDocs(query(collection(db, 'cats'), where('ownerId', '==', uid)));
        const theirCats = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).filter((c: any) => !!c.videoUrl);
        setCats(theirCats);

        // Count "wins": themes where this user's cat is the top-voted entry
        const themes = Array.from(new Set(theirCats.map((c: any) => c.theme).filter(Boolean)));
        let winCount = 0;
        await Promise.all(themes.map(async (th) => {
          try {
            const tsnap = await getDocs(query(collection(db, 'cats'), where('theme', '==', th)));
            let topScore = -1; let topOwner: string | null = null;
            tsnap.forEach((d) => { const x = d.data(); if ((x.score || 0) > topScore) { topScore = x.score || 0; topOwner = x.ownerId; } });
            if (topOwner === uid) winCount++;
          } catch (e) { /* ignore */ }
        }));
        setWins(winCount);
      } catch (e) {
        console.error('Error loading profile:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [uid]);

  const toggleBlock = async () => {
    if (!user || !uid) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        blockedUserIds: isBlocked ? arrayRemove(uid) : arrayUnion(uid),
      });
    } catch (e) {
      console.error('Error updating block:', e);
      alert('Could not update. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const totalVotes = cats.reduce((s, c) => s + (c.score || 0), 0);

  if (loading) {
    return (
      <div className="flex-1 bg-[#FFF5F5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#FFF5F5] flex flex-col pb-24">
      {/* Header */}
      <div className="pt-4 pb-4 px-6 flex items-center gap-4 bg-[#FFF5F5]/80 backdrop-blur-md sticky top-0 z-20">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 bg-white rounded-full text-neutral-600 shadow-sm active:scale-95 transition-transform">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-black text-neutral-800">Profile</h1>
      </div>

      {!profile ? (
        <p className="text-neutral-500 text-center py-16 font-bold">This user couldn't be found.</p>
      ) : (
        <div className="px-6">
          {/* User info */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-xl bg-neutral-200 mb-3">
              <img
                src={profile.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.displayName || 'Cat')}&background=random`}
                alt={profile.displayName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <h2 className="text-2xl font-black text-neutral-800">{profile.displayName || 'Anonymous Cat'}</h2>
            {profile.socialHandle && <p className="text-sm font-bold text-pink-500">@{profile.socialHandle}</p>}

            {/* Stats */}
            <div className="flex gap-6 mt-5 bg-white px-6 py-4 rounded-3xl shadow-sm border border-pink-50 w-full justify-between">
              <div className="text-center flex-1">
                <p className="font-black text-2xl text-neutral-800">{cats.length}</p>
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Cats</p>
              </div>
              <div className="w-px bg-pink-100"></div>
              <div className="text-center flex-1">
                <p className="font-black text-2xl text-neutral-800">{totalVotes}</p>
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Votes</p>
              </div>
              <div className="w-px bg-pink-100"></div>
              <div className="text-center flex-1">
                <div className="flex items-center justify-center gap-1">
                  <Trophy className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  <p className="font-black text-2xl text-neutral-800">{wins}</p>
                </div>
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Wins</p>
              </div>
            </div>

            {/* Block / Unblock (not on your own profile) */}
            {!isSelf && user && (
              <button
                onClick={toggleBlock}
                disabled={busy}
                className={`mt-4 px-5 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 active:scale-95 transition-transform ${isBlocked ? 'bg-neutral-200 text-neutral-700' : 'bg-white border border-red-200 text-red-500'}`}
              >
                {isBlocked ? <><Check className="w-4 h-4" /> Blocked — tap to unblock</> : <><Ban className="w-4 h-4" /> Block user</>}
              </button>
            )}
          </div>

          {/* Their cats */}
          <h3 className="font-black text-lg text-neutral-800 mb-3">Feline Fighters</h3>
          {cats.length === 0 ? (
            <p className="text-neutral-500 text-sm text-center py-6">No entries yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {cats.map((cat) => (
                <div key={cat.id} className="relative rounded-2xl overflow-hidden aspect-[3/4] bg-black shadow-sm">
                  <video
                    src={cat.videoUrl}
                    className="w-full h-full object-cover cursor-pointer"
                    style={{ objectPosition: `center ${cat.framePosition ?? 35}%` }}
                    autoPlay loop muted playsInline
                    onClick={(e) => playFullscreen(e.currentTarget, cat.trimStart)}
                    onLoadedMetadata={(e) => { if (cat.trimStart) e.currentTarget.currentTime = cat.trimStart; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex flex-col justify-end p-3 pointer-events-none">
                    <p className="text-white font-bold text-sm truncate">{cat.name}</p>
                    <p className="text-white/90 text-xs font-bold flex items-center gap-1"><Flame className="w-3 h-3 fill-orange-400 text-orange-400" /> {cat.score} votes</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
