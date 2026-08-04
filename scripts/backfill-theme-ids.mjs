// Stamps existing cat entries with the theme OCCURRENCE they belong to.
//
// Why this exists: entries only ever stored `theme: '<slug>'`. The roster
// repeats the same fortnight all year, so `drift-king` comes round every two
// weeks and a slug match pulls every past occurrence's entries into the current
// one — a clip that won drift-king last fortnight reappeared in the next
// drift-king arena without being re-entered.
//
// New entries now write `themeId` (the theme document id, unique per
// occurrence). This backfills the ones written before that existed, by finding
// the occurrence of that slug whose window contains the entry's createdAt.
//
//   node scripts/backfill-theme-ids.mjs           # dry run, shows what it would do
//   node scripts/backfill-theme-ids.mjs --live    # actually writes
//
// Safe to re-run: entries that already have a themeId are skipped.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const DB_ID = 'ai-studio-9d6ee796-8f1c-47a8-ac92-44863325253b';
const LIVE = process.argv.includes('--live');

const svc = JSON.parse(readFileSync(new URL('../serviceAccountKey.json', import.meta.url)));
const app = initializeApp({ credential: cert(svc) });
const db = getFirestore(app, DB_ID);

const fmt = (ms) =>
  new Date(ms).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', dateStyle: 'medium' });

// Every theme occurrence, grouped by slug so we can pick the right one.
const themeSnap = await db.collection('themes').get();
const bySlug = new Map();
themeSnap.forEach((doc) => {
  const d = doc.data();
  const slug = d.slug;
  if (!slug) return;
  const startMs = d.startAt?.toMillis?.() ?? 0;
  const endMs = d.endAt?.toMillis?.() ?? 0;
  if (!bySlug.has(slug)) bySlug.set(slug, []);
  bySlug.get(slug).push({ id: doc.id, startMs, endMs, title: d.title });
});
for (const list of bySlug.values()) list.sort((a, b) => a.startMs - b.startMs);

console.log(`Loaded ${themeSnap.size} theme docs across ${bySlug.size} distinct slugs.\n`);

const catSnap = await db.collection('cats').get();
let stamped = 0;
let already = 0;
let unmatched = 0;

for (const doc of catSnap.docs) {
  const c = doc.data();
  if (!c.theme) continue;
  if (c.themeId) { already++; continue; }

  const createdMs = c.createdAt?.toMillis?.() ?? 0;
  const occurrences = bySlug.get(c.theme) || [];

  // The occurrence whose window contains this entry's creation time.
  let match = occurrences.find((o) => createdMs >= o.startMs && createdMs < o.endMs);

  // Entries created slightly outside any window (uploaded just after rollover,
  // or seeded before the roster existed) fall back to the most recent
  // occurrence that had already started — that is where they were competing.
  if (!match) {
    const started = occurrences.filter((o) => o.startMs <= createdMs);
    match = started.length ? started[started.length - 1] : null;
  }

  if (!match) {
    console.log(`? ${(c.name || doc.id).padEnd(18)} theme=${c.theme} created=${createdMs ? fmt(createdMs) : 'unknown'} — no matching occurrence`);
    unmatched++;
    continue;
  }

  console.log(`✓ ${(c.name || doc.id).padEnd(18)} ${c.theme.padEnd(18)} ${fmt(createdMs)} → ${match.id}`);
  if (LIVE) await doc.ref.update({ themeId: match.id });
  stamped++;
}

console.log(`\n${LIVE ? 'Wrote' : 'Would write'} ${stamped} · already stamped ${already} · unmatched ${unmatched}`);
if (!LIVE) console.log('Dry run. Re-run with --live to apply.');
process.exit(0);
