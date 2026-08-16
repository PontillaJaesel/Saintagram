# Deploying Saintagram to two Cloudflare Workers

Saintagram uses one Next.js/Vinext codebase and produces two explicit Wrangler
deployment configurations. The root `wrangler.jsonc` always describes the
normal `saintagram` Worker. After Vinext builds `dist/server/wrangler.json`, the
repository derives `dist/server/wrangler.admin.json` for the isolated
`saintagram-admin` Worker. `.wrangler/deploy/config.json` points to the generated
normal config and is not the source of truth.

## Local development

Use Node.js 22 or newer:

```powershell
npm install
npm run dev
```

- Normal application: `http://localhost:3000`
- Admin dashboard: `http://localhost:3000/admin`

The local admin route skips the invitation-code middleware but still requires
Firebase authentication and a server-verified `admin: true` custom claim.

To exercise the built admin Worker mode locally:

```powershell
npm run start:admin
```

## Public Firebase build configuration

Vinext reads `.env.production` during a production build. These Firebase web
identifiers are browser-visible and shared by both builds:

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
```

Do not place service-account credentials in a `NEXT_PUBLIC_` variable.

## Normal Worker secrets

These existing secrets remain attached to `saintagram`:

```powershell
npx wrangler secret put SITE_ACCESS_CODE --config wrangler.jsonc
npx wrangler secret put SITE_ACCESS_SESSION_SECRET --config wrangler.jsonc
npx wrangler secret put FIREBASE_ADMIN_PROJECT_ID --config wrangler.jsonc
npx wrangler secret put FIREBASE_ADMIN_CLIENT_EMAIL --config wrangler.jsonc
npx wrangler secret put FIREBASE_ADMIN_PRIVATE_KEY --config wrangler.jsonc
npx wrangler secret put GOOGLE_MAPS_API_KEY --config wrangler.jsonc
```

`GOOGLE_MAPS_API_KEY` is used only by the normal Worker to reverse-geocode
device coordinates after the visitor grants browser geolocation permission.
Restrict the key in Google Cloud to the Geocoding API. Do not add it to the
admin Worker or expose it through a `NEXT_PUBLIC_` variable.

## Admin Worker secrets

Build once so the generated admin config exists, then upload only the Firebase
Admin credentials required by the protected dashboard APIs:

```powershell
npm run build:admin
npx wrangler secret put FIREBASE_ADMIN_PROJECT_ID --config dist/server/wrangler.admin.json
npx wrangler secret put FIREBASE_ADMIN_CLIENT_EMAIL --config dist/server/wrangler.admin.json
npx wrangler secret put FIREBASE_ADMIN_PRIVATE_KEY --config dist/server/wrangler.admin.json
```

Do not upload `SITE_ACCESS_CODE` or `SITE_ACCESS_SESSION_SECRET` to the admin
Worker. Admin mode permits only `/`, `/admin/*`, `/api/admin/*`, and required
framework assets; normal application paths return 404.

## Validation and deployment

Run before either deployment:

```powershell
npm run typecheck
npm test
npm run lint
npm run build
```

Deploy the normal Worker only:

```powershell
npm run deploy
```

Deploy the admin Worker only:

```powershell
npm run deploy:admin
```

Both scripts rebuild and validate the exact Worker name and application mode
before invoking Cloudflare. A target mismatch aborts before deployment.

Expected Workers:

- `https://saintagram.axjp.workers.dev`
- `https://saintagram-admin.axjp.workers.dev`

Add both exact workers.dev hostnames under **Firebase Console > Authentication
> Settings > Authorized domains**.

In **Cloudflare Dashboard > Workers & Pages**, open `saintagram-admin`, verify
its workers.dev URL is enabled under **Settings > Domains & Routes** (or the
current **Domains** tab), and confirm the three Firebase Admin secrets under
**Settings > Variables and Secrets**. No custom domain or DNS record is needed.
