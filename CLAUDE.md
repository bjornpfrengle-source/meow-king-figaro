# Cat Chaos Arena — working notes

Daily cat-video competition app. Users enter one clip per daily theme, others
vote head-to-head, winners hit the leaderboard.

## Architecture

- **This repo** is the whole app: React + Vite + Tailwind front end, Express
  (`server.ts`) back end, Firebase for auth/data/storage. Deploys to Railway.
- **`~/CatChaosArena`** is a separate repo holding the native iOS shell. It is
  *not* a Capacitor-bundled build — `ios/App/App/AppDelegate.swift` is a
  hand-written `WKWebView` pointed straight at the Railway URL.

That second point drives everything below: **the App Store binary is a thin
wrapper around the live website.**

## Deploying — two separate systems

**App code** → commit and push → Railway auto-deploys in ~2 min → refresh the
app. No Xcode rebuild, no App Store resubmission. This covers all UI and logic.

Xcode is only needed for genuinely native changes: app icon, entitlements,
permissions, splash screen, the Sign in with Apple bridge.

**Firebase rules** do NOT deploy with the code. They are manual, every time:

```
npx firebase-tools deploy --only firestore:rules
npx firebase-tools deploy --only storage
```

Never `npx firebase` — that resolves to the client SDK package, has no
executable, and fails with "could not determine executable to run". Rules
silently stayed stale for days because of this, which surfaced as unexplained
"Missing or insufficient permissions" errors on upload.

## Firestore gotchas

- Uses a **named database**, not `(default)`: `ai-studio-9d6ee796-8f1c-47a8-ac92-44863325253b`.
  Set in `firebase.json` and `firebase-applet-config.json`. Admin scripts must
  pass it to `getFirestore(app, DB_ID)`.
- `firestore.rules` uses **strict field whitelists** (`hasOnlyAllowedFields`).
  Adding any new field to a document write **requires** adding it to the
  matching `isValidX()` validator, or every write is rejected. This has bitten
  twice (`species`, `isPremium`). Change the write and the rule together.
- Storage rules: `request.resource` is **null on delete**, so any rule checking
  `request.resource.size` refuses deletes. Deletes need their own
  `allow delete` clause — see `storage.rules`.

## Themes

Themes are fixed-date documents in the `themes` collection. **They do not
rotate or repeat on their own** — when the last one expires the app has no
active theme, no upload target and an empty arena.

`scripts/seed-themes.mjs` seeds a fortnight repeated `FORTNIGHTS` times
(currently a year, to 1 Aug 2027). Safe to re-run; it skips days already
covered. To extend, set `START` to the date it prints and run again.

A proper repeating rotation was deliberately deferred: entries store
`theme: '<slug>'` and the leaderboard queries by slug, so recurring slugs would
merge separate occurrences' history. Doing it properly means unique per-
occurrence ids plus migrating existing entries.

## Premium (Catnip Club)

- `isPremium = userProfile.isPremium || isAdmin`, so the owner account always
  reads as premium. **Test the free tier in an incognito window with a second
  account** — several free-tier bugs were only visible that way.
- There is **no purchase flow**. The Premium screen's CTA is disabled and reads
  "Coming Soon". `isPremium` is set manually in Firestore. Nothing in App Store
  Connect needs configuring until real IAP is built.
- Perks: second cat, 3-day early theme access (vs 12h free), 30s clips (vs 15s),
  entry swapping, no monthly upload cap.

## Cost

Storage-at-rest is negligible; **egress dominates** — the bucket is in
`us-central1` and most viewing is from Australia, billed at the premium
"Download Australia" rate. Uploads set
`cacheControl: 'public, max-age=31536000, immutable'` so each clip downloads
once per device rather than once per view. Keep that on any new upload path.
`npm run backfill-cache` fixes older files.

## Content moderation

`/api/process-video` extracts one frame after trimming and sends it to Gemini
(`@google/genai`, `GEMINI_API_KEY` set in Railway variables). It **fails open** —
if the key is missing or the API errors, the upload proceeds. A missing key
logs `GEMINI_API_KEY not set` on boot; absence of that line means it's active.

## Scripts

`scripts/` has its own `package.json` so admin dependencies stay out of the
root lockfile. Railway builds with `npm ci`, which hard-fails if `package.json`
and `package-lock.json` disagree — that broke a deploy once. Run
`npm install` inside `scripts/` before using them.

- `seed-themes.mjs` — seed/extend the theme roster
- `list-themes.mjs` — what's scheduled
- `backfill-cache-headers.mjs` — cache headers on existing Storage files
- `reset-user-data.mjs` — wipe user data for a fresh launch (dry-run default)

## Before shipping changes

Run `npx tsc --noEmit`. It's also `npm run lint`.
