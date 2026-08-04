# Saintagram data model and privacy boundaries

Saintagram stores structured user-generated content in owner-only Firebase
resources and profile-image files in an owner-only Supabase bucket. There are
no public collections, public profile projections, facilitator records, groups,
assignments, follower counts, rankings, or engagement metrics.

## Firestore collections

### `users/{uid}`

Private account metadata. The document ID is the Firebase Authentication UID.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Must equal `{uid}` and is immutable. |
| `email` | string | Private account email; immutable after creation. |
| `createdAt` | ISO-8601 string | Immutable after creation. |
| `updatedAt` | ISO-8601 string | Updated with account metadata. |
| `privacyConsentAt` | ISO-8601 string or null | Records acceptance of the privacy notice. |
| `spiritualIntroSeenAt` | ISO-8601 string or null | Optional onboarding milestone. |
| `profileCompleted` | boolean | Controls routing to creation or the profile. |
| `privacyPreferences` | map | Optional booleans `requirePrivateCheck` and `showReflectionDates`. |

Only the matching authenticated user can get, create, update, or delete this
document. Collection listing is disabled.

### `profiles/{uid}`

The user's non-sensitive profile projection. The document ID, `id`, and `userId`
must all equal the Firebase Authentication UID. Despite being safe for the
standard profile interface, this collection remains owner-only.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Must equal the Firestore document ID. |
| `userId` | string | Firebase UID; immutable and used for ownership checks. |
| `profileName` | string | Display name or faith-centered identity. |
| `imagePath` | string | Empty or the private Supabase object path `users/{uid}/profile/{uuid}.{jpg|png|webp}`. |
| `selectedSymbol` | string | Predefined symbol key, or an empty string when skipped. |
| `spiritualBio` | string | Up to 320 characters. |
| `followers` | string[] | Faith guides; no count is stored or displayed. |
| `following` | string[] | Current influences. |
| `heartSeeks` | string[] | Reflection choices and custom entries. |
| `godsComment` | string | Up to 280 characters. |
| `heavenlyHashtag` | string | One selected or custom hashtag. |
| `createdAt` | ISO-8601 string | Immutable after creation. |
| `updatedAt` | ISO-8601 string | Last profile update. |

`hiddenStory` is not an allowed key in this collection. Firestore returns whole
documents, so client-side field hiding is not a security boundary. A future
share feature must create a separate allowlisted projection and must never
relax reads on either `profiles` or `privateProfiles`.

### `privateProfiles/{uid}`

The owner-only sensitive extension of the profile. The client writes this
document in the same batch as the public profile projection.

| Field | Type | Notes |
| --- | --- | --- |
| `userId` | string | Must equal `{uid}`. |
| `hiddenStory` | string | Optional answer represented as an empty string when skipped; up to 1,000 characters. |
| `updatedAt` | ISO-8601 string | Last private-profile update. |

Only the matching authenticated user may get or write this exact document.
Listing is disabled, and there is no public query or share path.

### `drafts/{draftId}`

Owner-only server backup for unfinished profile creation. For simple lookups,
the Firebase UID is required as `draftId`. Browser local storage may also hold a
temporary draft for offline/demo mode.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Must equal the Firestore document ID. |
| `userId` | string | Firebase UID; immutable. |
| `currentStep` | integer | Zero-based step, from 0 through 10. |
| `draftData` | map | Incomplete form values, including sensitive answers. |
| `updatedAt` | ISO-8601 string | Last automatic or manual draft save. |

Draft data is never queried or rendered as public content.

### `reflectionPosts/{reflectionId}`

Owner-created reflection entries.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Must equal the Firestore document ID. |
| `userId` | string | Firebase UID; immutable. |
| `content` | string | Required; 1–500 characters. |
| `isPrivate` | boolean | Controls presentation, not ownership; all posts are owner-only. |
| `createdAt` | ISO-8601 string | Immutable after creation. |
| `updatedAt` | ISO-8601 string | Last edit time. |

Queries must include `where("userId", "==", auth.currentUser.uid)`. The supplied
indexes support reverse-chronological queries, with or without an `isPrivate`
filter. Security rules validate ownership independently of client queries.

## Supabase Storage

Profile images are stored in the private bucket `profile-images` under:

```text
users/{firebaseUid}/profile/{uuid}.{jpg|png|webp}
```

The client supplies the current Firebase ID token through Supabase's
Third-Party Auth integration. Reads, inserts, and deletes require all of the
following:

- The JWT has the Firebase UID in `sub` and the custom claim
  `role: "authenticated"`.
- The JWT issuer is Firebase and matches its Firebase project audience.
- The second path segment equals that `sub`.
- The object path's user segment equals that `sub`; Storage may populate its
  own ownership metadata after the insert policy is evaluated.
- The object is inside the exact three-folder owner prefix and has a UUID file
  name with a JPG, PNG, or WebP extension.

The bucket is private, uploads are limited to 2 MiB and JPEG/PNG/WebP MIME
types, and object updates/upserts are denied. Replacing a picture creates a new
UUID object, commits its path to Firestore, and then removes the old object.
Firestore never stores image bytes, a public URL, or a signed URL.

If a signed-in Firebase user does not yet have the required role claim, the
browser calls the same-origin `POST /api/image-access` route. The Node route
verifies the Firebase ID token with server-only Admin credentials, derives the
UID from that verified token, preserves existing claims, and idempotently adds
`role: "authenticated"`. It accepts no client-selected UID or role. The browser
then force-refreshes the ID token before contacting Supabase. This avoids a
manual per-account claim step without exposing Admin credentials or bypassing
Supabase row-level security.

## Security invariants

- Authentication secrets stay in Firebase Authentication, never Firestore or
  browser storage.
- Every user-content write must carry the authenticated user's UID.
- Ownership fields, document IDs, and creation timestamps cannot be reassigned
  during updates.
- Unknown Firestore collections and Supabase object paths fail closed.
- Hidden Stories exist only in `privateProfiles/{uid}` (and unfinished,
  owner-only drafts); completed `profiles/{uid}` documents reject that field.
- Hidden Stories, drafts, profile data, and all reflections have no anonymous
  or cross-user read path.
- `isPrivate` provides a UI privacy distinction, but server authorization is
  stronger: even non-private reflections are accessible only to their owner.
- The application should sanitize rendered text and rely on text rendering
  rather than injecting user-provided HTML.

## Deleting an account

Deleting Firebase Authentication credentials does not automatically remove
Firestore documents or Supabase objects. The account-deletion workflow first
reauthenticates, removes every object in the owner's `profile-images` prefix,
deletes reflection posts and the UID-keyed Firestore documents, and then
deletes the Authentication account. A failure stops the workflow before later
destructive steps so it can be retried.

For production, a privileged retryable backend should verify and repeat the
cascade. In particular, an already-issued Firebase ID token can remain valid
until expiry even after the Firebase user is deleted, so high-assurance
deletion should schedule a second Supabase prefix cleanup after the token
window. Admin and Supabase service-role credentials must never be bundled into
the browser.
