-- Limited managerial snapshot; not a copy of the employee roster.
begin;
create table if not exists rcg_private.gerencial_snapshot (
  singleton boolean primary key default true check(singleton),
  synced_at timestamptz not null, started_at timestamptz not null,
  coverage text[] not null, warnings jsonb not null default '[]'
);
create table if not exists rcg_private.gerencial_snapshot_people (
  identifier text primary key check(rcg_private.valid_link_key(identifier)),
  assignments jsonb not null check(jsonb_typeof(assignments)='array' and jsonb_array_length(assignments) between 1 and 50),
  contacts jsonb not null check(jsonb_typeof(contacts)='array' and jsonb_array_length(contacts)<=50)
);
alter table rcg_private.gerencial_snapshot enable row level security;
alter table rcg_private.gerencial_snapshot_people enable row level security;
revoke all on rcg_private.gerencial_snapshot,rcg_private.gerencial_snapshot_people from public,anon,authenticated,service_role;

create or replace function rcg_private.require_snapshot_admin(p_admin uuid) returns void
language plpgsql stable security definer set search_path='' as $$
begin
  if exists(select 1 from rcg_private.admin_access_states where user_id=p_admin and state<>'approved') or not exists(select 1 from red_conexion_gerencial.admin_users a join auth.users u on u.id=a.user_id
    where a.user_id=p_admin and a.is_active and u.email_confirmed_at is not null and lower(trim(a.email))=lower(trim(u.email))) then
    raise exception 'Acceso administrativo requerido' using errcode='42501';
  end if;
end $$;
revoke all on function rcg_private.require_snapshot_admin(uuid) from public,anon,authenticated,service_role;

