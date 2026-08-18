# Saintagram turnover checklist

Use this checklist before handing the application to another maintainer or
deploying a release. Never commit `.env.local`, `.env.production`, Firebase
service-account JSON, access codes, or permanent user passwords.

## First-login contract

1. An administrator adds an account to `lib/temporary-accounts.data.mjs` and
   runs `npm run auth:provision` with the server credentials in `.env.local`.
2. The user signs in with the issued username and temporary password.
3. An incomplete user is routed to `/create` and completes the two-step profile.
4. The user is routed to `/settings` and must replace the temporary password.
5. Only after profile creation and password replacement may the user continue
   through any remaining privacy gate to the main profile.

Do not manually create only a Firebase Authentication record: provisioning also
creates the Firestore routing metadata that the application requires.

## Required environment

Copy `.env.example` to an ignored local or production environment file and set:

- `SITE_ACCESS_CODE` and `SITE_ACCESS_SESSION_SECRET`
- all six `NEXT_PUBLIC_FIREBASE_*` web configuration values, including the
  exact Storage bucket shown in Firebase Console
- `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, and
  `FIREBASE_ADMIN_PRIVATE_KEY`
- `GOOGLE_MAPS_API_KEY` when reverse geocoding is enabled

Firebase browser configuration is public project metadata. Firebase Admin
credentials and entrance-gate values are secrets and must be supplied through
the deployment platform's secret store.

## Release gate

Run from a clean checkout with Node.js 22 or newer:

```powershell
npm install
npm run lint
npm run typecheck
npm test -- --run
npm run test:rules
npm run test:firebase-live
npm run build
git diff --check
```

Then use a disposable provisioned tester to verify the full browser sequence:
login, profile creation, password replacement, profile load, Firestore save,
profile-image upload/read/delete, logout, permanent-password login, and rejection
of the old temporary password. Reset or remove the tester afterward.

## Firebase and deployment

- Deploy and verify `firestore.rules`, `firestore.indexes.json`, and
  `storage.rules` for the intended Firebase project.
- The deploying Google account needs permission to use project services and to
  update Firestore and Storage rules. A `serviceusage.services.use` 403 must be
  resolved in Google Cloud IAM before turnover.
- Confirm Email/Password is the only enabled sign-in method required by the app.
- Confirm both Cloudflare Workers have the secrets documented in
  `docs/cloudflare-workers.md` and both deployed hosts are Firebase authorized
  domains.
- Deploy only through `npm run deploy` and `npm run deploy:admin`; both commands
  rebuild and validate their target before publishing.

Record the release commit, deployment time, Firebase project ID, Worker URLs,
test-account cleanup result, and any unresolved external IAM issue in the
handoff ticket. Share secrets through an approved password manager, never in the
repository or handoff document.
