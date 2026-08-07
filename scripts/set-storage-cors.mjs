/**
 * One-off setup script: allow cross-origin fetch() reads on the Storage
 * bucket.
 *
 * Why this exists
 * ----------------
 * Every existing video path (<video src={downloadUrl}>) works fine without
 * this — browsers allow cross-origin media elements to load and play with no
 * CORS headers at all. The share-video feature is the first thing that does
 * `fetch(shareVideoUrl).then(r => r.blob())` — reading the response body in
 * JS, which the browser blocks unless the bucket's CORS config explicitly
 * allows it. Without this, that fetch() throws a generic "Load failed" in
 * WebKit with no further detail, which is exactly what showed up.
 *
 * The video files are already public (storage.rules: `allow read: if true`),
 * so allowing any origin to read them adds no new exposure — this only
 * changes whether JS is allowed to read bytes it could already download.
 *
 * Usage:  node scripts/set-storage-cors.mjs
 * Needs:  serviceAccountKey.json in the repo root (gitignored).
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { Storage } from '@google-cloud/storage';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

const config = JSON.parse(readFileSync(path.join(repoRoot, 'firebase-applet-config.json'), 'utf8'));
const keyPath = path.join(repoRoot, 'serviceAccountKey.json');

const storage = new Storage({ keyFilename: keyPath, projectId: config.projectId });
const bucket = storage.bucket(config.storageBucket);

const corsConfiguration = [
  {
    origin: ['*'],
    method: ['GET', 'HEAD'],
    maxAgeSeconds: 3600,
    responseHeader: ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges'],
  },
];

console.log(`Bucket: ${config.storageBucket}`);
console.log('Setting CORS configuration:', JSON.stringify(corsConfiguration, null, 2));

await bucket.setCorsConfiguration(corsConfiguration);

const [metadata] = await bucket.getMetadata();
console.log('\nDone. Bucket CORS is now:', JSON.stringify(metadata.cors, null, 2));