-- Use the saved evidence for administrative review too. Unknown/new non-managers
-- remain pending: a manager-only snapshot cannot prove absence for arbitrary keys.
create or replace function rcg_private.admin_evidence(p_key text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s rcg_private.gerencial_snapshot; roles jsonb; units text; ministry text; manager boolean;
begin
  if not coalesce(rcg_private.valid_link_key(p_key),false) then return jsonb_build_object('evidence','pending','eligibility','unknown','roles','[]'::jsonb); end if;
  select * into s from rcg_private.gerencial_snapshot where singleton;
  if found then
    select jsonb_agg(distinct r->>'role'),string_agg(distinct r->>'unit',' · '),string_agg(distinct r->>'ministry',' · '),bool_or(rcg_private.admin_is_manager(r->>'role'))
      into roles,units,ministry,manager from rcg_private.gerencial_snapshot_people p,jsonb_array_elements(p.assignments) r where p.identifier=p_key;
    return jsonb_build_object('evidence',case when roles is not null then 'found' when p_key=any(s.coverage) then 'missing' else 'pending' end,
      'eligibility',case when manager then 'manager' when roles is not null then 'other' else 'unknown' end,
      'roles',coalesce(roles,'[]'),'unit',units,'ministry',ministry,'source','Padrón gerencial guardado · lectura de Dotación', 'sourceDate',s.synced_at);
  end if;
  select jsonb_agg(distinct a.position_title),string_agg(distinct u.name,' · '),bool_or(rcg_private.admin_is_manager(a.position_title))
    into roles,units,manager from rcg_private.organization_people o join rcg_private.organization_assignments a on a.responsible_id=o.id and a.responsibility_confirmed
    join red_conexion_gerencial.organization_units u on u.id=a.unit_id where o.link_key=p_key;
  return jsonb_build_object('evidence',case when roles is not null then 'found' else 'pending' end,
    'eligibility',case when manager then 'manager' when roles is not null then 'other' else 'unknown' end,
    'roles',coalesce(roles,'[]'),'unit',units,'source','Cruces verificados del Organigrama (fuente parcial)','sourceDate',null);
end $$;
revoke all on function rcg_private.admin_evidence(text) from public,anon,authenticated,service_role;

create or replace function red_conexion_gerencial.server_replace_gerencial_snapshot(
  p_admin uuid,p_people jsonb,p_coverage text[],p_warnings jsonb,p_started_at timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare person jsonb; item jsonb; actual_keys text[]; given_keys text[];
begin
  perform rcg_private.require_snapshot_admin(p_admin);
  perform pg_advisory_xact_lock(hashtext('rcg_gerencial_snapshot'));
  if p_started_at is null or p_started_at>clock_timestamp()+interval '1 minute' or exists(select 1 from rcg_private.gerencial_snapshot where started_at>p_started_at) then
    raise exception 'Actualización desactualizada' using errcode='40001';
  end if;
  if jsonb_typeof(p_people) is distinct from 'array' or jsonb_array_length(p_people) not between 1 and 5000
    or cardinality(p_coverage)>5000 or p_coverage is null or jsonb_typeof(p_warnings) is distinct from 'array' or jsonb_array_length(p_warnings)>20 then
    raise exception 'Padrón fuera de alcance' using errcode='22023';
  end if;
  select coalesce(array_agg(distinct k.link_key order by k.link_key),'{}') into actual_keys
    from rcg_private.directory_link_keys k join red_conexion_gerencial.people p on p.id=k.person_id where rcg_private.valid_link_key(k.link_key);
  select coalesce(array_agg(distinct x order by x),'{}') into given_keys from unnest(p_coverage) x;
  if actual_keys is distinct from given_keys then raise exception 'El Directorio cambió; repetir actualización' using errcode='40001'; end if;
  -- Every imported person must be a manager OR a checked existing Directory identity.
  -- Truncation, bulk non-manager imports and arbitrary personal fields are rejected.
  for person in select value from jsonb_array_elements(p_people) loop
    if not coalesce(rcg_private.valid_link_key(person->>'identifier'),false)
      or jsonb_typeof(person->'rows') is distinct from 'array' or jsonb_array_length(person->'rows') not between 1 and 50
      or jsonb_typeof(person->'contacts') is distinct from 'array' or jsonb_array_length(person->'contacts')>50
      or (person - array['identifier','rows','contacts'])<>'{}'::jsonb then raise exception 'Registro inválido' using errcode='22023'; end if;
    for item in select value from jsonb_array_elements(person->'rows') loop
      if (item - array['identifier','name','role','ministry','unit','path'])<>'{}'::jsonb or item->>'identifier' is distinct from person->>'identifier'
        or length(item::text)>4000 or item->>'name' is null or item->>'role' is null
        or (not ((person->>'identifier')=any(given_keys)) and upper(trim(item->>'role')) !~ '^(SUB)?GERENT[EA]([[:space:]]|$)') then
        raise exception 'Asignación fuera de alcance' using errcode='22023';
      end if;
    end loop;
    for item in select value from jsonb_array_elements(person->'contacts') loop
      if (item-array['kind','label','value','sourceField'])<>'{}'::jsonb or length(item->>'value') not between 1 and 254
        or item->>'sourceField' not in ('MAIL_LABORAL','MAIL_MIA','MAIL_PERSONAL','TELEFONO_LABORAL','TEL_LABORAL','TELEFONO','CELULAR')
        or item->>'kind' not in ('email','phone') or item->>'value' is null then raise exception 'Contacto inválido' using errcode='22023'; end if;
    end loop;
  end loop;
  if not exists(select 1 from jsonb_array_elements(p_people) p,jsonb_array_elements(p->'rows') r where upper(trim(r->>'role')) ~ '^(SUB)?GERENT[EA]([[:space:]]|$)') then
    raise exception 'Fuente gerencial incompleta' using errcode='22023';
  end if;
  delete from rcg_private.gerencial_snapshot_people where identifier is not null;
  insert into rcg_private.gerencial_snapshot_people(identifier,assignments,contacts)
    select p->>'identifier',p->'rows',p->'contacts' from jsonb_array_elements(p_people) p;
  insert into rcg_private.gerencial_snapshot(singleton,synced_at,started_at,coverage,warnings) values(true,clock_timestamp(),p_started_at,given_keys,p_warnings)
    on conflict(singleton) do update set synced_at=excluded.synced_at,started_at=excluded.started_at,coverage=excluded.coverage,warnings=excluded.warnings;
end $$;

create or replace function red_conexion_gerencial.server_gerencial_snapshot(p_admin uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform rcg_private.require_snapshot_admin(p_admin);
  return (select jsonb_build_object('syncedAt',s.synced_at,'coverage',s.coverage,'warnings',s.warnings,
    'rows',coalesce((select jsonb_agg(r) from rcg_private.gerencial_snapshot_people p,jsonb_array_elements(p.assignments) r),'[]'))
    from rcg_private.gerencial_snapshot s where singleton);
end $$;

create or replace function red_conexion_gerencial.server_gerencial_contacts(p_admin uuid,p_key text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform rcg_private.require_snapshot_admin(p_admin);
  if exists(select 1 from rcg_private.directory_link_keys where link_key=p_key) then raise exception 'Ya pertenece al Directorio' using errcode='42501'; end if;
  return coalesce((select p.contacts from rcg_private.gerencial_snapshot_people p where p.identifier=p_key
    and exists(select 1 from jsonb_array_elements(p.assignments) r where upper(trim(r->>'role')) ~ '^(SUB)?GERENT[EA]([[:space:]]|$)')),'[]');
end $$;

create or replace function red_conexion_gerencial.server_gerencial_intake(p_user uuid,p_key text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare mail text;
begin
  select lower(trim(email)) into mail from auth.users where id=p_user and email_confirmed_at is not null;
  if mail is null then raise exception 'Correo verificado requerido' using errcode='42501'; end if;
  -- A verified unrelated mailbox must not allow enumerating workers by identifier.
  return coalesce((select p.assignments from rcg_private.gerencial_snapshot_people p where p.identifier=p_key
    and exists(select 1 from jsonb_array_elements(p.contacts) c where c->>'kind'='email' and lower(c->>'value')=mail)),'[]');
end $$;
revoke all on function red_conexion_gerencial.server_replace_gerencial_snapshot(uuid,jsonb,text[],jsonb,timestamptz),
  red_conexion_gerencial.server_gerencial_snapshot(uuid),red_conexion_gerencial.server_gerencial_contacts(uuid,text),
  red_conexion_gerencial.server_gerencial_intake(uuid,text) from public,anon,authenticated;
grant execute on function red_conexion_gerencial.server_replace_gerencial_snapshot(uuid,jsonb,text[],jsonb,timestamptz),
  red_conexion_gerencial.server_gerencial_snapshot(uuid),red_conexion_gerencial.server_gerencial_contacts(uuid,text),
  red_conexion_gerencial.server_gerencial_intake(uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
