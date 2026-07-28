/**
 * DESTRUCTIVE one-off: wipe all user-generated data for a fresh launch state.
 *
 * What this deletes:
 *   - Firestore: every doc in `cats`, `votes`, `comments`, `messages`, `reports`
 *   - Firestore: every doc in `users` EXCEPT the account matching ADMIN_EMAIL below
 *   - Storage: every file under `videos/` and `thumbnails/`
 *
 * What this does NOT touch:
 *   - Firebase Auth accounts (logins survive — returning testers just get
 *     treated as brand-new users again since their profile doc is gone)
 *   - `themes` and `announcements` (app config, not user data)
 *   - The admin's own Firestore user doc (role/premium status preserved)
 *
 * Safety:
 *   - Defaults to DRY RUN. Nothing is deleted unless you pass --live.
 *   - Always run without --live first and read the counts before going live.
 *
 * Usage:
 *   node scripts/reset-user-data.mjs            # dry run, shows what would happen
 *   node scripts/reset-user-data.mjs --live      # actually deletes
 *
 * Needs: serviceAccountKey.json in the repo root (gitignored, already present).
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

const LIVE = process.argv.includes('--live');
const ADMIN_EMAIL = 'bjornpfrengle@gmail.com';

const config = JSON.parse(readFileSync(path.join(repoRoot, 'firebase-applet-config.json'), 'utf8'));
const serviceAccount = JSON.parse(readFileSync(path.join(repoRoot, 'serviceAccountKey.json'), 'utf8'));

const app = initializeApp({
  credential: cert(serviceAccount),
  storageBucket: config.storageBucket,
});

const db = getFirestore(app, config.firestoreDatabaseId);
const auth = getAuth(app);
const bucket = getStorage(app).bucket();

console.log(`Mode:     ${LIVE ? 'LIVE — files will actually be deleted' : 'DRY RUN (nothing will be deleted)'}`);
console.log(`Project:  ${config.projectId}`);
console.log(`Database: ${config.firestoreDatabaseId}\n`);

// Resolve the admin's uid so we can skip their user doc.
let adminUid = null;
try {
  const adminUser = await auth.getUserByEmail(ADMIN_EMAIL);
  adminUid = adminUser.uid;
  console.log(`Preserving user doc for ${ADMIN_EMAIL} (uid: ${adminUid})\n`);
} catch (err) {
  console.warn(`WARNING: could not find an Auth account for ${ADMIN_EMAIL} (${err.message}).`);
  console.warn(`Proceeding — but nothing will be excluded from the users collection wipe.\n`);
}

async function deleteCollection(name, { skipDocId } = {}) {
  const snap = await db.collection(name).get();
  const docsToDelete = snap.docs.filter((d) => d.id !== skipDocId);
  const skipped = snap.docs.length - docsToDelete.length;

  console.log(`${name}: ${snap.docs.length} doc(s) found${skipped ? `, ${skipped} preserved` : ''}, ${docsToDelete.length} to delete`);

  if (!LIVE || docsToDelete.length === 0) return docsToDelete.length;

  // Firestore batches cap at 500 writes; chunk to be safe.
  const chunkSize = 450;
  for (let i = 0; i < docsToDelete.length; i += chunkSize) {
    const batch = db.batch();
    for (const d of docsToDelete.slice(i, i + chunkSize)) batch.delete(d.ref);
    await batch.commit();
  }
  return docsToDelete.length;
}

async function deletePrefix(prefix) {
  const [files] = await bucket.getFiles({ prefix });
  console.log(`Storage "${prefix}": ${files.length} file(s) found`);

  if (!LIVE || files.length === 0) return files.length;

  // deleteFiles() handles this in one call but doesn't report per-file failures
  // as clearly, so delete individually — this bucket isn't huge.
  let failed = 0;
  for (const file of files) {
    try {
      await file.delete();
    } catch (err) {
      failed++;
      console.error(`  FAILED to delete ${file.name}: ${err.message}`);
    }
  }
  if (failed) console.warn(`  ${failed} file(s) failed to delete — see above.`);
  return files.length - failed;
}

const results = {};
results.cats = await deleteCollection('cats');
results.votes = await deleteCollection('votes');
results.comments = await deleteCollection('comments');
results.messages = await deleteCollection('messages');
results.reports = await deleteCollection('reports');
results.users = await deleteCollection('users', { skipDocId: adminUid });

console.log('');
results.videos = await deletePrefix('videos/');
results.thumbnails = await deletePrefix('thumbnails/');

console.log(`\n${LIVE ? 'Done.' : 'Dry run complete — nothing was deleted.'}`);
if (!LIVE) {
  console.log('Re-run with --live to actually perform this wipe.');
}
