/**
 * Clears the cached shareVideoUrl field so the app regenerates it fresh.
 *
 * Why this exists: shareVideoUrl is only ever generated once per cat and
 * then reused (ensureShareVideo() short-circuits if it's already set). If a
 * render shipped with a bug — like the frozen-frame issue from the
 * -stream_loop removal — any cat that already generated one is stuck
 * showing the broken version until that field is cleared, even after the
 * server-side bug is fixed. This clears it so the next "Share the win" tap
 * regenerates with the current (fixed) code.
 *
 * Usage:
 *   node scripts/clear-share-videos.mjs                  # clears ALL cats, dry run
 *   node scripts/clear-share-videos.mjs --live            # actually clears ALL
 *   node scripts/clear-share-videos.mjs --cat=<catId>      # just one cat, dry run
 *   node scripts/clear-share-videos.mjs --cat=<catId> --live
 *
 * Needs: serviceAccountKey.json in the repo root (gitignored, already present).
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

const LIVE = process.argv.includes('--live');
const catArg = process.argv.find((a) => a.startsWith('--cat='));
const onlyCatId = catArg ? catArg.slice('--cat='.length) : null;

const config = JSON.parse(readFileSync(path.join(repoRoot, 'firebase-applet-config.json'), 'utf8'));
const serviceAccount = JSON.parse(readFileSync(path.join(repoRoot, 'serviceAccountKey.json'), 'utf8'));

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app, config.firestoreDatabaseId);

console.log(`Mode:   ${LIVE ? 'LIVE — will actually clear' : 'DRY RUN (nothing will change)'}`);
console.log(`Target: ${onlyCatId ? `cat ${onlyCatId}` : 'every cat with a shareVideoUrl'}\n`);

const snap = onlyCatId
  ? await (async () => {
      const doc = await db.collection('cats').doc(onlyCatId).get();
      return { docs: doc.exists ? [doc] : [] };
    })()
  : await db.collection('cats').get();

const toClear = snap.docs.filter((d) => !!d.data().shareVideoUrl);

for (const d of toClear) {
  const data = d.data();
  console.log(`${LIVE ? 'clearing' : 'would clear'}  ${d.id}  (${data.name || 'unnamed'}) — ${data.shareVideoUrl}`);
  if (LIVE) {
    await d.ref.update({ shareVideoUrl: FieldValue.delete() });
  }
}

console.log(`\nDone. ${toClear.length} cat(s) ${LIVE ? 'cleared' : 'would be cleared'}.`);
if (!LIVE && toClear.length > 0) console.log('Re-run with --live to actually apply.');
