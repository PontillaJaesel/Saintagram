# Saintagram data model and privacy boundaries

Saintagram stores structured user-generated content in owner-only Firebase
resources and profile-image files in owner-only Firebase Storage. There are
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
| `imagePath` | string | Empty or the private Firebase Storage path `users/{uid}/profile/{uuid}.{jpg|png|webp}`. |
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

## Firebase Storage

Profile images are stored directly in Firebase Storage under:

```text
users/{firebaseUid}/profile/{uuid}.{jpg|png|webp}
```

The browser uses the signed-in Firebase user and Firebase Storage security
rules, so there is no separate access-claim route. Reads and deletes require
the authenticated UID to match the owner segment of the path, and uploads are
limited to 2 MiB JPEG/PNG/WebP files with a UUID filename.

Replacing a picture creates a new UUID object, commits its path to Firestore,
and then removes the old object. Firestore never stores image bytes, a public
URL, or a signed URL.

## Security invariants

- Authentication secrets stay in Firebase Authentication, never Firestore or
  browser storage.
- Every user-content write must carry the authenticated user's UID.
- Ownership fields, document IDs, and creation timestamps cannot be reassigned
  during updates.
- Unknown Firestore collections and Firebase Storage paths fail closed.
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
Firestore documents or Firebase Storage objects. The account-deletion workflow
first reauthenticates, removes every object in the owner's Storage prefix,
deletes reflection posts and the UID-keyed Firestore documents, and then
deletes the Authentication account. A failure stops the workflow before later
destructive steps so it can be retried.

For production, a privileged retryable backend should verify and repeat the
cascade. In particular, an already-issued Firebase ID token can remain valid
until expiry even after the Firebase user is deleted, so high-assurance
deletion should schedule a second Storage cleanup after the token window.
# Administrator and tracked-entry collections

Normal Firestore clients remain subject to the owner and social rules described below. Privileged administrator APIs verify a Firebase Authentication `admin: true` custom claim and use the Firebase Admin SDK; they can inspect account data, including sensitive `privateProfiles` and unfinished drafts, for administration. Admin access does not grant broader client-side Firestore permissions.

- `linkOpenEvents/{eventId}` is server-managed and records `source` (`qr` or `common`), optional validated `campaign`, server `openedAt`, nullable `userId`/`claimedAt`, approximate Cloudflare city/region/country, a location label/source, and a safe internal destination. It never intentionally stores raw IP addresses.
- `systemNotifications/{notificationId}` contains server-created `profile_reminder` messages. Recipients may read their own documents and update only `readAt`.
- `adminAuditLogs/{logId}` records protected actions (`profile_reminder_sent`, `user_data_viewed`, and `export_generated`), the admin UID, optional target UID, server time, and non-secret metadata.

## FiAt reflection fields and leaderboard privacy

`reflectionPosts` may optionally include `fiatCategory` and its stable local-calendar `fiatDateKey`. Valid categories are `prayer`, `forgiveness`, `service`, `sacrifice`, `act-of-love`, `responsible-choice`, and `other`. Existing reflections without these fields remain valid.

Personal FiAt streaks are derived from the owner's reflection records, including private records, with one streak day per distinct `fiatDateKey`. The authenticated `/api/fiat/leaderboard` endpoint derives numeric activity using Firebase Admin, caps credit at three entries per user per day, joins only public `socialProfiles`, and returns no reflection content or privacy metadata. Firestore client rules remain unchanged for cross-user reflection access; private reflections never become directly readable for leaderboard purposes.
