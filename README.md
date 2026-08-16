# Saintagram: My Profile Before God

To deploy the application to Cloudflare Workers, follow the project-specific
[Cloudflare Workers deployment guide](docs/cloudflare-workers.md).

Saintagram is a responsive, private reflection application inspired by the
familiar shape of a social profile without popularity metrics, public follower
counts, rankings, streaks, or competitive engagement.

The core experience moves from registration and privacy consent through a
Matthew 5:3 reflection, a ten-part Profile Before God builder, and an
owner-only profile with reflection, journey, private-area, editing, and account
controls.

## What is included

- Google sign-in, verified email/password accounts, and persistent anonymous
  guest accounts, plus logout, password reset, password change, and deletion
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
- Firebase Authentication and Firestore, with private Firebase Storage image uploads
- A fully functional browser-local demonstration mode when Firebase is absent
- Strict Firestore ownership rules and Firebase Storage security rules
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
2. Under **Authentication → Sign-in method**, enable **Email/Password**,
   **Google**, and **Anonymous**. Google and anonymous authentication are
   supported on Firebase's no-cost Spark plan. Add each deployed host under
   **Authentication → Settings → Authorized domains**.
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

Firebase Auth uses local browser persistence, so closing and reopening the site
restores the last signed-in account. A guest therefore keeps the same anonymous
Firebase UID and data until they explicitly log out, clear this site's browser
data, switch browsers/devices, or lose access to that browser profile. Guest
accounts have no recovery method; users should use Google or email for durable,
cross-device access.

### Verification and branded authentication email

In **Firebase Console → Authentication → Templates**, enable and edit both
**Email address verification** and **Password reset**. Set the sender name and
the project's **Public-facing name** to `Saintagram` so Firebase's internal app
name is not shown to recipients. For each template, choose **Customize domain**,
enter `saintagram.com`, then add Firebase's TXT and CNAME records at the DNS
provider. After Firebase reports verification complete, apply the custom domain.
Saintagram uses provisioned username codes, not public email registration or
Google sign-in. Each username maps server-side to a private Firebase Auth email
such as `usr001@accounts.saintagram.local`; users never enter that address.
Firebase Authentication owns password verification and issues the UID used by
all Firestore and Storage access.

Provision or reconcile every issued account without manually editing Firestore:

```bash
npm run auth:provision
```

For a repeatable end-to-end test, reset only the dedicated test account:

```bash
npm run auth:provision -- --reset-test-user
```

Test logins:

- `USRTEST3` / `NewTemp3@2026`
- `USRTEST2` / `NewTemp2@2026`

Each temporary password becomes invalid after its required permanent-password
change succeeds.

This preserves accounts that already have permanent passwords. Use
`npm run auth:provision -- --reset-incomplete` only to rotate temporary
passwords for accounts still awaiting their first password change.

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

## Firebase image-storage setup

Firebase remains the identity provider, Firestore remains the database, and
Firebase Storage now holds profile images directly.

1. In **Firebase Console → Build → Storage**, enable Cloud Storage if it is not
  already enabled for this project. The default bucket is usually
  `<project-id>.appspot.com`.
2. Open `storage.rules` in this repo and deploy it to Firebase Storage, or paste
  the same rules into the Console rules editor. The rules allow only the signed
  in owner to read, upload, or delete files under
  `users/{uid}/profile/{uuid}.{jpg|png|webp}` and cap uploads at 2 MiB.
3. If your project uses a non-default bucket, set
  `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` in `.env.local` to that bucket name.
  Otherwise the app uses the default bucket automatically.
4. Keep the Firebase Admin service-account values in `.env.local` as before for
  server-only account-management operations:

  ```dotenv
  FIREBASE_ADMIN_PROJECT_ID=your-firebase-project-id
  FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-...@your-project.iam.gserviceaccount.com
  FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
  ```

  Never add `NEXT_PUBLIC_` to those Admin values, never commit `.env.local`,
  and restart the development server after changing environment variables.

The application stores only a private object path such as
`users/{firebaseUid}/profile/{uuid}.jpg` in Firestore. The browser reads and
writes the file through Firebase Storage using the signed-in Firebase user, so
there is no access-claim step, no server image-access route, and no per-user
role setup.

If an older environment still has profile images in Supabase, re-upload the
images you want to keep into Firebase Storage, update the stored paths, and
then delete the obsolete Supabase bucket and migration artifacts.

## Security model

- Every page is behind the server-side invitation gate except the code-entry
  route and its verification endpoint.
- Firestore and Firebase Storage require an authenticated Firebase UID that
  matches the document or object owner.
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
  Firebase Storage prefix, deletes Firestore content in bounded batches, and
  then deletes the Authentication user. Cleanup failures stop the process with
  a visible error.

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
lib/profile-images.ts Private Firebase Storage image upload/download/deletion
lib/profile.ts       Private-safe profile projections and normalization
types/               Application data models
tests/               Guard, redirect, storage, and privacy tests
scripts/             Production-host package preparation
storage.rules        Firebase Storage access policy for profile images
docs/data-model.md   Firestore and Firebase Storage contract
firestore.rules      Owner-only database rules
data/demo-seed.json  Fictional demonstration data
```

## Production notes

The local fallback is intentionally scoped to demonstration. A production
launch should also add server-side retryable account cleanup (including a
second Firebase Storage cleanup after old Firebase ID tokens expire), Firebase
App Check, abuse monitoring, and an approved pastoral/privacy review of prompts
and copy. Deleting a Firebase user prevents token refresh but an already-issued
ID token can remain valid until it expires, so high-assurance deletion needs
that delayed privileged cleanup.
# Administration

The administrator portal is available at `/admin` after both the site access gate and Firebase sign-in. Authorization is enforced by protected server APIs using the Firebase Authentication custom claim `admin: true`; local/demo users are never treated as administrators.

Grant or revoke the claim with server credentials in `.env.production`:

```bash
npm run admin:claim -- --email admin@example.com --grant
npm run admin:claim -- --uid FIREBASE_UID --revoke
```

The account must refresh its Firebase ID token (usually by signing out and back in) after a claim change.

Tracked entry URLs are `/open/qr?campaign=event-2026&next=/` and `/open/common?next=/`. `campaign` accepts up to 64 letters, numbers, underscores, and hyphens; `next` must be a safe internal Saintagram path. These routes store server time and approximate Cloudflare city/region/country when supplied, never raw IP addresses. Events are associated with a signed-in account through a short-lived, HTTP-only pending-event cookie.

The Export Data page produces one `.xlsx` workbook with separate worksheets. Exports and sensitive user-data views are written to `adminAuditLogs`.

Deploy `firestore.rules` with `firebase deploy --only firestore:rules` after review. Firebase Admin variables and the site-access secrets must be configured in the Cloudflare production environment. `.env.production` is ignored and must never be committed.
