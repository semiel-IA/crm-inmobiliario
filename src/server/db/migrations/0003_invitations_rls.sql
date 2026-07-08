-- Row Level Security for `invitations` (T0.4). Only tenant admins may see/manage invitations for
-- their own tenant — including agents/assistants of that same tenant, who are not admins and must
-- not see pending invitations. See ADR-003 for how `current_tenant_id()`/`current_member_role()`
-- read the JWT `app_metadata`.
--
-- Acceptance (`acceptInvitation`) runs server-side with `service_role`, which bypasses RLS
-- entirely — the invitee has no session yet, so no policy is needed (or possible) for `anon`.

alter table "invitations" enable row level security;

create policy "invitations_select_own_tenant_admin" on "invitations"
  for select
  to authenticated
  using (tenant_id = public.current_tenant_id() and public.current_member_role() = 'admin');

create policy "invitations_insert_own_tenant_admin" on "invitations"
  for insert
  to authenticated
  with check (tenant_id = public.current_tenant_id() and public.current_member_role() = 'admin');

create policy "invitations_update_own_tenant_admin" on "invitations"
  for update
  to authenticated
  using (tenant_id = public.current_tenant_id() and public.current_member_role() = 'admin')
  with check (tenant_id = public.current_tenant_id() and public.current_member_role() = 'admin');

create policy "invitations_delete_own_tenant_admin" on "invitations"
  for delete
  to authenticated
  using (tenant_id = public.current_tenant_id() and public.current_member_role() = 'admin');
