# Arcade community setup (project arcade-9e532)

Implemented in wowpixel-lab/apps/arcade. Racer is the first connected game. Other games are not yet instrumented.

## Firebase console
1. Enable Authentication > Sign-in method > Google and select a support email.
2. Add the exact deployed hostname to Authentication > Settings > Authorized domains. The supplied hostname is `aracde.labs.wowpixel.app`; confirm that spelling. Add `localhost` for local Next.js testing. File URLs cannot use this integration.
3. Create Cloud Firestore in production mode. Choose a region close to the Vercel function region.
4. Publish the contents of firestore.rules using Firestore > Rules. All direct browser database access is denied. The authenticated Vercel server alone accesses the database. Alternatively run `firebase deploy --only firestore:rules --project arcade-9e532 --config apps/arcade/firebase/firebase.json` from the repository root with an authorized Firebase CLI login.
5. Optionally configure a Firestore TTL policy on the `runs` collection group using the `expiresAt` field (24-hour lifetime). Private completed-run history is independent and remains available. The UI shows the most recent 20 runs.

## Server credential (do not paste keys into chat or commit them)
From Firebase Project settings > Service accounts, obtain a private server credential. In the arcade Vercel project's Environment Variables, add `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` from that credential. Scope them to Production and any deliberately configured Preview environments. Redeploy after adding them. For local testing put them in apps/arcade/.env.local (ignored by git). The project ID is fixed to arcade-9e532. The private key supports real newlines or escaped \n. The public browser config is intentionally included in the bundle.

No Cloud Storage bucket permissions, billing upgrades, live security rule changes, or Google Analytics tracking were enabled by this implementation. Preset avatars are local emoji characters.

## Data and behavior
- `players/{uid}`: handle, normalized unique handle key, avatar, optional country and display preference. Google email is never copied here or returned publicly.
- `handles/{normalized}` reserves a handle transactionally; renaming releases the old one.
- `games/racer`: play, like and approximate unique-player counters. Starts are rate-limited to one per actor per 10 seconds; resuming never counts again. Guests use a random HttpOnly same-site browser cookie. Signing in or clearing cookies can increase the approximate unique count. This is not bot-proof analytics.
- `games/racer/likes/{uid}`: one signed-in like per user, with idempotent like/unlike.
- `runs/{uuid}`: server start time and immutable run owner. Guest starts count but cannot be upgraded to ranked results later. Finished submissions are idempotent. Runs expire for submissions after 24 hours.
- `players/{uid}/history/{run}`: private results, recent 20 returned by API.
- `games/racer/bests/{uid}`: one highest score per user. Top 10 queried server-side, profile fields resolved when read. Equal scores use Firestore document-ID ordering. UI never receives user IDs or email.
- Racer score is floor(distance metres) + bonus points. Server checks elapsed time, max speed, finite/nonnegative numbers and plausible bonus bounds. Client-authoritative games remain cheat-able; this is basic abuse reduction, not authoritative simulation. Public reads and new guest identities require deployment-level rate limiting if attacked. Use Vercel Firewall rules for /api/community before wider promotion.
- Country suggestion uses the Vercel country header only in Vercel deployments, never GPS. It can be corrected or hidden. The service does not persist raw IP addresses.

## Game integration contract
The shared widget currently supports racer only. Add explicit server validators before enabling another game; never accept arbitrary game IDs or client-selected score formulas.
Dispatch `arcade:run-start` once per fresh run with `{game:'racer'}`. Dispatch `arcade:run-end` on game over with `{game:'racer', distance, bonus, seconds}`. Loading a page and resuming are not starts. Include community.css and community.bundle.js. All event failures are isolated from gameplay.

## Validation and launch checklist
Run `npm run test:community --workspace=@wowpixel-lab/arcade`, lint, and the arcade production build. Start the Next.js app (not a static file server). With credentials configured, verify Google sign-in, duplicate-handle rejection across two accounts, likes/unlikes, one completed racer run, replayed submissions, top-10 order and private history isolation. Live Firebase end-to-end validation is still pending console setup and server credentials.
