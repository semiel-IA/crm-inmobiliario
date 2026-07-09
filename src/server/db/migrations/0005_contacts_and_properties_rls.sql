-- Row Level Security for `contacts`, `properties`, `property_media` and `property_documents`
-- (T1.6; `contacts` created ahead of T1.1 — see ADR-011). Same pattern as the core tables
-- (ADR-003): `public.current_tenant_id()` reads `tenant_id` from the JWT `app_metadata`. Unlike
-- `invitations` (admin-only), every authenticated member of the tenant may
-- SELECT/INSERT/UPDATE/DELETE these rows, per `docs/plan-fase-1-mvp.md` §T1.1/§T1.6 ("limitados a
-- tenant_id = auth.jwt() -> 'app_metadata' -> 'tenant_id'", no role restriction).

alter table "contacts" enable row level security;
alter table "properties" enable row level security;
alter table "property_media" enable row level security;
alter table "property_documents" enable row level security;

-- contacts --------------------------------------------------------------------------------------

create policy "contacts_select_own_tenant" on "contacts"
  for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

create policy "contacts_insert_own_tenant" on "contacts"
  for insert
  to authenticated
  with check (tenant_id = public.current_tenant_id());

create policy "contacts_update_own_tenant" on "contacts"
  for update
  to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "contacts_delete_own_tenant" on "contacts"
  for delete
  to authenticated
  using (tenant_id = public.current_tenant_id());

-- properties --------------------------------------------------------------------------------------
-- Public (anon) read access for the public listing page (T1.10) is intentionally NOT granted here:
-- that page will read through a server-side route using `service_role` (filtering `status =
-- 'disponible'` in application code) rather than a tenant-wide RLS-anon feed. Only Storage objects
-- (below) grant `anon` access, scoped per-property via the path.

create policy "properties_select_own_tenant" on "properties"
  for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

create policy "properties_insert_own_tenant" on "properties"
  for insert
  to authenticated
  with check (tenant_id = public.current_tenant_id());

create policy "properties_update_own_tenant" on "properties"
  for update
  to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "properties_delete_own_tenant" on "properties"
  for delete
  to authenticated
  using (tenant_id = public.current_tenant_id());

-- property_media ----------------------------------------------------------------------------------

create policy "property_media_select_own_tenant" on "property_media"
  for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

create policy "property_media_insert_own_tenant" on "property_media"
  for insert
  to authenticated
  with check (tenant_id = public.current_tenant_id());

create policy "property_media_update_own_tenant" on "property_media"
  for update
  to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "property_media_delete_own_tenant" on "property_media"
  for delete
  to authenticated
  using (tenant_id = public.current_tenant_id());

-- property_documents ------------------------------------------------------------------------------

create policy "property_documents_select_own_tenant" on "property_documents"
  for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

create policy "property_documents_insert_own_tenant" on "property_documents"
  for insert
  to authenticated
  with check (tenant_id = public.current_tenant_id());

create policy "property_documents_update_own_tenant" on "property_documents"
  for update
  to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "property_documents_delete_own_tenant" on "property_documents"
  for delete
  to authenticated
  using (tenant_id = public.current_tenant_id());
