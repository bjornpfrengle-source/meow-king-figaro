import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export interface Theme {
  id: string;
  title: string;
  slug: string;
  description: string;
  type: 'daily' | 'weekly' | 'surprise';
  startMs: number;
  endMs: number;
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

  const active = themes.find((t) => t.startMs <= nowMs && t.endMs > nowMs) || null;
  const upcoming = themes.filter((t) => t.startMs > nowMs);

  return { active, upcoming, themes, loading };
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
