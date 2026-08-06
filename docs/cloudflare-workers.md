# Deploying Saintagram to Cloudflare Workers

Saintagram uses Vinext's native Cloudflare Workers adapter. Firebase remains the
authentication/database provider and Firebase Storage now stores profile
images; deploying the web application does not migrate either service.

## 1. Install and verify locally

Use Node.js 22 or newer, then run:

```powershell
npm install
npm run typecheck
npm test
npm run build:vinext
```

Exercise the production Worker locally with `npm run start:vinext`.

## 2. Create or select a Cloudflare account

Create a Cloudflare account if necessary. Workers deployments require a
workers.dev subdomain, which Cloudflare asks you to choose the first time you
open **Workers & Pages** in the dashboard.

Authenticate this computer:

```powershell
npx wrangler login
npx wrangler whoami
```

Copy the account ID shown by `whoami`, then either set it for the current
PowerShell session with `$env:CLOUDFLARE_ACCOUNT_ID="your-account-id"`, or add
`"account_id": "your-account-id"` near the top of `wrangler.jsonc`.

Do not commit an API token. For CI instead of interactive login, create a
Cloudflare API token from the **Edit Cloudflare Workers** template and expose it
to CI as `CLOUDFLARE_API_TOKEN`, together with `CLOUDFLARE_ACCOUNT_ID`.

## 3. Configure public build variables

Vinext reads `.env.production` when it builds. Create that ignored file from
`.env.example` and set these browser-safe values:

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
```

These values are embedded into the browser bundle and must be present during
every production build. They are configuration identifiers, not server secrets.

## 4. Upload server secrets

Run each command and paste the value when Wrangler prompts. This avoids placing
secrets in shell history or source control.

```powershell
npx wrangler secret put SITE_ACCESS_CODE
npx wrangler secret put SITE_ACCESS_SESSION_SECRET
npx wrangler secret put FIREBASE_ADMIN_PROJECT_ID
npx wrangler secret put FIREBASE_ADMIN_CLIENT_EMAIL
npx wrangler secret put FIREBASE_ADMIN_PRIVATE_KEY
```

- `SITE_ACCESS_CODE` must contain at least 12 characters.
- `SITE_ACCESS_SESSION_SECRET` must contain at least 32 random characters.
- Get the Firebase Admin values from **Firebase Console > Project settings >
  Service accounts**. Paste `private_key` as its complete multiline value. The
  project ID must match `NEXT_PUBLIC_FIREBASE_PROJECT_ID`.

Secrets are scoped to the Worker name in `wrangler.jsonc` (`saintagram`). If the
Worker name changes, upload them again under the new name.

## 5. Deploy

```powershell
npm run deploy:vinext
```

Wrangler prints the resulting `https://saintagram.<subdomain>.workers.dev` URL.
Open it and verify the access code, Firebase sign-in, profile creation, image
upload, and account-cancellation flows. For later releases, repeat the same
command. Cloudflare keeps deployment history under **Workers & Pages >
saintagram > Deployments**.

## 6. Authorize the deployed hostname

Add the exact workers.dev hostname (and any custom domain) to **Firebase Console
> Authentication > Settings > Authorized domains** before testing sign-in.

Also verify that Firebase Storage is enabled and the `storage.rules` policy
described in the main README is configured. Those settings are not created by a
Workers deployment.

## 7. Optional custom domain

In **Cloudflare Dashboard > Workers & Pages > saintagram > Settings > Domains &
Routes**, choose **Add > Custom domain** and enter the hostname. The domain must
be in a Cloudflare-managed zone. Add that hostname to Firebase Authorized
domains as well.

## CI deployment

A CI job needs Node.js 22+, `npm ci`, the public `NEXT_PUBLIC_*` values at build
time, and `CLOUDFLARE_API_TOKEN` plus `CLOUDFLARE_ACCOUNT_ID`. The five Worker
runtime secrets are normally uploaded once with `wrangler secret put`; they do
not need to be exposed to the build job. Run `npm run deploy:vinext` in CI.
