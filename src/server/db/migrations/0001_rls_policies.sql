-- Row Level Security for the core SaaS tables. See docs/decisiones.md ADR-003: the JWT carries
-- `tenant_id` and `role` inside `app_metadata`, set server-side (service_role) when a membership
-- is created (T0.4). `app_metadata` is not user-editable and is present on every JWT Supabase
-- issues, so no Custom Access Token Hook is needed.

-- Helpers -------------------------------------------------------------------------------------

create function public.current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid
$$;

create function public.current_member_role()
returns text
language sql
stable
as $$
  select auth.jwt() -> 'app_metadata' ->> 'role'
$$;

-- Enable RLS ------------------------------------------------------------------------------------
-- Intentionally NOT `force row level security`: the service_role (used by server-side flows such
-- as tenant/user provisioning in T0.4, and by the seed script) must keep bypassing RLS.

alter table "plans" enable row level security;
alter table "tenants" enable row level security;
alter table "memberships" enable row level security;
alter table "audit_log" enable row level security;

-- plans: public read-only catalog (prices are public), no client writes -------------------------

create policy "plans_select_all" on "plans"
  for select
  to anon, authenticated
  using (true);

-- tenants: a member sees/updates only their own tenant; admins only for updates ------------------

create policy "tenants_select_own" on "tenants"
  for select
  to authenticated
  using (id = public.current_tenant_id());

create policy "tenants_update_own_admin" on "tenants"
  for update
  to authenticated
  using (id = public.current_tenant_id() and public.current_member_role() = 'admin')
  with check (id = public.current_tenant_id() and public.current_member_role() = 'admin');

-- memberships: read-only for clients, scoped to their own tenant --------------------------------

create policy "memberships_select_own_tenant" on "memberships"
  for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

-- audit_log: admins read their tenant's log; any member can append to their own tenant's log -----

create policy "audit_log_select_own_tenant_admin" on "audit_log"
  for select
  to authenticated
  using (tenant_id = public.current_tenant_id() and public.current_member_role() = 'admin');

create policy "audit_log_insert_own_tenant" on "audit_log"
  for insert
  to authenticated
  with check (tenant_id = public.current_tenant_id());
