import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
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
export const FREE_PREVIEW_MS = 12 * 60 * 60 * 1000; // 12 hours

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
 * Live view of the themes roster from Firestore. Recomputes which theme is
 * active/upcoming every 30s so rollovers happen without a reload.
 */
export function useThemes() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const q = query(collection(db, 'themes'), orderBy('startAt', 'asc'));
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
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Only surface themes belonging to this build's arena. Today every theme is
  // 'cat', so this is a no-op — but it's what lets a dog/bird build share this
  // codebase and this Firestore collection without seeing each other's themes.
  const inArena = themes.filter((t) => t.species === APP_SPECIES);

  const active = inArena.find((t) => t.startMs <= nowMs && t.endMs > nowMs) || null;
  const upcoming = inArena.filter((t) => t.startMs > nowMs);

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
