-- Supabase Storage bucket for property photos/videos and private documents (T1.6).
--
-- Decision (see ADR-011 in docs/decisiones.md): ONE shared bucket `property-photos`, tenant-scoped
-- by path, rather than a bucket per tenant (`property-photos-{tenant_id}`). A bucket-per-tenant
-- would need to be provisioned at tenant-registration time (new moving part in T0.4/T1.x) and
-- Supabase free-tier projects have practical limits on bucket count; a single bucket with
-- `storage.objects` RLS policies keyed off the path prefix gives the same tenant isolation
-- guarantees without that extra provisioning step, and is the pattern Supabase's own docs
-- recommend for multi-tenant apps.
--
-- Path convention (enforced only by the app, mirrored by these policies via
-- `storage.foldername(name)`):
--   {tenant_id}/{property_id}/{filename}                -- photos/videos (property_media rows)
--   {tenant_id}/{property_id}/documents/{filename}       -- private documents (property_documents)
--
-- Bucket is created PRIVATE (`public = false`): even "public" listing photos are served through
-- the SELECT policy below (readable by `anon`/`authenticated` when the property is
-- `disponible`), not via the bucket's own public-CDN toggle, so the `documents/` subpath — which
-- must NEVER be public — can be denied to `anon` regardless of property status.

insert into storage.buckets (id, name, public)
values ('property-photos', 'property-photos', false)
on conflict (id) do nothing;

-- Narrow SECURITY DEFINER helper for the public-read policy below. It must run as the table
-- owner (bypassing `properties` RLS, which grants SELECT only `to authenticated`) because the
-- policy this backs also serves `anon` — an anon session cannot see ANY `properties` row through
-- RLS, so a plain subquery here would always evaluate to zero rows and the public listing page
-- (T1.10) could never actually load a photo. Kept intentionally tiny (one boolean fact, no data
-- returned) rather than granting `anon` a table-level SELECT policy on `properties`, which would
-- expose every column (including `private_address`, `registration_number`) directly over REST.
create function public.property_is_publicly_listed(p_tenant_id text, p_property_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.properties p
    where p.id::text = p_property_id
      and p.tenant_id::text = p_tenant_id
      and p.status = 'disponible'
  )
$$;

-- SELECT --------------------------------------------------------------------------------------
-- Photos/videos (not under `.../documents/`) of a property with status = 'disponible' are
-- readable by anyone (anon or authenticated) — this backs the public listing page (T1.10). Every
-- other case (reserved/sold/rented/inactive property, or anything under `documents/`) requires an
-- authenticated session scoped to the owning tenant.

create policy "property_photos_public_read_available" on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'property-photos'
    and (storage.foldername(name))[3] is distinct from 'documents'
    and public.property_is_publicly_listed(
      (storage.foldername(name))[1],
      (storage.foldername(name))[2]
    )
  );

create policy "property_photos_tenant_read" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

-- INSERT --------------------------------------------------------------------------------------
-- Only authenticated members of the owning tenant may upload, into their own tenant's path.

create policy "property_photos_tenant_insert" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

-- UPDATE (e.g. re-uploading/replacing a file at the same path) -------------------------------------

create policy "property_photos_tenant_update" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  )
  with check (
    bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

-- DELETE --------------------------------------------------------------------------------------
-- Scoped to the owning tenant, same as the other write policies (there is no per-object "owner
-- user" tracked in Storage metadata to restrict this further to the uploading user).

create policy "property_photos_tenant_delete" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );
