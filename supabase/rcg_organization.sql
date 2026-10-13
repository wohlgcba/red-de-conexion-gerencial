-- Apply on BASE GCBA only with explicit approval to connect the Organigrama.
-- No existing directory, Dotación or Hub records are changed or imported.
begin;
create schema if not exists rcg_private;
revoke all on schema rcg_private from public, anon, authenticated, service_role;
alter default privileges in schema rcg_private revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema rcg_private revoke execute on functions from public, anon, authenticated, service_role;

create or replace function rcg_private.valid_link_key(value text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare total integer := 0; weights integer[] := array[5,4,3,2,7,6,5,4,3,2]; digit integer;
begin
  if value is null or value !~ '^[0-9]{11}$' then return false; end if;
  for i in 1..10 loop total := total + substring(value from i for 1)::integer * weights[i]; end loop;
  digit := 11 - total % 11;
  if digit = 11 then digit := 0; elsif digit = 10 then digit := 9; end if;
  return digit = substring(value from 11 for 1)::integer;
end; $$;
revoke all on function rcg_private.valid_link_key(text) from public, anon, authenticated, service_role;

create table if not exists red_conexion_gerencial.organization_units (
  id uuid primary key,
  parent_id uuid references red_conexion_gerencial.organization_units(id) on delete restrict deferrable initially deferred,
  name text not null check (length(trim(name)) > 0),
  unit_type text not null check (length(trim(unit_type)) > 0),
  source_key text not null unique, -- full contextual path; never just a unit name
  code text,
  directorate_id uuid references red_conexion_gerencial.directorates(id) on delete set null,
  check (parent_id is distinct from id)
);
create index if not exists organization_parent_idx on red_conexion_gerencial.organization_units(parent_id);
alter table red_conexion_gerencial.organization_units enable row level security;
-- Read ONLY through the minimal authenticated RPC, not unrestricted table access.
revoke all on red_conexion_gerencial.organization_units from public, anon, authenticated, service_role;

create table if not exists rcg_private.directory_link_keys (
  person_id uuid primary key references red_conexion_gerencial.people(id) on delete cascade,
  link_key text not null unique check (rcg_private.valid_link_key(link_key)),
  verified_at timestamptz not null,
  verification_basis text not null check (length(trim(verification_basis)) > 0)
);
create table if not exists rcg_private.organization_people (
  id uuid primary key,
  link_key text not null unique check (rcg_private.valid_link_key(link_key)),
  institutional_name text not null check (length(trim(institutional_name)) > 0),
  reconciliation_status text not null default 'pending' check (reconciliation_status in ('pending','member','non_member')),
  person_id uuid references red_conexion_gerencial.people(id) on delete set null,
  verified_at timestamptz,
  verification_basis text,
  check (reconciliation_status = 'pending' or (verified_at is not null and coalesce(length(trim(verification_basis)), 0) > 0)),
  check (reconciliation_status <> 'member' or person_id is not null),
  check (reconciliation_status <> 'non_member' or person_id is null)
);
create table if not exists rcg_private.organization_assignments (
  id uuid primary key,
  unit_id uuid not null references red_conexion_gerencial.organization_units(id) on delete cascade,
  responsible_id uuid not null references rcg_private.organization_people(id) on delete cascade,
  position_title text not null check (length(trim(position_title)) > 0),
  responsibility_confirmed boolean not null default false,
  verification_basis text,
  check (not responsibility_confirmed or coalesce(length(trim(verification_basis)), 0) > 0),
  unique(unit_id, responsible_id, position_title)
);
create index if not exists organization_assignments_unit_idx on rcg_private.organization_assignments(unit_id);
alter table rcg_private.directory_link_keys enable row level security;
alter table rcg_private.organization_people enable row level security;
alter table rcg_private.organization_assignments enable row level security;
revoke all on all tables in schema rcg_private from public, anon, authenticated, service_role;

create or replace function rcg_private.guard_organization_parent()
returns trigger language plpgsql set search_path = '' as $$
declare invalid boolean;
begin
  -- Serialize hierarchy mutations to prevent concurrent reparenting cycles.
  perform pg_catalog.pg_advisory_xact_lock(771245903);
  with recursive ancestors as (
    select u.id, u.parent_id, array[u.id] as visited, 1 as depth
    from red_conexion_gerencial.organization_units u where u.id = new.parent_id
    union all
    select p.id, p.parent_id, a.visited || p.id, a.depth + 1
    from red_conexion_gerencial.organization_units p join ancestors a on p.id = a.parent_id
    where not p.id = any(a.visited) and a.depth < 60
  ) select coalesce(bool_or(id = new.id or (depth >= 60 and parent_id is not null)), false) into invalid from ancestors;
  if invalid then raise exception 'Dependencia circular o profundidad excesiva.'; end if;
  return new;
end; $$;
revoke all on function rcg_private.guard_organization_parent() from public, anon, authenticated, service_role;
drop trigger if exists organization_parent_guard on red_conexion_gerencial.organization_units;
-- Deferred checking also validates bulk imports ordered child-before-parent.
create constraint trigger organization_parent_guard after insert or update on red_conexion_gerencial.organization_units
deferrable initially deferred for each row execute function rcg_private.guard_organization_parent();

create or replace function red_conexion_gerencial.get_organization_chart()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not coalesce(red_conexion_gerencial.is_member(), false) then
    raise exception 'Acceso no autorizado.' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'units', coalesce((select jsonb_agg(jsonb_build_object('id',u.id, 'parentId',u.parent_id,
      'name',u.name, 'type',u.unit_type, 'code',u.code, 'directorateId',u.directorate_id,
      'responsibilityPending',exists(select 1 from rcg_private.organization_assignments pending where pending.unit_id=u.id and not pending.responsibility_confirmed)) order by u.name,u.id)
      from red_conexion_gerencial.organization_units u), '[]'::jsonb),
    'responsibilities', coalesce((select jsonb_agg(jsonb_build_object(
      'id',a.id, 'unitId',a.unit_id, 'responsibleId',o.id,
      'name', case when o.reconciliation_status='member' and p.is_active and k.person_id is not null then trim(p.given_name || ' ' || p.family_name) else o.institutional_name end,
      'role',a.position_title,
      'membership', case when o.reconciliation_status = 'member' and p.is_active and k.person_id is not null then 'member'
        when o.reconciliation_status = 'non_member' and o.verified_at is not null and k.person_id is null then 'non_member'
        else 'pending' end,
      'personId', case when o.reconciliation_status = 'member' and p.is_active and k.person_id is not null then p.id else null end)
      order by a.unit_id,o.institutional_name,a.id)
      from rcg_private.organization_assignments a join rcg_private.organization_people o on o.id = a.responsible_id
      left join rcg_private.directory_link_keys k on k.link_key = o.link_key
      left join red_conexion_gerencial.people p on p.id = k.person_id and p.id = o.person_id
      where a.responsibility_confirmed), '[]'::jsonb)
  ) into result;
  return result;
end; $$;
revoke all on function red_conexion_gerencial.get_organization_chart() from public, anon, service_role;
grant execute on function red_conexion_gerencial.get_organization_chart() to authenticated;
notify pgrst, 'reload schema';
commit;
