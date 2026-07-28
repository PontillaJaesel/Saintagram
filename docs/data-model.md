# Saintagram data model and privacy boundaries

Saintagram stores all user-generated content in owner-only Firebase resources.
There are no public collections, public profile projections, facilitator records,
groups, assignments, follower counts, rankings, or engagement metrics.

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
| `imageUrl` | string | Empty or the Firebase Storage download URL returned after upload. |
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

## Cloud Storage

Profile images use:

```text
users/{uid}/profile/{fileName}
```

Reads and writes require a matching authenticated UID. Uploads are limited to
2 MiB and the explicit MIME types JPEG, PNG, and WebP. The upload metadata
`ownerId` must also equal the authenticated UID, matching the client upload.
All other paths are denied.

## Security invariants

- Authentication secrets stay in Firebase Authentication, never Firestore or
  browser storage.
- Every user-content write must carry the authenticated user's UID.
- Ownership fields, document IDs, and creation timestamps cannot be reassigned
  during updates.
- Unknown Firestore collections and Storage paths fail closed.
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
Firestore documents or Storage objects. The account-deletion workflow should
first confirm the action, delete the owner's profile image(s), reflection posts,
draft, public profile, private profile, and user document, and then delete the
Authentication account.
For production, a privileged backend or Firebase Extension should perform this
cascade atomically/reliably; admin credentials must never be bundled into the
client.
