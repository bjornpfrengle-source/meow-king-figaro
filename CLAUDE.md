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
cd ~/meow-king-figaro && npx firebase-tools deploy --only firestore:rules
cd ~/meow-king-figaro && npx firebase-tools deploy --only storage
```

Always include the `cd` — a fresh Terminal opens in `~`, and from there the
CLI fails with "Not in a Firebase app directory (could not locate
firebase.json)".

Never `npx firebase` — that resolves to the client SDK package, has no
executable, and fails with "could not determine executable to run". Rules
silently stayed stale for days because of this, which surfaced as unexplained
"Missing or insufficient permissions" errors on upload.

## Firestore was on the AI Studio shared quota — upgraded 1 Aug 2026

The database ID (`ai-studio-9d6ee796-...`) gives it away: this Firestore
database was provisioned through the Google AI Studio integration, which
places it in a separate "AI shared quota" group — **even though the project
itself is already on the Blaze pay-as-you-go plan.** The two are independent;
being on Blaze doesn't move this specific database off the shared group.

Limits: 50,000 reads/day, 40,000 writes/day, 1 GiB stored, 10 GiB egress/month
(egress here is Firestore document traffic only — video streaming goes through
Storage, a separate quota, so this isn't the "Download Australia" cost problem).
Confirmed still active via the "This database is currently subject to AI
shared quota limits" banner on the Indexes/Usage tabs in the Firebase console.

The dangerous part wasn't cost, it was **availability**: hit the daily limit
and the service pauses for every database in the shared group until midnight
Pacific. Not a slowdown — the whole app going down, uploads/votes/leaderboard
included, until the reset.

**Fixed 1 Aug 2026.** Bjorn clicked Firebase console → Firestore → Indexes →
"Upgrade database" and confirmed "Upgrade successful, moved into pay-as-you-go."
This database now bills normally against the project's existing Blaze plan
instead of sharing the AI Studio pool — no more 50k reads/day ceiling. No code
or rules change was involved; it was purely an account-side move.

The project was originally spun up through Google AI Studio, which is also
why the Firestore database ID still carries the `ai-studio-` prefix — cosmetic
now, but explains the naming if it comes up again.

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

## Sign in with Apple — the audience gotcha

Apple sign-in is **native**, not web: `AppDelegate.swift` runs
`ASAuthorizationAppleIDProvider`, then hands the id token and raw nonce to the
web layer via `window.__onAppleSignIn`. Because it's native, Apple mints the
token with an audience of the **bundle id** (`com.catchaosarena.app`), not a
Services ID.

Firebase only accepts an Apple token whose audience belongs to the project. The
project originally had **only a web app registered** (`1:74285208591:web:...`),
so the bundle id was an unknown audience and every Apple sign-in failed with:

```
auth/invalid-credential: The audience in ID Token [com.catchaosarena.app]
does not match the expected audience.
```

**Fixed 8 Aug 2026** by registering an iOS app in Firebase (Project settings →
General → Add app → iOS+ → bundle id `com.catchaosarena.app`). Nothing else in
that flow was needed — no `GoogleService-Info.plist`, no Firebase iOS SDK, no
Xcode rebuild, no resubmission, since the app reaches Firebase through the web
layer. Registering the bundle id purely teaches Firebase to trust that
audience. Confirmed working by an external tester the same day.

The Swift side was correct the whole time. If Apple sign-in breaks again, check
the Firebase app registration and the App ID's Sign in with Apple capability
before touching `AppDelegate.swift`.

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

**Reading the roster is windowed.** `useThemes()` only subscribes to themes
within roughly a month either side of today. With a year seeded, an unbounded
read meant ~380 documents per screen — see "Performance traps" below. Admin
screens that manage the full roster pass `useThemes({ full: true })`.

### Concurrent themes (2-3 at once) — design notes, not built

Deferred to v2, but the groundwork is mostly there. Recorded so it doesn't have
to be re-derived:

- **The schema already allows it.** Nothing stops two theme docs having
  overlapping `startAt`/`endAt`. The only blocker is `themes.tsx` using
  `.find()` for `active`, which silently returns the first match. Entries
  already carry `theme: '<slug>'`, so they self-partition by theme.
- **Model it as tracks, not an array.** Add a `track` field (`daily`,
  `weekly`, `wildcard`); each track holds at most one live theme, so
  `activeByTrack` enforces the invariant by shape rather than by careful
  seeding. The existing `type` field already carries these values.
- **Do the `themeId` migration first.** Because the join key is the slug,
  concurrent tracks make the recurring-slug collision above more likely, not
  less. Write the Firestore doc id as `themeId` alongside `theme`, query on it,
  keep the slug for display.
- **Battle screen: one theme per battle.** Tabs pick the lane; never label the
  two halves with different themes. A cross-theme battle has no coherent
  answer to which leaderboard receives the win, and entries in the busier lane
  accumulate more battles, so scores stop being comparable.
- The 4px divider at `VoteScreen.tsx:331` is the natural home for the lane's
  theme chip and countdown — once tracks run on different clocks the countdown
  can no longer live in a single global header.
- Each live lane roughly multiplies arena reads, so lazy-load a lane on first
  tap rather than prefetching all of them.

## Premium (Catnip Club)

- `isPremium = userProfile.isPremium || isAdmin`, so the owner account always
  reads as premium. **Test the free tier in an incognito window with a second
  account** — several free-tier bugs were only visible that way.
- There is **no purchase flow**. The Premium screen's CTA is disabled and reads
  "Coming Soon". `isPremium` is set manually in Firestore. Nothing in App Store
  Connect needs configuring until real IAP is built.
- Perks: second cat, 3-day early theme access (vs 12h free), 30s clips (vs 15s),
  entry swapping, no monthly upload cap.

## Performance traps

The app once became almost unusable — buttons needing several taps — from a
combination that is worth recognising again, because none of the pieces looked
wrong on its own:

- `useThemes()` read the **entire** `themes` collection with no date bound. Fine
  at 14 documents; the year-long seed took it to ~380.
- It is a hook, not a context, and **seven screens call it**, so each mounts its
  own listener over that whole collection.
- It ticks `setNowMs` every 30s, and the derived arrays were rebuilt on every
  render. Fresh array identity meant every consumer's
  `useEffect(..., [themes])` re-fired **twice a minute** — and some of those
  effects fan out into sequential per-theme Firestore reads.

So a background clock tick was driving repeated bursts of network work, and the
blocked main thread is what swallowed the taps. Fixes applied: window the query,
`useMemo` the derived arrays so identity is stable across ticks, and give the
admin screen an opt-out. **If you add a `useEffect` that depends on an array
returned from a hook, check that array is memoised.**

Related: `HomeScreen` held an `onSnapshot` over all of `cats` purely to read
`snapshot.size` — downloading every document to display one number. Use
`getCountFromServer`.

## Speed work not yet done — investigated, deferred

Three known wins, in the order they're worth doing. None are started.

**1. Save the moderation frame as a thumbnail (biggest playback win, low risk).**
`server.ts` already extracts a frame after trimming to send to Gemini, then
throws it away. Save it to Storage and store `thumbnailUrl` on the cat doc
instead. Today every grid and list renders a full `<video>` — Home's "Recent
Winners" row autoplays three ~2MB 720p clips inside ~80px circles, and the
leaderboard and profile grids do the same. A ~30KB image replaces a ~2MB
video. Also cuts the premium "Download Australia" egress this app is billed at.

**2. `preload="none"` + posters + lazy-load (quickest, very low risk).**
Only `VoteScreen` sets `preload` at all; every other `<video>` defaults to
`auto`, so iOS starts buffering all of them on page load. Add `preload="none"`
and a `poster` off-screen, and an IntersectionObserver so scrolling a list
doesn't kick off a dozen parallel downloads.

**3. Trim on the device before upload (biggest upload win, most complex).**
A 200MB clip currently goes phone → Railway (full 200MB over the *slow*
direction) → ffmpeg cuts it to ~2MB → back to the phone → up again to
Storage. The whole original crosses the network to be thrown away. The trim
UI already produces `trimStart`/`trimEnd`, so a WebCodecs/canvas pass could
cut it before it leaves the device — 200MB becomes ~3MB, roughly 10-50× on
long clips. Cheaper partial version: have the server upload straight to
Storage with the Admin SDK and return just the URL, removing one full
transfer of the processed file.

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
