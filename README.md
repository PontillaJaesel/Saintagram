# Saintagram: My Profile Before God

Saintagram is a responsive, private reflection application inspired by the
familiar shape of a social profile without popularity metrics, public follower
counts, rankings, streaks, or competitive engagement.

The core experience moves from registration and privacy consent through a
Matthew 5:3 reflection, a ten-part Profile Before God builder, and an
owner-only profile with reflection, journey, private-area, editing, and account
controls.

## What is included

- Email/password registration, login, persistent sessions, logout, password
  reset request, password change, and account deletion
- A server-verified invitation-code entrance protecting every application route
- Consent and spiritual introduction gates
- Protected-route routing based on consent and profile completion
- Ten-step profile builder with automatic draft saves, explicit save,
  restoration, discard confirmation, review, edit links, and immediate profile
  navigation
- Image upload validation plus candle, seed, cross, heart, open-hands, and road
  symbols
- Profile tabs for Posts God Sees, Spiritual Journey, and confirmation-gated
  Private Reflections
- Owner reflection create, edit, delete, privacy, and creation-date controls
- Profile editing, privacy preferences, private personal export, and
  destructive-action confirmations
- Firebase Authentication and Firestore, with private Supabase image storage
- A fully functional browser-local demonstration mode when Firebase is absent
- Strict Firestore ownership rules and Supabase row-level storage policies
- Vitest coverage for route guards, redirects, profile saving, validation, and
  private-field projection

There are deliberately no facilitator accounts, groups, assignments, follower
totals, public likes, rankings, or engagement scores.

## Run locally

Requirements:

- Node.js 22 or newer
- npm

Install and start:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Before starting, copy `.env.example` to `.env.local` and configure the private
entrance:

```dotenv
SITE_ACCESS_CODE=use-a-private-code-with-12-or-more-characters
SITE_ACCESS_SESSION_SECRET=use-a-separate-random-secret-with-32-or-more-characters
```

The access code is checked only on the server. A successful visitor receives a
signed, HttpOnly cookie that expires after seven days; the code itself is never
stored in browser storage or shipped in client JavaScript. Rotate both values
to change the code and invalidate all existing access sessions.

Without Firebase variables, Saintagram automatically enters **Private demo**
mode. Data stays in that browser's local storage. This fallback is convenient
for demonstrations but is not production-grade storage on a shared device.

The preloaded sample profile can be opened with:

```text
Email: grace@saintagram.demo
Password: Beloved123!
```

New accounts and the entire onboarding journey also work in demo mode.

## Firebase setup

1. Create a Firebase project.
2. Enable **Authentication → Email/Password**.
3. Create a Firestore database.
4. Copy `.env.example` to `.env.local`.
5. Fill in the Firebase web configuration:

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Firebase web configuration identifies the project and is expected in client
code. Never add an Admin SDK private key, service-account JSON, or other server
secret to a `NEXT_PUBLIC_` variable.

Deploy the supplied rules and indexes after selecting the project:

```bash
npx firebase login
npx firebase use --add
npx firebase deploy --only firestore:rules,firestore:indexes
```

The application uses these collections:

- `users/{uid}` — private account and routing metadata
- `profiles/{uid}` — the standard owner-only profile projection, with no
  `hiddenStory` field
- `privateProfiles/{uid}` — the separated owner-only Hidden Story
- `drafts/{uid}` — owner-only profile builder progress
- `reflectionPosts/{reflectionId}` — owner-owned reflection entries

See [docs/data-model.md](docs/data-model.md) for exact fields and privacy
boundaries.

## Supabase image-storage setup

Firebase remains the identity provider and Firestore remains the database.
Only profile-image files move to Supabase.

1. Create or open the Supabase project that will store this environment's
   images.
2. Open the project's **Connect** dialog and copy its **Project URL** and
   **Publishable key** into `.env.local`. You can also find or create the
   publishable key under **Settings → API Keys**:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

   These two browser values are expected to be public. Never put a Supabase
   secret key or service-role key in a `NEXT_PUBLIC_` variable.
3. In **Authentication → Third-Party Auth**, add **Firebase** and enter the
   same Firebase Project ID used by `NEXT_PUBLIC_FIREBASE_PROJECT_ID`.
4. Open the Supabase **SQL Editor**, paste
   `supabase/migrations/20260729000000_profile_images.sql`, and run it once.
   It creates or corrects the private `profile-images` bucket, applies the
   2 MiB and JPEG/PNG/WebP limits, grants owner-only read/upload/delete, and
   explicitly denies overwrites.
