import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Settings, Award, Plus, Video, ToggleRight, ToggleLeft, Trophy, Grid, Loader2, ShieldCheck, ShieldAlert, CalendarClock, Star, Trash2 } from 'lucide-react';
import { DIGITAL_REWARDS } from '../components/rewards';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db, storage } from '../firebase';
import { useFirebase } from '../components/FirebaseProvider';
import { SettingsModal } from '../components/SettingsModal';

interface Cat {
  id: string;
  name: string;
  cry: string;
  videoUrl: string;
  thumbnailUrl?: string;
  score: number;
  isVerified?: boolean;
  trimStart?: number;
  trimEnd?: number;
}

interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  socialHandle?: string;
  catName?: string;
  battleCry?: string;
  catName2?: string;
  battleCry2?: string;
}

export function ProfileScreen() {
  const navigate = useNavigate();
  const { user, userProfile, signIn, isAdmin } = useFirebase();
  const [myCats, setMyCats] = useState<Cat[]>([]);
  const [trophies, setTrophies] = useState<{ theme: string; title: string; champion: boolean; votes: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const handleDeleteCat = async (catId: string, catName: string) => {
    if (!window.confirm(`Remove ${catName}'s entry? This deletes the video from the competition.`)) return;
    try {
      await deleteDoc(doc(db, 'cats', catId));
      setMyCats((prev) => prev.filter((c) => c.id !== catId));
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Could not delete right now. Please try again.');
    }
  };

  const handleToggleRepost = async () => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const newValue = !(userProfile?.allowRepost ?? false);
      await updateDoc(userRef, { allowRepost: newValue });
    } catch (error) {
      console.error('Error updating repost permission:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Fetch user's cats
        const q = query(
          collection(db, 'cats'),
          where('ownerId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const fetchedCats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cat));
        setMyCats(fetchedCats);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Build the trophy cabinet from real theme entries. One trophy per theme the
  // user's cats have entered; gold "Champion" if their cat is the top-voted in
  // that theme, otherwise a "Competed" trophy.
  useEffect(() => {
    if (!user || myCats.length === 0) {
      setTrophies([]);
      return;
    }
    const prettify = (slug: string) =>
      slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    const build = async () => {
      // Best score per theme among the user's own cats
      const byTheme: Record<string, number> = {};
      myCats.forEach((c) => {
        const th = (c as any).theme;
        if (!th) return;
        byTheme[th] = Math.max(byTheme[th] ?? -1, c.score || 0);
      });

      const result = await Promise.all(
        Object.keys(byTheme).map(async (th) => {
          let champion = false;
          try {
            const snap = await getDocs(query(collection(db, 'cats'), where('theme', '==', th)));
            let topScore = -1;
            let topOwner: string | null = null;
            snap.forEach((d) => {
              const x = d.data();
              if ((x.score || 0) > topScore) { topScore = x.score || 0; topOwner = x.ownerId; }
            });
            champion = topOwner === user.uid;
          } catch (e) { /* ignore */ }
          return { theme: th, title: prettify(th), champion, votes: byTheme[th] };
        })
      );
      setTrophies(result);
    };
    build();
  }, [user, myCats]);

  const totalVotes = myCats.reduce((sum, cat) => sum + (cat.score || 0), 0);

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden">
      <div className="flex-1 overflow-y-auto bg-[#FFF5F5] flex flex-col">
        {/* Header */}
        <div className="pt-4 pb-4 px-6 flex justify-between items-center sticky top-0 z-20 bg-[#FFF5F5]/80 backdrop-blur-md">
          <h1 className="text-xl font-black text-neutral-800">Feline Fighter</h1>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <button
                  onClick={() => navigate('/admin/themes')}
                  className="p-2 bg-teal-500 rounded-full text-white shadow-sm active:scale-95 transition-transform"
                  aria-label="Themes roster"
                >
                  <CalendarClock className="w-5 h-5" />
                </button>
                <button
                  onClick={() => navigate('/moderation')}
                  className="p-2 bg-red-500 rounded-full text-white shadow-sm active:scale-95 transition-transform"
                  aria-label="Moderation panel"
                >
                  <ShieldAlert className="w-5 h-5" />
                </button>
              </>
            )}
            <button
              onClick={() => {
                if (!user) signIn();
                else setIsSettingsOpen(true);
              }}
              className="p-2 bg-white rounded-full text-neutral-600 shadow-sm border border-pink-50 active:scale-95 transition-transform"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 pb-24">
          {/* User Info */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-3">
              <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-xl bg-neutral-200">
                {userProfile?.photoURL || user?.photoURL ? (
                  <img src={userProfile?.photoURL || user?.photoURL || ''} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <img src="https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80" alt="Default" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                )}
              </div>
              <div className="absolute -bottom-2 -right-2 bg-gradient-to-br from-yellow-300 to-yellow-500 p-2 rounded-full border-2 border-white shadow-md">
                <Award className="w-6 h-6 text-white fill-white" />
              </div>
            </div>
            <h2 className="text-2xl font-black text-neutral-800">{userProfile?.displayName || user?.displayName || 'Anonymous Cat'}</h2>
            
            {userProfile?.socialHandle ? (
              <p className="text-sm font-bold text-pink-500">@{userProfile.socialHandle}</p>
            ) : (
              <p className="text-sm font-bold text-pink-500">@{user?.email?.split('@')[0] || 'guest'}</p>
            )}

            {/* Cat Names */}
            {(userProfile?.catName || userProfile?.catName2) && (
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {userProfile.catName && (
                  <span className="bg-pink-100 text-pink-700 px-3 py-1 rounded-full text-xs font-bold">
                    🐱 {userProfile.catName}
                  </span>
                )}
                {userProfile.catName2 && (
                  <span className="bg-pink-100 text-pink-700 px-3 py-1 rounded-full text-xs font-bold">
                    🐱 {userProfile.catName2}
                  </span>
                )}
              </div>
            )}

            {/* Battle Cries */}
            {(userProfile?.battleCry || userProfile?.battleCry2) && (
              <div className="mt-3 flex flex-col items-center gap-1">
                {userProfile.battleCry && (
                  <p className="text-sm font-medium text-neutral-600 italic text-center max-w-[250px]">"{userProfile.battleCry}"</p>
                )}
                {userProfile.battleCry2 && (
                  <p className="text-sm font-medium text-neutral-600 italic text-center max-w-[250px]">"{userProfile.battleCry2}"</p>
                )}
              </div>
            )}
            
            {/* Stats */}
            <div className="flex gap-6 mt-6 bg-white px-6 py-4 rounded-3xl shadow-sm border border-pink-50 w-full justify-between">
              <div className="text-center flex-1">
                <p className="font-black text-2xl text-neutral-800">{myCats.length}</p>
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Cats</p>
              </div>
              <div className="w-px bg-pink-100"></div>
              <div className="text-center flex-1">
                <p className="font-black text-2xl text-neutral-800">{totalVotes}</p>
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Votes</p>
              </div>
            </div>
          </div>

          {/* Earned Badges */}
          {(userProfile?.badges?.length ?? 0) > 0 && (
            <div className="mb-8">
              <h3 className="font-black text-lg text-neutral-800 flex items-center gap-2 mb-4">
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" /> Badges
              </h3>
              <div className="flex flex-wrap gap-3">
                {DIGITAL_REWARDS.filter((r) => userProfile?.badges?.includes(r.id)).map((r) => {
                  const Icon = r.icon;
                  return (
                    <div key={r.id} className={`flex items-center gap-2 ${r.bg} border border-pink-50 px-3 py-2 rounded-2xl shadow-sm`}>
                      <Icon className={`w-5 h-5 ${r.color}`} />
                      <span className="text-xs font-bold text-neutral-700">{r.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Trophy Cabinet */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-lg text-neutral-800 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" /> Trophy Cabinet
              </h3>
            </div>

            {trophies.length === 0 ? (
              <div className="bg-white border border-pink-50 rounded-2xl p-5 text-center shadow-sm">
                <p className="text-sm font-medium text-neutral-500">Enter a daily theme to start winning trophies! 🏆</p>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6 snap-x">
                {trophies.map((t) => (
                  <div
                    key={t.theme}
                    className={`rounded-2xl p-3 min-w-[120px] flex flex-col items-center text-center snap-start shadow-sm border ${t.champion ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200' : 'bg-gradient-to-br from-slate-50 to-gray-100 border-slate-200'}`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 shadow-inner border-2 border-white ${t.champion ? 'bg-yellow-400' : 'bg-slate-300'}`}>
                      <span className="text-2xl">{t.champion ? '🏆' : '🎖️'}</span>
                    </div>
                    <p className="font-black text-neutral-800 text-xs leading-tight">{t.title}</p>
                    <p className={`text-[10px] font-bold mt-1 ${t.champion ? 'text-yellow-600' : 'text-slate-500'}`}>
                      {t.champion ? '1st Place 👑' : `${t.votes} votes`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My Cats */}
          <div className="mb-4 flex gap-4 border-b border-pink-100 pb-2">
            <div className="flex items-center gap-2 font-black text-sm text-pink-500 border-b-2 border-pink-500 pb-2 -mb-[9px]">
              <Grid className="w-4 h-4" /> My Cats
            </div>
          </div>

          {/* Recent Entries Grid */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            {!user ? (
              <div className="col-span-2 text-center py-8">
                <p className="text-neutral-500 font-bold mb-4">Sign in to see your cats!</p>
                <button onClick={() => signIn()} className="bg-red-400 text-white px-6 py-2 rounded-full font-bold shadow-md active:scale-95 transition-transform">
                  Sign In
                </button>
              </div>
            ) : loading ? (
              <div className="col-span-2 flex justify-center py-8">
                <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
              </div>
            ) : myCats.length === 0 ? (
              <div className="col-span-2 text-center py-8">
                <p className="text-neutral-500 font-bold mb-4">You haven't uploaded any cats yet.</p>
                <button onClick={() => navigate('/upload')} className="bg-red-400 text-white px-6 py-2 rounded-full font-bold shadow-md active:scale-95 transition-transform">
                  Upload a Cat
                </button>
              </div>
            ) : (
              myCats.map((cat, i) => (
                <div key={cat.id} className="relative rounded-2xl overflow-hidden aspect-[3/4] bg-neutral-100 shadow-sm group">
                  {cat.thumbnailUrl ? (
                    <img src={cat.thumbnailUrl} className="w-full h-full object-cover" />
                  ) : (
                    <video 
                      src={cat.videoUrl} 
                      className="w-full h-full object-cover" 
                      autoPlay loop muted playsInline 
                      onLoadedMetadata={(e) => {
                        if (cat.trimStart) e.currentTarget.currentTime = cat.trimStart;
                      }}
                      onTimeUpdate={(e) => {
                        const { trimStart, trimEnd } = cat;
                        if (trimStart !== undefined && trimEnd !== undefined) {
                          if (e.currentTarget.currentTime >= trimEnd || e.currentTarget.currentTime < trimStart) {
                            e.currentTarget.currentTime = trimStart;
                          }
                        }
                      }}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex flex-col justify-end p-3">
                    <div className="flex items-center gap-1 text-white mb-1">
                      <Video className="w-3 h-3" />
                      <span className="text-[10px] font-bold flex items-center gap-1">
                        {cat.name}
                        {cat.isVerified && <ShieldCheck className="w-3 h-3 text-blue-400" />}
                      </span>
                    </div>
                    <p className="text-white font-black text-sm">{cat.score} Votes</p>
                  </div>
                  <button
                    onClick={() => handleDeleteCat(cat.id, cat.name)}
                    className="absolute top-2 right-2 p-1.5 bg-red-500/80 backdrop-blur-md rounded-full opacity-90 hover:opacity-100 active:scale-95 transition-all"
                    aria-label="Delete entry"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Settings / Toggles */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-pink-50">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-bold text-neutral-800">Brand Repost Permission</h4>
                <p className="text-xs text-neutral-500 mt-1 max-w-[200px]">Allow us to repost your cat's best moments on our socials.</p>
                <p className="text-[10px] text-pink-500 font-bold mt-1.5 leading-tight pr-4">✨ Your cat could go viral! We'll always tag your profile to boost your cat's fame. 🚀</p>
              </div>
              <button
                onClick={handleToggleRepost}
                className="active:scale-95 transition-transform"
              >
                {userProfile?.allowRepost ? (
                  <ToggleRight className="w-10 h-10 text-teal-400" strokeWidth={1.5} />
                ) : (
                  <ToggleLeft className="w-10 h-10 text-neutral-300" strokeWidth={1.5} />
                )}
              </button>
            </div>
          </div>

          {/* Legal */}
          <button
            onClick={() => navigate('/terms')}
            className="mt-4 w-full text-center text-xs font-bold text-neutral-400 underline active:scale-95 transition-transform"
          >
            Terms of Use
          </button>

        </div>
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        userProfile={userProfile as any}
        currentUser={user}
        onUpdate={() => {}}
      />
    </div>
  );
}
