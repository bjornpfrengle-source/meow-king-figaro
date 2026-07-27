/**
 * One-off maintenance script: set long-lived Cache-Control on every file
 * already sitting in Firebase Storage.
 *
 * Why this exists
 * ---------------
 * Uploads originally went up with no cacheControl metadata, so Storage served
 * them as uncacheable. Every view of every clip re-downloaded the full file
 * from the us-central1 bucket, and for an Australian audience that egress is
 * billed at Google's premium "Download Australia" rate — which turned out to be
 * ~99% of the project's Cloud bill, with storage-at-rest essentially free.
 *
 * The upload paths now set this header on new files (see UploadScreen.tsx and
 * OnboardingScreen.tsx). This script fixes everything uploaded before that.
 *
 * Videos and thumbnails are immutable — filenames are timestamped and a clip is
 * never edited in place — so a one-year immutable cache is safe.
 *
 * Usage:  node scripts/backfill-cache-headers.mjs [--dry-run]
 * Needs:  serviceAccountKey.json in the repo root (gitignored).
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { Storage } from '@google-cloud/storage';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

const DRY_RUN = process.argv.includes('--dry-run');
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

const config = JSON.parse(readFileSync(path.join(repoRoot, 'firebase-applet-config.json'), 'utf8'));
const keyPath = path.join(repoRoot, 'serviceAccountKey.json');

const storage = new Storage({ keyFilename: keyPath, projectId: config.projectId });
const bucket = storage.bucket(config.storageBucket);

console.log(`Bucket:   ${config.storageBucket}`);
console.log(`Mode:     ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
console.log(`Setting:  Cache-Control: ${CACHE_CONTROL}\n`);

const [files] = await bucket.getFiles();

let updated = 0;
let skipped = 0;
let failed = 0;
let bytes = 0;

for (const file of files) {
  const current = file.metadata.cacheControl;
  const size = Number(file.metadata.size || 0);
  bytes += size;

  if (current === CACHE_CONTROL) {
    skipped++;
    continue;
  }

  const label = `${file.name} (${(size / 1024 / 1024).toFixed(1)} MB)`;

  if (DRY_RUN) {
    console.log(`would update  ${label}  [currently: ${current || 'unset'}]`);
    updated++;
    continue;
  }

  try {
    await file.setMetadata({ cacheControl: CACHE_CONTROL });
    console.log(`updated       ${label}`);
    updated++;
  } catch (err) {
    console.error(`FAILED        ${label} — ${err.message}`);
    failed++;
  }
}

console.log(`\nDone. ${files.length} files, ${(bytes / 1024 / 1024).toFixed(1)} MB total.`);
console.log(`  updated: ${updated}   already correct: ${skipped}   failed: ${failed}`);
