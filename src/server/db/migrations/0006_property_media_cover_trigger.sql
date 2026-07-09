-- Enforces "at most one cover photo per property" on `property_media` (T1.6 spec: "si
-- es_portada=true, poner todas las demás de la propiedad en false"). Implemented as an AFTER
-- trigger rather than a partial unique index because the requirement is auto-demotion of the
-- previous cover, not merely rejecting a second one.
--
-- Deliberately security-invoker (the default — no `security definer`): the demotion UPDATE only
-- ever touches rows sharing `new.property_id`, which by construction already belong to
-- `new.tenant_id`, so the caller's own `property_media_update_own_tenant` RLS policy (0005) covers
-- it without needing to bypass RLS.

create function public.property_media_enforce_single_cover()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update property_media
  set is_cover = false
  where property_id = new.property_id
    and id <> new.id
    and is_cover = true;

  return new;
end;
$$;

create trigger property_media_single_cover
after insert or update of is_cover on property_media
for each row
when (new.is_cover = true)
execute function public.property_media_enforce_single_cover();
