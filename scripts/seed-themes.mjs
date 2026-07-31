// Seeds the fortnight theme roster into the named Firestore database.
//
// Themes don't repeat on their own — each one runs on a fixed date and is gone
// once it passes. When the last one expires the app has no active theme at all,
// so re-run this at the end of each fortnight to start the list again.
//
//   node scripts/seed-themes.mjs
//
// Change START below to the Sunday you want the next run to begin.
// Safe to run twice: any day already covered is skipped, so you can't
// double-book a date.
//
// Needs serviceAccountKey.json in the project root.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const DB_ID = 'ai-studio-9d6ee796-8f1c-47a8-ac92-44863325253b';

// First day of the run. Themes roll over at 9:00am Sydney time.
// (+10:00 is AEST; if a run ever spans October–April, use +11:00 for AEDT.)
const START = '2026-08-02';
const OFFSET = '+10:00';

// How many times to repeat the fortnight below. 26 ≈ a full year, so the app
// can't run out of themes while you're busy with anything else. A fortnight is
// exactly two weeks, so repeating it keeps Lazy Sundays landing on Sundays.
const FORTNIGHTS = 26;

// Runs in order, one per day, starting on START. Lazy Sundays sits at
// positions 1 and 8 so it lands on a Sunday when START is a Sunday.
const THEMES = [
  { title: 'Lazy Sundays',     slug: 'lazy-sundays',     type: 'weekly', description: 'Maximum relaxation. Your cat at their sleepiest, coziest, most horizontal.' },
  { title: 'Zoomies Champion', slug: 'zoomies-champion', type: 'daily',  description: "Capture your cat's wildest, most chaotic burst of energy. The more blur, the better!" },
  { title: 'Drift King',       slug: 'drift-king',       type: 'daily',  description: 'Full-speed corners, zero traction. Show us your cat losing it on the slippery floor.' },
  { title: 'Chatterbox',       slug: 'chatterbox',       type: 'daily',  description: 'Meows, chirps, trills, and full-blown arguments. The most vocal cats win!' },
  { title: 'Caught in 4K',     slug: 'caught-in-4k',     type: 'daily',  description: 'That guilty "I definitely didn\'t do that" moment. Chaos caught in the act!' },
  { title: '3AM Menace',       slug: '3am-menace',       type: 'daily',  description: 'The unhinged midnight energy — screaming, sprinting, knocking things off shelves.' },
  { title: 'Backyard Battles', slug: 'backyard-battles', type: 'daily',  description: 'Outdoor adventures — garden patrols, tree climbs, and turf wars in the sun.' },
  { title: 'Lazy Sundays',     slug: 'lazy-sundays',     type: 'weekly', description: 'Maximum relaxation. Your cat at their sleepiest, coziest, most horizontal.' },
  { title: 'Tower Defense',    slug: 'tower-defense',    type: 'daily',  description: 'King of the castle! Your cat ruling the top of their tower, or the battle to claim it.' },
  { title: 'The Loaf Master',  slug: 'the-loaf-master',  type: 'daily',  description: 'Perfectly tucked paws, zero legs visible. Present the ultimate cat loaf.' },
  { title: 'Wipeouts',         slug: 'wipeouts',         type: 'daily',  description: 'Miscalculated jumps, faceplants, and glorious fails. If they fell for it, we want it.' },
  { title: 'The Summit',       slug: 'the-summit',       type: 'daily',  description: 'Your cat conquering the highest perch in the house, surveying their kingdom.' },
  { title: 'Box Conqueror',    slug: 'box-conqueror',    type: 'daily',  description: 'If it fits, they sits. Your cat ruling their cardboard kingdom.' },
  { title: 'Spa Day',          slug: 'spa-day',          type: 'daily',  description: 'Bath time! Dramatic self-cleaning, tongue baths, and the majestic post-groom floof.' },
];

const svc = JSON.parse(readFileSync(new URL('../serviceAccountKey.json', import.meta.url)));
const app = initializeApp({ credential: cert(svc) });
const db = getFirestore(app, DB_ID);

const dayMs = 24 * 60 * 60 * 1000;
const startMs = new Date(`${START}T09:00:00${OFFSET}`).getTime();

// Days already on the calendar, so a repeat run can't double-book one.
const existing = await db.collection('themes').get();
const covered = new Set();
existing.forEach((doc) => {
  const ms = doc.data().startAt?.toMillis?.();
  if (ms) covered.add(new Date(ms).toISOString().slice(0, 10));
});

const fmt = (ms) =>
  new Date(ms).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', dateStyle: 'medium' });

let added = 0;
let skipped = 0;
const totalDays = THEMES.length * FORTNIGHTS;

for (let day = 0; day < totalDays; day++) {
  const t = THEMES[day % THEMES.length];
  const from = startMs + day * dayMs;
  const key = new Date(from).toISOString().slice(0, 10);

  if (covered.has(key)) {
    skipped++;
    continue;
  }

  await db.collection('themes').add({
    title: t.title,
    slug: t.slug,
    description: t.description,
    type: t.type,
    species: 'cat',
    startAt: Timestamp.fromMillis(from),
    endAt: Timestamp.fromMillis(from + dayMs),
    createdAt: Timestamp.now(),
  });

  // Only the first fortnight is printed in full — the rest is the same
  // fortnight repeating, and 364 lines of output helps nobody.
  if (day < THEMES.length) {
    console.log(`✓ ${t.title.padEnd(18)} ${fmt(from)}`);
  } else if (day === THEMES.length) {
    console.log(`  …repeating this fortnight ${FORTNIGHTS - 1} more times…`);
  }
  added++;
}

console.log(`\nDone — ${added} added, ${skipped} skipped (days that already had a theme).`);
console.log(`Roster now runs to ${fmt(startMs + totalDays * dayMs)}.`);
console.log(`To extend later: set START to that date and run this again.`);
process.exit(0);
