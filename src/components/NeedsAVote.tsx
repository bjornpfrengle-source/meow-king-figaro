import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { PawPrint } from 'lucide-react';
import { db } from '../firebase';
import { useFirebase } from './FirebaseProvider';
import { ShapedFrame } from './ShapedFrame';
import type { Theme } from './themes';

/**
 * "Needs a vote" — the least-voted cat in today's theme.
 *
 * This is a fairness mechanism as much as a feature. Scores are raw vote
 * counts, and entries that arrive late simply appear in fewer battles than
 * ones that were there all day, so their totals aren't comparable. Pointing
 * traffic at the quietest entry narrows that gap, and gives Home a second way
 * into voting for someone who has already seen the Trending clip.
 *
 * The viewer's own cat is excluded — inviting someone to go vote for
 * themselves is both useless and a bit grubby.
 */

interface Underdog {
  id: string;
  name: string;
  cry?: string;
  thumbnailUrl?: string;
  score: number;
}

export function NeedsAVote({ activeTheme }: { activeTheme: Theme | undefined }) {
  const { user } = useFirebase();
  const navigate = useNavigate();
  const [cat, setCat] = useState<Underdog | null>(null);

  useEffect(() => {
    if (!activeTheme) return;
    let cancelled = false;

    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'cats'), where('theme', '==', activeTheme.slug))
        );
        if (cancelled) return;

        const others = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((c) => c.ownerId !== user?.uid);

        if (others.length === 0) {
          setCat(null);
          return;
        }

        // Lowest score wins the slot. Sorted client-side rather than with
        // orderBy+limit because the theme's field is already being read in
        // full elsewhere on this screen and is small by design.
        others.sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
        const pick = others[0];
        setCat({
          id: pick.id,
          name: pick.name,
          cry: pick.cry,
          thumbnailUrl: pick.thumbnailUrl,
          score: pick.score ?? 0,
        });
      } catch (err) {
        console.error('NeedsAVote failed to load', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTheme?.slug, user?.uid]);

  if (!cat) return null;

  return (
    <div className="mb-8">
      <h3 className="text-2xl font-black text-neutral-800 mb-1">Needs a Vote</h3>
      <p className="text-xs font-bold text-neutral-400 mb-4">
        The quietest cat in today's theme
      </p>

      <button
        onClick={() => navigate('/vote')}
        className="w-full text-left active:scale-[0.98] transition-transform"
      >
        <div className="flex items-center gap-4 p-4 rounded-3xl bg-gradient-to-br from-teal-50 via-cyan-50 to-white border border-teal-100 shadow-sm">
          <ShapedFrame
            shape="paw"
            pulse
            borderColor="#5eead4"
            glowColor="rgba(45,212,191,0.85)"
            className="w-[76px] h-[76px] shrink-0"
          >
            {cat.thumbnailUrl ? (
              <img src={cat.thumbnailUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-teal-200 flex items-center justify-center">
                <PawPrint className="w-7 h-7 text-white" />
              </div>
            )}
          </ShapedFrame>

          <div className="flex-1 min-w-0">
            <p className="font-black text-lg text-neutral-800 truncate">{cat.name}</p>
            {cat.cry && (
              <p className="text-sm text-neutral-500 italic truncate">"{cat.cry}"</p>
            )}
            <p className="text-xs font-black text-teal-600 mt-1">
              {cat.score === 0
                ? 'No votes yet today'
                : `Only ${cat.score} ${cat.score === 1 ? 'vote' : 'votes'} so far`}
            </p>
          </div>

          <span className="shrink-0 bg-teal-400 text-white font-black text-sm px-4 py-2 rounded-full shadow-sm">
            Vote
          </span>
        </div>
      </button>
    </div>
  );
}
