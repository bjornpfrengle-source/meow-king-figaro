import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Species, toSpecies, APP_SPECIES } from './species';

export interface Theme {
  id: string;
  title: string;
  slug: string;
  description: string;
  type: 'daily' | 'weekly' | 'surprise';
  startMs: number;
  endMs: number;
  species: Species;
}

/**
 * Early theme access — the headline Catnip Club perk.
 *
 * Catching your cat mid-zoomie takes time, so knowing the theme in advance is
 * genuinely valuable. Members get three days to plan and film; everyone else
 * still gets half a day's notice, so the free tier is a shorter run-up rather
 * than a locked door.
 */
export const PREMIUM_PREVIEW_MS = 72 * 60 * 60 * 1000; // 3 days
/**
 * 24h, not 12h. At 12 hours a free user opening the app during the day never
 * saw tomorrow's theme at all — it only unlocked late evening, most of which
 * they were asleep for, so there was no planning time and no reason to come
 * back tomorrow. Catching a cat mid-zoomie can't be done on demand.
 *
 * A full day means free users always see tomorrow; members still get three,
 * which is an easier thing to sell ("the week ahead" vs "tomorrow") than the
 * old half-day-versus-three-days gap.
 */
export const FREE_PREVIEW_MS = 24 * 60 * 60 * 1000; // 1 day

/** Can this user see the details of an upcoming theme yet? */
export function isThemeRevealed(theme: Theme, isPremium: boolean, nowMs: number = Date.now()) {
  if (theme.startMs <= nowMs) return true; // live themes are always visible
  const lead = isPremium ? PREMIUM_PREVIEW_MS : FREE_PREVIEW_MS;
  return theme.startMs - nowMs <= lead;
}

/** When a free user will be able to see this theme (used for the upsell countdown). */
export function freeRevealAtMs(theme: Theme) {
  return theme.startMs - FREE_PREVIEW_MS;
}

/**
 * How much of the roster the app actually needs in memory.
 *
 * The roster is seeded a year ahead, so reading all of it means every screen
 * downloads ~380 documents on mount and re-filters them on every tick. Nothing
 * in the UI looks further back than the last 30 days (notification results,
 * the leaderboard's past winners) or further forward than the 3-day Catnip
 * Club preview, so a window around today covers every consumer at ~40 docs.
 *
 * Admin screens that manage the whole roster pass { full: true }.
 */
const PAST_WINDOW_MS = 35 * 24 * 60 * 60 * 1000;
const FUTURE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Live view of the themes roster from Firestore. Recomputes which theme is
 * active/upcoming every 30s so rollovers happen without a reload.
 */
export function useThemes(options?: { full?: boolean }) {
  const full = options?.full ?? false;
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    // The window is fixed at subscribe time rather than tracking nowMs — it has
    // weeks of slack at both ends, so it never needs to move mid-session, and
    // recomputing it on every tick would tear down and rebuild the listener.
    const anchor = Date.now();
    const q = full
      ? query(collection(db, 'themes'), orderBy('startAt', 'asc'))
      : query(
          collection(db, 'themes'),
          where('startAt', '>=', Timestamp.fromMillis(anchor - PAST_WINDOW_MS)),
          where('startAt', '<=', Timestamp.fromMillis(anchor + FUTURE_WINDOW_MS)),
          orderBy('startAt', 'asc')
        );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Theme[] = snap.docs.map((d) => {
          const data: any = d.data();
          return {
            id: d.id,
            title: data.title || 'Untitled',
            slug: data.slug || d.id,
            description: data.description || '',
            type: data.type || 'daily',
            startMs: data.startAt?.toMillis ? data.startAt.toMillis() : 0,
            endMs: data.endAt?.toMillis ? data.endAt.toMillis() : 0,
            species: toSpecies(data.species),
          };
        });
        setThemes(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [full]);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Only surface themes belonging to this build's arena. Today every theme is
  // 'cat', so this is a no-op — but it's what lets a dog/bird build share this
  // codebase and this Firestore collection without seeing each other's themes.
  //
  // Memoised on `themes` alone: the species of a theme never changes with the
  // clock, so this array must keep its identity across the 30s tick. Several
  // screens list it in a useEffect dependency array, and when it was rebuilt
  // every tick those effects re-fired twice a minute — each one firing a fresh
  // burst of sequential Firestore reads for past-theme results. That, not the
  // rendering, was what made the whole app feel like it was choking.
  const inArena = useMemo(
    () => themes.filter((t) => t.species === APP_SPECIES),
    [themes]
  );

  // These two genuinely depend on the clock. `active` resolves to an element of
  // inArena, so its identity stays stable until the theme actually rolls over.
  const active = useMemo(
    () => inArena.find((t) => t.startMs <= nowMs && t.endMs > nowMs) || null,
    [inArena, nowMs]
  );
  const upcoming = useMemo(
    () => inArena.filter((t) => t.startMs > nowMs),
    [inArena, nowMs]
  );

  return { active, upcoming, themes: inArena, loading, nowMs };
}

/** A ticking countdown to a target time (ms since epoch). */
export function Countdown({ toMs, className }: { toMs: number; className?: string }) {
  const [remaining, setRemaining] = useState(Math.max(0, toMs - Date.now()));

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, toMs - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [toMs]);

  const totalSec = Math.floor(remaining / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  const text = d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`;
  return <span className={className}>{text}</span>;
}
