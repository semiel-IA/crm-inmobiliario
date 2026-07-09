-- Row Level Security for `lead_preferences` (T1.1). Same pattern as `contacts`/`properties`
-- (0005, ADR-003/ADR-011): `public.current_tenant_id()` reads `tenant_id` from the JWT
-- `app_metadata`. Every authenticated member of the tenant may SELECT/INSERT/UPDATE/DELETE these
-- rows — no role restriction — per `docs/plan-fase-1-mvp.md` §T1.1 ("limitados a tenant_id =
-- auth.jwt() -> 'app_metadata' -> 'tenant_id'").

alter table "lead_preferences" enable row level security;

create policy "lead_preferences_select_own_tenant" on "lead_preferences"
  for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

create policy "lead_preferences_insert_own_tenant" on "lead_preferences"
  for insert
  to authenticated
  with check (tenant_id = public.current_tenant_id());

create policy "lead_preferences_update_own_tenant" on "lead_preferences"
  for update
  to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "lead_preferences_delete_own_tenant" on "lead_preferences"
  for delete
  to authenticated
  using (tenant_id = public.current_tenant_id());
