-- Supabase Third-Party Auth verifies the Firebase JWT before Storage RLS runs.
-- Bind access to that verified token's subject and exact private folder without
-- making additional assumptions about Firebase claim shape or Storage metadata.
drop policy if exists "profile-images restrictive boundary" on storage.objects;
drop policy if exists "profile-images owner select" on storage.objects;
drop policy if exists "profile-images owner insert" on storage.objects;
drop policy if exists "profile-images owner delete" on storage.objects;

create policy "profile-images restrictive boundary"
on storage.objects
as restrictive
for all
to public
using (
  bucket_id <> 'profile-images'
  or (
    nullif((select auth.jwt()->>'sub'), '') is not null
    and cardinality(storage.foldername(name)) = 3
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.jwt()->>'sub')
    and (storage.foldername(name))[3] = 'profile'
    and name ~ '^users/[A-Za-z0-9_-]{1,128}/profile/[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[1-5][0-9A-Fa-f]{3}-[89AaBb][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}[.](jpg|png|webp)$'
  )
)
with check (
  bucket_id <> 'profile-images'
  or (
    nullif((select auth.jwt()->>'sub'), '') is not null
    and cardinality(storage.foldername(name)) = 3
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.jwt()->>'sub')
    and (storage.foldername(name))[3] = 'profile'
    and name ~ '^users/[A-Za-z0-9_-]{1,128}/profile/[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[1-5][0-9A-Fa-f]{3}-[89AaBb][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}[.](jpg|png|webp)$'
  )
);

create policy "profile-images owner select"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'profile-images'
  and nullif((select auth.jwt()->>'sub'), '') is not null
  and cardinality(storage.foldername(name)) = 3
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = (select auth.jwt()->>'sub')
  and (storage.foldername(name))[3] = 'profile'
  and name ~ '^users/[A-Za-z0-9_-]{1,128}/profile/[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[1-5][0-9A-Fa-f]{3}-[89AaBb][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}[.](jpg|png|webp)$'
);

create policy "profile-images owner insert"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'profile-images'
  and nullif((select auth.jwt()->>'sub'), '') is not null
  and cardinality(storage.foldername(name)) = 3
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = (select auth.jwt()->>'sub')
  and (storage.foldername(name))[3] = 'profile'
  and name ~ '^users/[A-Za-z0-9_-]{1,128}/profile/[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[1-5][0-9A-Fa-f]{3}-[89AaBb][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}[.](jpg|png|webp)$'
);

create policy "profile-images owner delete"
on storage.objects
for delete
to anon, authenticated
using (
  bucket_id = 'profile-images'
  and nullif((select auth.jwt()->>'sub'), '') is not null
  and cardinality(storage.foldername(name)) = 3
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = (select auth.jwt()->>'sub')
  and (storage.foldername(name))[3] = 'profile'
  and name ~ '^users/[A-Za-z0-9_-]{1,128}/profile/[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[1-5][0-9A-Fa-f]{3}-[89AaBb][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}[.](jpg|png|webp)$'
);