5. In **Storage**, verify that `profile-images` exists and is marked private.
   Do not add public or broad bucket policies.
6. Let the server automatically give signed-in Firebase users the custom claim
   `role: "authenticated"`. Supabase uses this claim to select its
   authenticated database role. In **Firebase Console → Project settings →
   Service accounts**, generate a private key for this environment. Copy only
   these three matching values from the downloaded JSON into `.env.local`:

   ```dotenv
   FIREBASE_ADMIN_PROJECT_ID=your-firebase-project-id
   FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-...@your-project.iam.gserviceaccount.com
   FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

   Keep these values server-only: never add `NEXT_PUBLIC_`, never commit
   `.env.local`, and never paste them into client code. Restart the development
   server after changing environment variables.

   On the first image request, `/api/image-access` verifies the caller's
   Firebase ID token, assigns the claim only to that verified UID, preserves
   its other custom claims, and forces a fresh browser token. Existing and new
   app users therefore do not need a manual claim command or a sign-out cycle.
   This route runs in the Next.js server and does not require Firebase Cloud
   Functions or the Blaze plan.

   `node scripts/grant-supabase-role.mjs --all` remains available as an
   optional administrative backfill/recovery tool when Application Default
   Credentials are configured, but it is not part of normal registration.

The application stores only a private object path such as
`users/{firebaseUid}/profile/{uuid}.jpg` in Firestore. It sends the current
Firebase ID token to Supabase, downloads the object as a Blob, and revokes the
temporary browser URL when it is no longer needed. No image file or permanent
download URL is stored in Firestore.

This is an intentional hard cutover. If an older environment already has
profile files in a Firebase image bucket, first re-upload each wanted image to
`profile-images` and save its new private path. Then remove the obsolete URL
fields and old bucket objects in the Firebase console. The application does
not read old download URLs, so verify that no legacy image data remains before
retiring that bucket.

## Security model

- Every page is behind the server-side invitation gate except the code-entry
  route and its verification endpoint.
- Firestore and the private Supabase bucket require an authenticated Firebase
  UID that matches the document or object owner.
- Standard profile reads query only `profiles/{uid}`. Hidden Story content is
  stored separately and is not fetched until the user passes an additional
  privacy check.
- Normal profile and journey reads query only non-private reflections.
- Firebase-mode local draft fallback deliberately omits the Hidden Story.
- Inputs have length limits; lists are normalized; React renders user content
  as text; uploaded images are restricted to JPG, PNG, or WebP and 2 MiB.
- Personal export is explicitly an owner-requested private archive, never a
  public profile export.
- Account deletion reauthenticates, removes all images beneath the user's
  Supabase prefix in bounded pages, deletes Firestore content in bounded
  batches, and then deletes the Authentication user. Cleanup failures stop the
  process with a visible error.

The shared entrance code proves possession of an invitation, not a person's
identity, and can be forwarded. Firebase Authentication and owner-only rules
remain the authorization boundary for personal data.

The browser confirmation before showing private content is a visual privacy
check, not the authorization boundary. Firebase ownership rules remain the
authorization boundary.

## Scripts

```bash
npm run dev        # development server
npm run lint       # source lint
npm run typecheck  # strict TypeScript check
npm test           # unit and component tests
npm run build      # optimized production build
npm start          # serve the generated production build
npm run test:rules # Firestore ownership tests using the emulator
```

Firestore emulator tests require Java 11 or newer.

## Project map

```text
app/                 Next.js routes
components/          Reusable UI, forms, providers, and feature components
lib/app-service.ts   Firebase/local repository and authentication adapters
lib/firebase-admin.ts Server-only Firebase token verification and claim setup
lib/profile-images.ts Private Supabase image upload/download/deletion
lib/supabase.ts       Browser client using the current Firebase ID token
lib/profile.ts       Private-safe profile projections and normalization
types/               Application data models
tests/               Guard, redirect, storage, and privacy tests
scripts/             Production-host package preparation
supabase/migrations/ Private bucket and row-level storage policies
docs/data-model.md   Firestore and Supabase Storage contract
firestore.rules      Owner-only database rules
data/demo-seed.json  Fictional demonstration data
```

## Production notes

The local fallback is intentionally scoped to demonstration. A production
launch should also add server-side retryable account cleanup (including a
second Supabase cleanup after old Firebase ID tokens expire), Firebase App
Check, abuse monitoring, and an approved pastoral/privacy review of prompts and
copy. Deleting a Firebase user prevents token refresh but an already-issued ID
token can remain valid until it expires, so high-assurance deletion needs that
delayed privileged cleanup.
