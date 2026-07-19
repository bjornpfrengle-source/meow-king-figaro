// Seeds the fortnight theme roster into the named Firestore database.
// Run once you have serviceAccountKey.json in the project root:
//   node scripts/seed-themes.mjs
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const DB_ID = 'ai-studio-9d6ee796-8f1c-47a8-ac92-44863325253b';

const svc = JSON.parse(readFileSync(new URL('../serviceAccountKey.json', import.meta.url)));
const app = initializeApp({ credential: cert(svc) });
const db = getFirestore(app, DB_ID);

const T = (iso) => Timestamp.fromDate(new Date(iso));

// All times are Sydney AEST (+10:00), 9:00am rollovers
const themes = [
  { title: 'Lazy Sundays',    slug: 'lazy-sundays',     type: 'weekly',   start: '2026-07-19T09:00:00+10:00', end: '2026-07-20T09:00:00+10:00', description: 'Maximum relaxation. Your cat at their sleepiest, coziest, most horizontal.' },
  { title: 'Zoomies Champion',slug: 'zoomies-champion', type: 'daily',    start: '2026-07-20T09:00:00+10:00', end: '2026-07-21T09:00:00+10:00', description: "Capture your cat's wildest, most chaotic burst of energy. The more blur, the better!" },
  { title: 'Drift King',      slug: 'drift-king',       type: 'daily',    start: '2026-07-21T09:00:00+10:00', end: '2026-07-22T09:00:00+10:00', description: 'Full-speed corners, zero traction. Show us your cat losing it on the slippery floor.' },
  { title: 'Chatterbox',      slug: 'chatterbox',       type: 'daily',    start: '2026-07-22T09:00:00+10:00', end: '2026-07-23T09:00:00+10:00', description: 'Meows, chirps, trills, and full-blown arguments. The most vocal cats win!' },
  { title: 'Caught in 4K',    slug: 'caught-in-4k',     type: 'daily',    start: '2026-07-23T09:00:00+10:00', end: '2026-07-24T09:00:00+10:00', description: 'That guilty "I definitely didn\'t do that" moment. Chaos caught in the act!' },
  { title: '3AM Menace',      slug: '3am-menace',       type: 'daily',    start: '2026-07-24T09:00:00+10:00', end: '2026-07-25T09:00:00+10:00', description: 'The unhinged midnight energy — screaming, sprinting, knocking things off shelves.' },
  { title: 'Backyard Battles',slug: 'backyard-battles', type: 'daily',    start: '2026-07-25T09:00:00+10:00', end: '2026-07-26T09:00:00+10:00', description: 'Outdoor adventures — garden patrols, tree climbs, and turf wars in the sun.' },
  { title: 'Lazy Sundays',    slug: 'lazy-sundays',     type: 'weekly',   start: '2026-07-26T09:00:00+10:00', end: '2026-07-27T09:00:00+10:00', description: 'Maximum relaxation. Your cat at their sleepiest, coziest, most horizontal.' },
  { title: 'Tower Defense',   slug: 'tower-defense',    type: 'daily',    start: '2026-07-27T09:00:00+10:00', end: '2026-07-28T09:00:00+10:00', description: 'King of the castle! Your cat ruling the top of their tower, or the battle to claim it.' },
  { title: 'The Loaf Master', slug: 'the-loaf-master',  type: 'daily',    start: '2026-07-28T09:00:00+10:00', end: '2026-07-29T09:00:00+10:00', description: 'Perfectly tucked paws, zero legs visible. Present the ultimate cat loaf.' },
  { title: 'Wipeouts',        slug: 'wipeouts',         type: 'daily',    start: '2026-07-29T09:00:00+10:00', end: '2026-07-30T09:00:00+10:00', description: 'Miscalculated jumps, faceplants, and glorious fails. If they fell for it, we want it.' },
  { title: 'The Summit',      slug: 'the-summit',       type: 'daily',    start: '2026-07-30T09:00:00+10:00', end: '2026-07-31T09:00:00+10:00', description: 'Your cat conquering the highest perch in the house, surveying their kingdom.' },
  { title: 'Box Conqueror',   slug: 'box-conqueror',    type: 'daily',    start: '2026-07-31T09:00:00+10:00', end: '2026-08-01T09:00:00+10:00', description: 'If it fits, they sits. Your cat ruling their cardboard kingdom.' },
  { title: 'Spa Day',         slug: 'spa-day',          type: 'daily',    start: '2026-08-01T09:00:00+10:00', end: '2026-08-02T09:00:00+10:00', description: 'Bath time! Dramatic self-cleaning, tongue baths, and the majestic post-groom floof.' },
];

for (const t of themes) {
  await db.collection('themes').add({
    title: t.title,
    slug: t.slug,
    description: t.description,
    type: t.type,
    startAt: T(t.start),
    endAt: T(t.end),
    createdAt: Timestamp.now(),
  });
  console.log(`✓ ${t.title.padEnd(18)} ${t.start.slice(0, 16)} → ${t.end.slice(0, 16)}`);
}

console.log(`\nDone — ${themes.length} themes seeded.`);
process.exit(0);
