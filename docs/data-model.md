# Saintagram data model and privacy boundaries

Saintagram uses Firebase Authentication and the Firebase Realtime Database.
Every cloud record is private to its authenticated owner.

## Realtime Database paths

- `users/{uid}` stores private account and routing metadata.
- `profiles/{uid}` stores the normal profile projection and must never contain
  `hiddenStory`.
- `privateProfiles/{uid}` stores the separated Hidden Story.
- `drafts/{uid}` stores unfinished profile-builder progress.
- `reflectionPosts/{uid}/{reflectionId}` stores the owner's reflections.
  `isPrivate` controls presentation; all reflections remain owner-only.

IDs must match their path keys. The rules reject anonymous access, cross-user
access, unknown root paths, and Hidden Story fields in normal profiles.

## Profile images

Profile images stay in the current browser's local storage. They are not sent
to Realtime Database or Cloud Storage, keeping the application compatible with
Firebase's no-cost Spark plan. An image therefore does not follow the user to
another browser or device. JPG, PNG, and WebP files are accepted up to 2 MiB.

## Security invariants

- Passwords and authentication secrets stay in Firebase Authentication.
- Cloud reads and writes require `auth.uid` to match the UID path segment.
- Hidden Stories exist only in `privateProfiles/{uid}` and owner-only drafts.
- User content is rendered as text rather than injected HTML.

## Deleting an account

The application reauthenticates the owner, atomically removes all Realtime
Database branches for that UID, removes the device-local image and draft cache,
and then deletes the Firebase Authentication account.
