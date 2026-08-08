import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Flame, Trophy, ChevronRight, Plus } from 'lucide-react';
import { db } from '../firebase';
import { useFirebase } from './FirebaseProvider';
import { ShapedFrame } from './ShapedFrame';
import type { Theme } from './themes';

/**
 * "Your cat today" — the only part of Home that is about the viewer.
 *
 * Every other section shows other people's cats, which makes Home a browsing
 * screen with no reason to open it twice in one day. This card changes between
 * visits (rank, votes, streak), which is what turns it into a checking screen.
 *
 * Deliberately renders a still image, never a <video>. Home's performance
 * problems came from stacking autoplaying clips, and this sits above the fold
 * where it would compete with the Trending hero for decode slots.
 */

interface MyEntry {
  id: string;
  name: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  score: number;
  rank: number;
  fieldSize: number;
}

/**
 * Consecutive days up to today with an entry, counted from the entry dates we
 * already hold. Capped at a 60-day lookback so this can never turn into an
 * unbounded scan as history grows.
 */
function computeStreak(entryDayKeys: Set<string>): number {
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  let streak = 0;

  // Today not being present doesn't break a streak — the day isn't over yet.
  // Start from yesterday in that case, so an unbroken run still reads as live.
  const start = entryDayKeys.has(dayKey(today)) ? 0 : 1;

  for (let i = start; i < 60; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (entryDayKeys.has(dayKey(d))) streak++;
    else break;
  }
  return streak;
}

export function YourCatToday({ activeTheme }: { activeTheme: Theme | undefined }) {
  const { user, userProfile } = useFirebase();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<MyEntry | null>(null);
  const [streak, setStreak] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoaded(true);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        // One query, scoped to this user. Their whole entry history is a
        // handful of documents, so this is far cheaper than reading a theme's
        // full field — and it covers both the streak and today's entry.
        const mine = await getDocs(
          query(collection(db, 'cats'), where('ownerId', '==', user.uid), orderBy('createdAt', 'desc'))
        );
        if (cancelled) return;

        const dayKeys = new Set<string>();
        let todaysEntry: { id: string; name: string; thumbnailUrl?: string; videoUrl?: string; score: number } | null = null;

        mine.docs.forEach((d) => {
          const data = d.data() as any;
          const created = data.createdAt?.toDate?.();
          if (created) dayKeys.add(created.toISOString().slice(0, 10));
          if (activeTheme && data.theme === activeTheme.slug && !todaysEntry) {
            todaysEntry = {
              id: d.id,
              name: data.name,
              thumbnailUrl: data.thumbnailUrl,
              videoUrl: data.videoUrl,
              score: data.score ?? 0,
            };
          }
        });

        setStreak(computeStreak(dayKeys));

        if (todaysEntry && activeTheme) {
          // Rank needs the rest of the field. Only fetched when the user
          // actually has an entry — a non-entrant pays nothing for this.
          const field = await getDocs(
            query(collection(db, 'cats'), where('theme', '==', activeTheme.slug))
          );
          if (cancelled) return;
          const scores = field.docs
            .map((d) => (d.data() as any).score ?? 0)
            .sort((a: number, b: number) => b - a);
          const e = todaysEntry as { id: string; name: string; thumbnailUrl?: string; videoUrl?: string; score: number };
          setEntry({
            ...e,
            rank: scores.indexOf(e.score) + 1,
            fieldSize: field.size,
          });
        } else {
          setEntry(null);
        }
      } catch (err) {
        console.error('YourCatToday failed to load', err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, activeTheme?.slug]);

  // Signed out, or nothing to say yet: render nothing rather than an empty
  // shell. A placeholder card above the fold pushes the real content down.
  if (!user || !loaded || !activeTheme) return null;

  const photo = entry?.thumbnailUrl || userProfile?.catThumbnailUrl || '';
  const displayName = entry?.name || userProfile?.catName || 'Your cat';
  const entered = !!entry;

  return (
    <button
      onClick={() => navigate(entered ? '/profile' : '/upload')}
      className="w-full text-left mb-8 active:scale-[0.98] transition-transform"
    >
      <div className="relative flex items-center gap-4 p-4 rounded-3xl bg-gradient-to-br from-pink-50 via-rose-50 to-white border border-pink-100 shadow-sm">
        <ShapedFrame
          shape="heart"
          pulse
          borderColor="#f9a8d4"
          glowColor="rgba(244,114,182,0.9)"
          className="w-[76px] h-[76px] shrink-0"
        >
          {photo ? (
            <img src={photo} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-pink-200 flex items-center justify-center">
              <Plus className="w-7 h-7 text-white" />
            </div>
          )}
        </ShapedFrame>

        <div className="flex-1 min-w-0">
          <p className="font-black text-lg text-neutral-800 truncate">{displayName}</p>

          {entered ? (
            <>
              <div className="flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1 text-sm font-bold text-red-400">
                  <Trophy className="w-4 h-4" />
                  #{entry!.rank} of {entry!.fieldSize}
                </span>
                <span className="text-sm font-bold text-neutral-500">
                  {entry!.score} {entry!.score === 1 ? 'vote' : 'votes'}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5 truncate">in {activeTheme.title}</p>
            </>
          ) : (
            <p className="text-sm font-bold text-neutral-500 mt-1">
              Not in today's theme yet — tap to enter
            </p>
          )}

          {streak > 1 && (
            <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 text-xs font-black">
              <Flame className="w-3 h-3 fill-orange-500 text-orange-500" />
              {streak} day streak
            </span>
          )}
        </div>

        <ChevronRight className="w-5 h-5 text-neutral-300 shrink-0" />
      </div>
    </button>
  );
}
