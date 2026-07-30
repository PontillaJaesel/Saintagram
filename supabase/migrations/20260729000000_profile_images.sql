-- Saintagram stores profile images in a private bucket. Firebase Authentication
-- supplies the JWT, and its text `sub` claim is the owner UID.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profile-images',
  'profile-images',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile-images owner select" on storage.objects;
drop policy if exists "profile-images owner insert" on storage.objects;
drop policy if exists "profile-images owner delete" on storage.objects;
drop policy if exists "profile-images restrictive boundary" on storage.objects;
drop policy if exists "profile-images deny update" on storage.objects;

-- Restrictive policies prevent a different permissive policy on storage.objects
-- from accidentally widening this bucket. Other buckets are unaffected.
create policy "profile-images restrictive boundary"
on storage.objects
as restrictive
for all
to public
using (
  bucket_id <> 'profile-images'
  or (
    nullif((select auth.jwt()->>'sub'), '') is not null
    and (select auth.jwt()->>'iss') = concat(
      'https://securetoken.google.com/',
      (select auth.jwt()->>'aud')
    )
    and cardinality(storage.foldername(name)) = 3
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.jwt()->>'sub')
    and (storage.foldername(name))[3] = 'profile'
    and name ~ '^users/[A-Za-z0-9_-]{1,128}/profile/[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[1-5][0-9A-Fa-f]{3}-[89AaBb][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}[.](jpg|png|webp)$'
    and owner_id = (select auth.jwt()->>'sub')
  )
)
with check (
  bucket_id <> 'profile-images'
  or (
    nullif((select auth.jwt()->>'sub'), '') is not null
    and (select auth.jwt()->>'iss') = concat(
      'https://securetoken.google.com/',
      (select auth.jwt()->>'aud')
    )
    and cardinality(storage.foldername(name)) = 3
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.jwt()->>'sub')
    and (storage.foldername(name))[3] = 'profile'
    and name ~ '^users/[A-Za-z0-9_-]{1,128}/profile/[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[1-5][0-9A-Fa-f]{3}-[89AaBb][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}[.](jpg|png|webp)$'
    and owner_id = (select auth.jwt()->>'sub')
  )
);

create policy "profile-images deny update"
on storage.objects
as restrictive
for update
to public
using (bucket_id <> 'profile-images')
with check (bucket_id <> 'profile-images');

create policy "profile-images owner select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'profile-images'
  and nullif((select auth.jwt()->>'sub'), '') is not null
  and (select auth.jwt()->>'iss') = concat(
    'https://securetoken.google.com/',
    (select auth.jwt()->>'aud')
  )
  and cardinality(storage.foldername(name)) = 3
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = (select auth.jwt()->>'sub')
  and (storage.foldername(name))[3] = 'profile'
  and name ~ '^users/[A-Za-z0-9_-]{1,128}/profile/[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[1-5][0-9A-Fa-f]{3}-[89AaBb][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}[.](jpg|png|webp)$'
  and owner_id = (select auth.jwt()->>'sub')
);

create policy "profile-images owner insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-images'
  and nullif((select auth.jwt()->>'sub'), '') is not null
  and (select auth.jwt()->>'iss') = concat(
    'https://securetoken.google.com/',
    (select auth.jwt()->>'aud')
  )
  and cardinality(storage.foldername(name)) = 3
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = (select auth.jwt()->>'sub')
  and (storage.foldername(name))[3] = 'profile'
  and name ~ '^users/[A-Za-z0-9_-]{1,128}/profile/[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[1-5][0-9A-Fa-f]{3}-[89AaBb][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}[.](jpg|png|webp)$'
  and owner_id = (select auth.jwt()->>'sub')
);

create policy "profile-images owner delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-images'
  and nullif((select auth.jwt()->>'sub'), '') is not null
  and (select auth.jwt()->>'iss') = concat(
    'https://securetoken.google.com/',
    (select auth.jwt()->>'aud')
  )
  and cardinality(storage.foldername(name)) = 3
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = (select auth.jwt()->>'sub')
  and (storage.foldername(name))[3] = 'profile'
  and name ~ '^users/[A-Za-z0-9_-]{1,128}/profile/[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[1-5][0-9A-Fa-f]{3}-[89AaBb][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}[.](jpg|png|webp)$'
  and owner_id = (select auth.jwt()->>'sub')
);
