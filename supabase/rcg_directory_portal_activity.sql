-- Portal usage is independent of membership authorization and the previous directory.
-- Requires rcg_metrics.sql. Safe to reapply.
begin;
create table if not exists rcg_private.portal_entries (
  person_id uuid primary key references red_conexion_gerencial.people(id) on delete cascade,
  first_entered_at timestamptz not null default now()
);
alter table rcg_private.portal_entries enable row level security;
revoke all on rcg_private.portal_entries from public, anon, authenticated, service_role;
-- Only actual app events: exclude imported workbook history and shared Auth sign-ins.
insert into rcg_private.portal_entries(person_id, first_entered_at)
select person_id, min(first_at) from rcg_private.member_activity where source='app'
group by person_id on conflict do nothing;
create or replace function red_conexion_gerencial.record_activity(p_kind text, p_target uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); target uuid;
begin
  if actor is null then raise exception 'Acceso denegado' using errcode = '42501'; end if;
  if p_kind is null or p_kind not in ('visit','newsletters','newsletter','profile') or (p_kind in ('newsletter','profile')) <> (p_target is not null) then
    raise exception 'Actividad inválida' using errcode = '22023';
  end if;
  -- A first login still pending its password change counts as entering the Red.
  target := rcg_private.metrics_actor();
  if target is null then return; end if;
  if p_kind <> 'visit' and not red_conexion_gerencial.is_member() then raise exception 'Acceso denegado' using errcode = '42501'; end if;
  if p_kind = 'newsletter' and not exists(select 1 from red_conexion_gerencial.newsletters n where n.id = p_target and n.status = 'publicado') then return; end if;
  if p_kind = 'profile' and (p_target = target or not exists(select 1 from red_conexion_gerencial.people p where p.id = p_target and p.is_active)) then return; end if;
  insert into rcg_private.portal_entries(person_id) values (target) on conflict do nothing;
  insert into rcg_private.member_activity(user_id, person_id, activity_date, kind, newsletter_id, profile_id)
    values (actor, target, rcg_private.local_date(now()), p_kind,
      case when p_kind = 'newsletter' then p_target end, case when p_kind = 'profile' then p_target end)
    on conflict on constraint member_activity_day do update
      set hits = least(rcg_private.member_activity.hits + 1, 100000), last_at = now(), user_id = excluded.user_id;
end $$;


create or replace function red_conexion_gerencial.directory_portal_activity()
returns table(person_id uuid, has_entered_portal boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not red_conexion_gerencial.is_member() then
    raise exception 'Acceso denegado' using errcode='42501';
  end if;
  return query select p.id, exists(select 1 from rcg_private.portal_entries e where e.person_id=p.id)
    from red_conexion_gerencial.people p where p.is_active;
end $$;
revoke all on function red_conexion_gerencial.directory_portal_activity() from public, anon, authenticated, service_role;
grant execute on function red_conexion_gerencial.directory_portal_activity() to authenticated;
notify pgrst, 'reload schema';
commit;
