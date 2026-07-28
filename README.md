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
- Firebase Authentication, Firestore, and Storage adapters
- A fully functional browser-local demonstration mode when Firebase is absent
- Strict Firestore and Storage ownership rules
- Vitest coverage for route guards, redirects, profile saving, validation, and
  private-field projection

There are deliberately no facilitator accounts, groups, assignments, follower
totals, public likes, rankings, or engagement scores.

## Run locally

Requirements:

- Node.js 20 or newer
- npm

Install and start:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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
4. Enable Firebase Storage.
5. Copy `.env.example` to `.env.local`.
6. Fill in the Firebase web configuration:

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
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
npx firebase deploy --only firestore:rules,firestore:indexes,storage
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

## Security model

- Firestore and Storage require an authenticated UID that matches the resource
  owner.
- Standard profile reads query only `profiles/{uid}`. Hidden Story content is
  stored separately and is not fetched until the user passes an additional
  privacy check.
- Normal profile and journey reads query only non-private reflections.
- Firebase-mode local draft fallback deliberately omits the Hidden Story.
- Inputs have length limits; lists are normalized; React renders user content
  as text; uploaded images are restricted to JPG, PNG, or WebP and 2 MiB.
- Personal export is explicitly an owner-requested private archive, never a
  public profile export.
- Account deletion reauthenticates, removes Firestore content, attempts to
  remove all images beneath the user's Storage prefix, then deletes the
  Authentication user.

The browser confirmation before showing private content is a visual privacy
check, not the authorization boundary. Firebase ownership rules remain the
authorization boundary.

## Scripts

```bash
npm run dev        # development server
npm run typecheck  # strict TypeScript check
npm test           # unit and component tests
npm run build      # optimized production build
npm run test:rules # Firestore ownership tests using the emulator
```

Firestore emulator tests require Java 11 or newer.

## Project map

```text
app/                 Next.js routes
components/          Reusable UI, forms, providers, and feature components
lib/app-service.ts   Firebase/local repository and authentication adapters
lib/profile.ts       Private-safe profile projections and normalization
types/               Application data models
tests/               Guard, redirect, storage, and privacy tests
docs/data-model.md   Firestore and Storage contract
firestore.rules      Owner-only database rules
storage.rules        Owner-only image rules
data/demo-seed.json  Fictional demonstration data
```

## Production notes

The local fallback is intentionally scoped to demonstration. A production
launch should also add server-side retryable account cleanup (for any Storage
object deletion that fails), Firebase App Check, abuse monitoring, and an
approved pastoral/privacy review of prompts and copy.
