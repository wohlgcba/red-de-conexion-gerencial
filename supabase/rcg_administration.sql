-- LOCAL migration; requires rcg_crud.sql, rcg_user_accounts.sql and rcg_organization.sql.
-- Enables administration, transactional decisions and auditing.
-- No import, account provisioning, remote execution, or existing-data backfill.
begin;

create table if not exists rcg_private.admin_access_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state text not null check (state in ('pending','approved','rejected','suspended')),
  updated_at timestamptz not null default now()
);
create table if not exists rcg_private.admin_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('access','change')),
  user_id uuid not null references auth.users(id) on delete restrict,
  person_id uuid references red_conexion_gerencial.people(id) on delete restrict,
  given_name text not null, family_name text not null, email text not null,
  link_key text, role text not null default '', ministry text not null default '',
  secretariat text not null default '', directorate text not null default '',
  field text check (field in ('position_title','ministry','secretariat','directorate','email')),
  old_value text, new_value text, person_version integer,
  reason text not null default '', status text not null default 'pending'
    check (status in ('pending','reviewing','approved','rejected','information')),
  version integer not null default 1, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), reviewed_by uuid references auth.users(id) on delete set null,
  note text not null default '', validation_snapshot jsonb,
  exception_active boolean not null default false, exception_reason text,
  exception_justification text, exception_approved_at timestamptz, exception_revoked_at timestamptz,
  check ((kind='access' and field is null) or (kind='change' and person_id is not null and field is not null and new_value is not null))
);
alter table rcg_private.admin_requests add column if not exists secretariat text not null default '';
alter table rcg_private.admin_requests add column if not exists directorate text not null default '';
create unique index if not exists admin_one_open_access on rcg_private.admin_requests(user_id)
  where kind='access' and status in ('pending','reviewing','information');
create index if not exists admin_requests_queue on rcg_private.admin_requests(kind,status,created_at desc);
create index if not exists admin_requests_person on rcg_private.admin_requests(person_id);
create index if not exists admin_requests_key on rcg_private.admin_requests(link_key);
create index if not exists people_admin_email_lookup on red_conexion_gerencial.people(lower(trim(email)));
create table if not exists rcg_private.admin_audit (
  id uuid primary key default gen_random_uuid(), request_id uuid references rcg_private.admin_requests(id) on delete restrict,
  person_id uuid, action text not null, actor_id uuid references auth.users(id) on delete set null,
  actor_label text not null, occurred_at timestamptz not null default now(), reason text not null default '',
  before_value jsonb not null default '{}', after_value jsonb not null default '{}', result text not null default 'success'
);
create index if not exists admin_audit_entity on rcg_private.admin_audit(request_id,occurred_at);
create table if not exists rcg_private.admin_quality_reviews (
  person_id uuid primary key references red_conexion_gerencial.people(id) on delete cascade,
  reviewed_at timestamptz not null default now(), person_version integer not null, validation jsonb not null
);
do $$ declare t text; begin
  foreach t in array array['admin_access_states','admin_requests','admin_audit','admin_quality_reviews'] loop
    execute format('alter table rcg_private.%I enable row level security',t);
    execute format('revoke all on rcg_private.%I from public,anon,authenticated,service_role',t);
  end loop;
end $$;

create or replace function rcg_private.admin_assert()
returns void language plpgsql stable security definer set search_path='' as $$ begin
  if auth.uid() is null or not coalesce(red_conexion_gerencial.is_admin(),false) or exists(select 1 from rcg_private.admin_access_states where user_id=auth.uid() and state<>'approved') then
    raise exception 'Acceso administrativo denegado' using errcode='42501';
  end if;
end $$;
create or replace function rcg_private.admin_norm(value text)
returns text language sql immutable set search_path='' as $$
  select translate(lower(coalesce(value,'')),'áéíóúüñ','aeiouun');
$$;
create or replace function rcg_private.admin_is_manager(value text)
returns boolean language sql immutable set search_path='' as $$
  select rcg_private.admin_norm(trim(value)) ~ '^(subgerent[ea]|gerent[ea])([[:space:]]|$)';
$$;

create or replace function rcg_private.admin_evidence(p_key text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare roles text[]; units text[]; manager boolean; n integer; detected_at timestamptz;
begin
  if not rcg_private.valid_link_key(p_key) then
    return jsonb_build_object('evidence','pending','eligibility','unknown','roles','[]'::jsonb);
  end if;
  -- Existing Organigrama evidence is a partial set of confirmed responsibility assignments.
  -- Absence here NEVER proves absence from the complete Dotación.
  select count(*),array_agg(distinct a.position_title),array_agg(distinct u.name),bool_or(rcg_private.admin_is_manager(a.position_title)),max(o.verified_at)
    into n,roles,units,manager,detected_at from rcg_private.organization_people o
    join rcg_private.organization_assignments a on a.responsible_id=o.id and a.responsibility_confirmed
    join red_conexion_gerencial.organization_units u on u.id=a.unit_id where o.link_key=p_key;
  return jsonb_build_object('evidence',case when n>0 then 'found' else 'pending' end,
    'eligibility',case when manager then 'manager' when n>0 then 'other' else 'unknown' end,
    'roles',coalesce(to_jsonb(roles),'[]'),'unit',array_to_string(units,' · '),
    'source','Cruces verificados del Organigrama (fuente parcial)','sourceDate',null,'detectedAt',detected_at);
end $$;

create or replace function rcg_private.admin_validation(p_key text,p_email text,p_person uuid,p_user uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare e jsonb:=rcg_private.admin_evidence(p_key); de integer; dk integer; conflict boolean; linked boolean; reasons text[]:='{}';
begin
  select count(*) into de from red_conexion_gerencial.people p where lower(trim(p.email))=lower(trim(p_email)) and p.id is distinct from p_person;
  select count(*) into dk from rcg_private.directory_link_keys k where k.link_key=p_key and k.person_id is distinct from p_person;
  select exists(select 1 from red_conexion_gerencial.member_accounts a where
    (a.person_id=p_person and a.auth_user_id is distinct from p_user) or (a.auth_user_id=p_user and a.person_id is distinct from p_person)) into conflict;
  if p_user is not null and not exists(select 1 from red_conexion_gerencial.member_accounts where person_id=p_person and auth_user_id=p_user) then
    conflict:=conflict or not exists(select 1 from auth.users u where u.id=p_user and lower(trim(u.email))=lower(trim(p_email)) and u.email_confirmed_at is not null);
  end if;
  select exists(select 1 from red_conexion_gerencial.member_accounts a where a.auth_user_id=p_user and a.person_id=p_person) into linked;
  if not rcg_private.valid_link_key(p_key) then reasons:=array_append(reasons,'invalid_identifier'); end if;
  if de>0 then reasons:=array_append(reasons,'duplicate_email'); end if;
  if dk>0 then reasons:=array_append(reasons,'duplicate_identifier'); end if;
  if conflict then reasons:=array_append(reasons,'identity'); end if;
  if e->>'evidence'='missing' then reasons:=array_append(reasons,'missing'); end if;
  if e->>'evidence'='pending' then reasons:=array_append(reasons,'unverified'); end if;
  if e->>'evidence'='ambiguous' then reasons:=array_append(reasons,'ambiguous'); end if;
  if e->>'eligibility'='other' then reasons:=array_append(reasons,'non_manager'); end if;
  if p_person is not null and e->>'evidence'='found' and not exists(
    select 1 from jsonb_array_elements_text(e->'roles') x join red_conexion_gerencial.people p on p.id=p_person
    where rcg_private.admin_norm(x.value)=rcg_private.admin_norm(p.position_title)) then reasons:=array_append(reasons,'role_changed'); end if;
  return e || jsonb_build_object('validIdentifier',rcg_private.valid_link_key(p_key),
    'duplicateEmail',de,'duplicateIdentifier',dk,'authConflict',conflict,'alreadyLinked',linked,
    'reasons',to_jsonb(reasons),'risk',case when de+dk>0 or conflict then 'high' when cardinality(reasons)>0 then 'medium' else 'low' end,
    'ordinary',rcg_private.valid_link_key(p_key) and de+dk=0 and not conflict and e->>'evidence'='found' and e->>'eligibility'='manager');
end $$;

create or replace function rcg_private.admin_request_document(r rcg_private.admin_requests)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v jsonb:=rcg_private.admin_validation(r.link_key,r.email,r.person_id,r.user_id); actual text;
begin
  if r.kind='access' and v->>'evidence'='found' and not exists(
    select 1 from jsonb_array_elements_text(v->'roles') x where rcg_private.admin_norm(trim(x.value))=rcg_private.admin_norm(trim(r.role))) then
    v:=v || jsonb_build_object('reasons',(v->'reasons')||'"discrepancy"'::jsonb,'ordinary',false,'risk',case when v->>'risk'='high' then 'high' else 'medium' end);
  end if;
  if r.kind='change' and r.field<>'email' then
    if r.field='position_title' then
      select value into actual from jsonb_array_elements_text(v->'roles')
        where rcg_private.admin_norm(value)=rcg_private.admin_norm(r.new_value) limit 1;
    end if;
    if actual is null then
      v:=v || jsonb_build_object('reasons',(v->'reasons')||'"discrepancy"'::jsonb,'ordinary',false,'risk',case when v->>'risk'='high' then 'high' else 'medium' end);
    end if;
  end if;
  return jsonb_build_object('id',r.id,'kind',r.kind,'personId',r.person_id,'name',trim(r.given_name||' '||r.family_name),
    'email',r.email,'role',r.role,'ministry',r.ministry,'secretariat',r.secretariat,'directorate',r.directorate,'status',r.status,'version',r.version,'createdAt',r.created_at,
    'updatedAt',r.updated_at,'field',r.field,'oldValue',r.old_value,'newValue',r.new_value,'reason',r.reason,
    'reviewer',(select email from auth.users where id=r.reviewed_by),'exceptionActive',r.exception_active,
    'exceptionReason',r.exception_reason,'validation',v);
end $$;

create or replace function rcg_private.admin_matches(d jsonb,f jsonb)
returns boolean language sql stable set search_path='' as $$
  select (coalesce(f->>'query','')='' or strpos(rcg_private.admin_norm(concat_ws(' ',d->>'name',d->>'email',d->>'role',d->>'ministry',d->>'newValue',d->>'searchIdentifier')),rcg_private.admin_norm(trim(f->>'query')))>0
      or f->>'query' ~ '^[0-9[:space:]-]+$' and length(regexp_replace(f->>'query','[^0-9]','','g'))>0 and strpos(coalesce(d->>'searchIdentifier',''),regexp_replace(f->>'query','[^0-9]','','g'))>0)
    and (coalesce(f->>'status','')='' or d->>'status'=f->>'status' or f->>'status'='open' and d->>'status' in ('pending','reviewing','information'))
    and (coalesce(f->>'ministry','')='' or d->>'ministry'=f->>'ministry')
    and (coalesce(f->>'kind','')='' or d->>'kind'=f->>'kind')
    and (coalesce(f->>'field','')='' or d->>'field'=f->>'field')
    and (coalesce(f->>'evidence','')='' or d->'validation'->>'evidence'=f->>'evidence')
    and (coalesce(f->>'eligibility','')='' or d->'validation'->>'eligibility'=f->>'eligibility')
    and (coalesce(f->>'risk','')='' or d->'validation'->>'risk'=f->>'risk')
    and (coalesce(f->>'reason','')='' or d->'validation'->'reasons' ? (f->>'reason'))
    and (coalesce(f->>'duplicates','')='' or ((d->'validation'->>'duplicateEmail')::int+(d->'validation'->>'duplicateIdentifier')::int>0)=(f->>'duplicates'='yes'))
    and (coalesce(f->>'from','')='' or (d->>'createdAt')::date>=(f->>'from')::date)
    and (coalesce(f->>'to','')='' or (d->>'createdAt')::date<=(f->>'to')::date);
$$;

create or replace function red_conexion_gerencial.admin_list_requests(p_tray text default 'access',p_filters jsonb default '{}')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; lim integer:=least(50,greatest(1,coalesce((p_filters->>'pageSize')::int,10))); off integer:=greatest(0,coalesce((p_filters->>'page')::int,1)-1);
begin
  perform rcg_private.admin_assert();
  if p_tray not in ('access','change','exceptions','all') then raise exception 'Bandeja inválida' using errcode='22023'; end if;
  with base as materialized (select rcg_private.admin_request_document(r) as d,r.link_key as search_key from rcg_private.admin_requests r),
  selected as (select d from base where (p_tray='all' or d->>'kind'=p_tray or p_tray='exceptions' and (d->>'exceptionActive'='true' or jsonb_array_length(d->'validation'->'reasons')>0))
    and rcg_private.admin_matches(d||jsonb_build_object('searchIdentifier',search_key),p_filters)),
  paged as (select d from selected order by case when p_filters->>'sort'='name' then d->>'name' end,
    case when p_filters->>'sort'='oldest' then d->>'createdAt' end asc,
    case when coalesce(p_filters->>'sort','newest')='newest' then d->>'createdAt' end desc,d->>'id' limit lim offset off*lim)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(d) from paged),'[]'),'total',(select count(*) from selected),
    'ministries',coalesce((select jsonb_agg(distinct d->>'ministry') from base),'[]'),
    'counts',(select jsonb_build_object('access',count(*) filter(where d->>'kind'='access'),
      'change',count(*) filter(where d->>'kind'='change'),
      'exceptions',count(*) filter(where d->>'exceptionActive'='true' or jsonb_array_length(d->'validation'->'reasons')>0),
      'all',count(*)) from base where d->>'status' in ('pending','reviewing','information')),
    'sourceNotice','Se consultan cruces existentes del Organigrama. Sin coincidencia verificada, corresponde revisión manual. Dotación no se importa: sus actualizaciones se revisan fuera de la aplicación.') into result;
  return result;
end $$;

create or replace function red_conexion_gerencial.admin_request_detail(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r rcg_private.admin_requests; result jsonb;
begin
  perform rcg_private.admin_assert(); select * into r from rcg_private.admin_requests where id=p_id;
  if not found then raise exception 'La solicitud ya no está disponible' using errcode='22023'; end if;
  result:=rcg_private.admin_request_document(r);
  return result || jsonb_build_object('identifier',r.link_key,'note',r.note,'exceptionJustification',r.exception_justification,
    'related',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',trim(p.given_name||' '||p.family_name),
      'email',p.email,'role',p.position_title,'ministry',p.ministry,'active',p.is_active,'identifier',k.link_key))
      from red_conexion_gerencial.people p left join rcg_private.directory_link_keys k on k.person_id=p.id
      where p.id is distinct from r.person_id and (lower(trim(p.email))=lower(trim(r.email)) or k.link_key=r.link_key)),'[]'),
    'history',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'action',a.action,'actor',a.actor_label,
      'at',a.occurred_at,'reason',a.reason,'before',a.before_value,'after',a.after_value) order by a.occurred_at,a.id)
      from rcg_private.admin_audit a where a.request_id=r.id),'[]'),
    'priorRequests',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'status',p.status,'createdAt',p.created_at) order by p.created_at desc)
      from rcg_private.admin_requests p where p.id<>r.id and (p.user_id=r.user_id or p.link_key=r.link_key)),'[]'));
end $$;

create or replace function rcg_private.admin_log(p_request uuid,p_person uuid,p_action text,p_reason text,p_before jsonb,p_after jsonb)
returns void language sql security definer set search_path='' as $$
  insert into rcg_private.admin_audit(request_id,person_id,action,actor_id,actor_label,reason,before_value,after_value)
  values(p_request,p_person,p_action,auth.uid(),coalesce((select email from auth.users where id=auth.uid()),'Proceso autorizado'),
    p_reason,coalesce(p_before,'{}'),coalesce(p_after,'{}'));
$$;

-- One operation locks the request, revalidates evidence, applies the change and records the decision.
create or replace function red_conexion_gerencial.admin_decide_request(p_id uuid,p_version integer,p_action text,p_note text default '',p_reason text default '')
returns void language plpgsql security definer set search_path='' as $$
declare r rcg_private.admin_requests; v jsonb; p red_conexion_gerencial.people; target uuid; next_status text;
begin
  perform rcg_private.admin_assert();
  p_note:=coalesce(p_note,''); p_reason:=coalesce(p_reason,'');
  if p_action is null or p_action not in ('approve','exception','reject','information','review','pending','revoke') then raise exception 'Acción inválida' using errcode='22023'; end if;
  if length(coalesce(p_note,''))>3000 then raise exception 'La justificación supera el máximo permitido' using errcode='22023'; end if;
  -- Keep lock ordering consistent with registration and member operations.
  perform pg_advisory_xact_lock(905319117);
  select * into r from rcg_private.admin_requests where id=p_id for update;
  if not found or r.version is distinct from p_version then raise exception 'La solicitud cambió' using errcode='40001'; end if;
  if p_action='revoke' then
    if not r.exception_active or length(trim(p_note))<10 then raise exception 'Ingresá un motivo de revocación de al menos 10 caracteres' using errcode='22023'; end if;
    update rcg_private.admin_requests set exception_active=false,exception_revoked_at=now(),version=version+1,updated_at=now(),reviewed_by=auth.uid() where id=r.id;
    perform rcg_private.admin_log(r.id,r.person_id,'revoke',p_note,jsonb_build_object('exceptionActive',true),jsonb_build_object('exceptionActive',false,'accessUnchanged',true));
    return;
  end if;
  if r.status in ('approved','rejected') then raise exception 'La solicitud ya fue resuelta' using errcode='40001'; end if;
  v:=rcg_private.admin_request_document(r)->'validation';
  if p_action in ('exception','reject','information') and length(trim(p_note))<10 then
    raise exception 'Escribí una justificación de al menos 10 caracteres' using errcode='22023'; end if;
  if p_action='exception' and p_reason not in ('missing','non_manager','role_changed','duplicate_email','duplicate_identifier','ambiguous','invalid_identifier','unverified','identity','discrepancy','other') then
    raise exception 'Elegí el motivo de excepción' using errcode='22023'; end if;
  if p_action in ('approve','exception') then
    -- An exception can waive eligibility, NEVER an incompatible authentication identity.
    if (v->>'authConflict')::boolean or (v->>'duplicateEmail')::int>0 or (v->>'duplicateIdentifier')::int>0 then
      raise exception 'Resolvé el conflicto de identidad antes de aprobar. No se duplicará ni desvinculará ninguna cuenta automáticamente.' using errcode='22023'; end if;
    if p_action='approve' and not (v->>'ordinary')::boolean then raise exception 'Este caso requiere una excepción justificada' using errcode='22023'; end if;
    if r.kind='access' then
      if not exists(select 1 from auth.users u where u.id=r.user_id and u.email_confirmed_at is not null and lower(trim(u.email))=lower(trim(r.email))) then
        raise exception 'La cuenta de autenticación debe existir y tener el correo confirmado' using errcode='22023'; end if;
      target:=r.person_id;
      if target is null then
        insert into red_conexion_gerencial.people(given_name,family_name,position_title,ministry,secretariat,directorate,email,phone,source_sheet,source_row)
          values(r.given_name,r.family_name,coalesce(nullif(r.role,''),'Cargo pendiente de informar'),coalesce(nullif(r.ministry,''),'Organismo pendiente de informar'),r.secretariat,r.directorate,lower(trim(r.email)),'','Solicitud administrativa',null) returning id into target;
      else
        select * into p from red_conexion_gerencial.people where id=target for update;
        if p.version is distinct from r.person_version or lower(trim(p.email))<>lower(trim(r.email)) then raise exception 'El perfil cambió; revisá su identidad' using errcode='40001'; end if;
        update red_conexion_gerencial.people set is_active=true where id=target;
      end if;
      if rcg_private.valid_link_key(r.link_key) then
        insert into rcg_private.directory_link_keys(person_id,link_key,verified_at,verification_basis)
          values(target,r.link_key,now(),'Aprobación administrativa con identidad revisada') on conflict(person_id) do nothing;
        if not exists(select 1 from rcg_private.directory_link_keys where person_id=target and link_key=r.link_key) then raise exception 'Identidad incompatible' using errcode='22023'; end if;
      end if;
      insert into red_conexion_gerencial.member_accounts(person_id,auth_user_id,must_change_password)
        values(target,r.user_id,false) on conflict(person_id) do nothing;
      if not exists(select 1 from red_conexion_gerencial.member_accounts where person_id=target and auth_user_id=r.user_id) then raise exception 'Vínculo incompatible' using errcode='22023'; end if;
      insert into rcg_private.admin_access_states(user_id,state) values(r.user_id,'approved')
        on conflict(user_id) do update set state='approved',updated_at=now();
    else
      target:=r.person_id;
      select * into p from red_conexion_gerencial.people where id=target for update;
      if not found or p.version is distinct from r.person_version or to_jsonb(p)->>r.field is distinct from r.old_value then
        raise exception 'El perfil cambió desde la solicitud. Revisá los valores actuales.' using errcode='40001'; end if;
      if r.field='email' and (r.new_value !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' or exists(
        select 1 from red_conexion_gerencial.people q where q.id<>p.id and lower(trim(q.email))=lower(trim(r.new_value)))) then
        raise exception 'El correo propuesto es inválido o ya pertenece a otra persona' using errcode='22023'; end if;
      -- Institutional contact changes do not change the shared Supabase Auth login.
      execute format('update red_conexion_gerencial.people set %I=$1%s where id=$2',r.field,
        case when r.field='directorate' then ',directorate_id=null' else '' end) using trim(r.new_value),target;
    end if;
    next_status:='approved';
  elsif p_action='reject' then
    next_status:='rejected';
    if r.kind='access' then
      insert into rcg_private.admin_access_states(user_id,state) values(r.user_id,'rejected') on conflict(user_id) do update set state='rejected',updated_at=now();
    end if;
  else next_status:=case p_action when 'information' then 'information' when 'review' then 'reviewing' else 'pending' end;
  end if;
  update rcg_private.admin_requests set status=next_status,person_id=coalesce(target,person_id),version=version+1,
    updated_at=now(),reviewed_by=auth.uid(),note=trim(p_note),validation_snapshot=v,
    exception_active=case when p_action='exception' then true else exception_active end,
    exception_reason=case when p_action='exception' then p_reason else exception_reason end,
    exception_justification=case when p_action='exception' then trim(p_note) else exception_justification end,
    exception_approved_at=case when p_action='exception' then now() else exception_approved_at end where id=r.id;
  perform rcg_private.admin_log(r.id,coalesce(target,r.person_id),p_action,trim(p_note),
    jsonb_build_object('status',r.status,'field',r.field,'value',r.old_value),
    jsonb_build_object('status',next_status,'field',r.field,'value',case when next_status='approved' then r.new_value else r.old_value end,'exception',p_action='exception','validation',v));
end $$;

-- No onboarding form/Auth provisioning is introduced. This endpoint accepts an existing confirmed account.
create or replace function red_conexion_gerencial.admin_register_access(p_user uuid,p_given text,p_family text,p_role text,p_ministry text,p_identifier text,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid; mail text; pid uuid; pv integer; key text:=regexp_replace(coalesce(p_identifier,''),'[^0-9]','','g');
begin
  perform rcg_private.admin_assert(); perform pg_advisory_xact_lock(905319117);
  if exists(select 1 from red_conexion_gerencial.admin_users where user_id=p_user and is_active) then raise exception 'La cuenta ya posee permisos administrativos' using errcode='22023'; end if;
  select email into mail from auth.users where id=p_user and email_confirmed_at is not null;
  if mail is null or trim(p_given)='' or trim(p_family)='' then raise exception 'Falta identidad o cuenta confirmada' using errcode='22023'; end if;
  if exists(select 1 from red_conexion_gerencial.member_accounts where auth_user_id=p_user) then raise exception 'La cuenta ya tiene un perfil vinculado' using errcode='22023'; end if;
  select p.id,p.version into pid,pv from red_conexion_gerencial.people p left join rcg_private.directory_link_keys k on k.person_id=p.id
    where lower(trim(p.email))=lower(trim(mail)) or k.link_key=key order by p.id limit 1;
  insert into rcg_private.admin_requests(kind,user_id,person_id,person_version,given_name,family_name,email,link_key,role,ministry,reason)
    values('access',p_user,pid,pv,p_given,p_family,mail,key,p_role,p_ministry,p_reason) returning id into uid;
  insert into rcg_private.admin_access_states(user_id,state) values(p_user,'pending') on conflict(user_id) do update set state='pending',updated_at=now();
  perform rcg_private.admin_log(uid,pid,'created',p_reason,'{}',jsonb_build_object('kind','access'));
  return uid;
end $$;

create or replace function red_conexion_gerencial.submit_profile_change(p_field text,p_value text,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare p red_conexion_gerencial.people; rid uuid;
begin
  if not red_conexion_gerencial.is_member() then raise exception 'Acceso denegado' using errcode='42501'; end if;
  if p_field is null or p_field not in ('position_title','ministry','secretariat','directorate','email') or length(trim(coalesce(p_value,''))) not between 1 and 500 or length(trim(coalesce(p_reason,''))) not between 10 and 3000 then
    raise exception 'Revisá el campo, valor y justificación' using errcode='22023'; end if;
  select * into p from red_conexion_gerencial.people where id=red_conexion_gerencial.current_person_id() for update;
  if not found then raise exception 'No hay un perfil propio vinculado' using errcode='42501'; end if;
  if exists(select 1 from rcg_private.admin_requests r where r.person_id=p.id and r.field=p_field and r.status in ('pending','reviewing','information')) then
    raise exception 'Ya hay una solicitud abierta para este dato' using errcode='22023'; end if;
  insert into rcg_private.admin_requests(kind,user_id,person_id,person_version,given_name,family_name,email,link_key,role,ministry,field,old_value,new_value,reason)
    values('change',auth.uid(),p.id,p.version,p.given_name,p.family_name,p.email,(select link_key from rcg_private.directory_link_keys where person_id=p.id),
      p.position_title,p.ministry,p_field,to_jsonb(p)->>p_field,trim(p_value),trim(p_reason)) returning id into rid;
  perform rcg_private.admin_log(rid,p.id,'created',p_reason,'{}',jsonb_build_object('kind','change','field',p_field)); return rid;
end $$;

-- Access is local to this app. No auth.users/password or Hub state is modified.
create or replace function red_conexion_gerencial.current_person_id()
returns uuid language sql stable security definer set search_path='' as $$
  select a.person_id from red_conexion_gerencial.member_accounts a
    join red_conexion_gerencial.people p on p.id=a.person_id join auth.users u on u.id=a.auth_user_id
    where a.auth_user_id=auth.uid() and u.email_confirmed_at is not null and p.is_active and not a.must_change_password
      and not exists(select 1 from rcg_private.admin_access_states s where s.user_id=a.auth_user_id and s.state<>'approved') limit 1;
$$;
create or replace function red_conexion_gerencial.get_my_directory_gate()
returns text language sql stable security definer set search_path='' as $$
  select state from rcg_private.admin_access_states where user_id=auth.uid();
$$;
create or replace function red_conexion_gerencial.is_member()
returns boolean language sql stable security definer set search_path='' as $$
  select (red_conexion_gerencial.current_person_id() is not null or red_conexion_gerencial.is_admin())
    and not exists(select 1 from rcg_private.admin_access_states where user_id=auth.uid() and state<>'approved');
$$;
-- Existing permissive policies stay intact; this only restricts blocked local accounts.
do $$ declare t text; begin
  foreach t in array array['people','directorates','newsletters','profile_photos'] loop
    if to_regclass('red_conexion_gerencial.'||t) is not null then
      execute format('drop policy if exists admin_local_access_guard on red_conexion_gerencial.%I',t);
      execute format('create policy admin_local_access_guard on red_conexion_gerencial.%I as restrictive for all to authenticated using ((select red_conexion_gerencial.get_my_directory_gate()) is null or (select red_conexion_gerencial.get_my_directory_gate())=''approved'') with check ((select red_conexion_gerencial.get_my_directory_gate()) is null or (select red_conexion_gerencial.get_my_directory_gate())=''approved'')',t);
    end if;
  end loop;
end $$;

-- Restrict only this app's private buckets; other applications' policies are unaffected.
drop policy if exists rcg_administration_storage_gate on storage.objects;
create policy rcg_administration_storage_gate on storage.objects as restrictive for all to authenticated
using (bucket_id not in ('rcg-newsletters','rcg-profile-photos') or (select red_conexion_gerencial.get_my_directory_gate()) is null or (select red_conexion_gerencial.get_my_directory_gate())='approved')
with check (bucket_id not in ('rcg-newsletters','rcg-profile-photos') or (select red_conexion_gerencial.get_my_directory_gate()) is null or (select red_conexion_gerencial.get_my_directory_gate())='approved');

create or replace function rcg_private.admin_person_guard()
returns trigger language plpgsql security definer set search_path='' as $$ begin
  perform pg_advisory_xact_lock(905319117);
  if tg_op='INSERT' or new.email is distinct from old.email then
    if exists(select 1 from red_conexion_gerencial.people p where p.id<>new.id and lower(trim(p.email))=lower(trim(new.email))) then
      raise exception 'El correo ya está asociado a otro integrante' using errcode='22023';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists admin_people_guard on red_conexion_gerencial.people;
create trigger admin_people_guard before insert or update on red_conexion_gerencial.people for each row execute function rcg_private.admin_person_guard();

create or replace function rcg_private.admin_person_audit()
returns trigger language plpgsql security definer set search_path='' as $$
declare b jsonb:='{}'; a jsonb:='{}'; uid uuid;
begin
  if tg_op<>'INSERT' then b:=jsonb_build_object('name',old.given_name||' '||old.family_name,'role',old.position_title,'ministry',old.ministry,'secretariat',old.secretariat,'directorate',old.directorate,'email',old.email,'active',old.is_active,'version',old.version); end if;
  if tg_op<>'DELETE' then a:=jsonb_build_object('name',new.given_name||' '||new.family_name,'role',new.position_title,'ministry',new.ministry,'secretariat',new.secretariat,'directorate',new.directorate,'email',new.email,'active',new.is_active,'version',new.version); end if;
  uid:=case when tg_op='DELETE' then old.id else new.id end;
  perform rcg_private.admin_log(null,uid,lower(tg_op),coalesce(current_setting('rcg.admin_reason',true),'Edición del Directorio'),b,a);
  return coalesce(new,old);
end $$;
drop trigger if exists admin_people_audit on red_conexion_gerencial.people;
create trigger admin_people_audit after insert or update or delete on red_conexion_gerencial.people for each row execute function rcg_private.admin_person_audit();

create or replace function red_conexion_gerencial.admin_list_members(p_filters jsonb default '{}')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; lim integer:=least(50,greatest(1,coalesce((p_filters->>'pageSize')::int,10))); off integer:=greatest(0,coalesce((p_filters->>'page')::int,1)-1);
begin
  perform rcg_private.admin_assert();
  with base as materialized (
    select jsonb_build_object('id',p.id,'name',trim(p.given_name||' '||p.family_name),'givenName',p.given_name,'familyName',p.family_name,
      'role',p.position_title,'ministry',p.ministry,'secretariat',coalesce(p.secretariat,''),'directorate',coalesce(p.directorate,''),'directorateId',p.directorate_id,
      'email',p.email,'phone',p.phone,'bio',p.bio,'topics','[]'::jsonb,'advisoryTopicsRaw',coalesce(p.advisory_topics,''),'avatar',0,'newsletterIds','[]'::jsonb,
      'version',p.version,'active',p.is_active,'status',case when p.is_active then 'active' else 'inactive' end,'createdAt',p.imported_at,
      'exceptionActive',exists(select 1 from rcg_private.admin_requests r where r.person_id=p.id and r.exception_active),
      'qualityReviewedAt',case when q.person_version=p.version and q.validation=rcg_private.admin_validation(k.link_key,p.email,p.id,a.auth_user_id) then q.reviewed_at else null end,
      'validation',rcg_private.admin_validation(k.link_key,p.email,p.id,a.auth_user_id)) as d,k.link_key as search_key
    from red_conexion_gerencial.people p left join rcg_private.directory_link_keys k on k.person_id=p.id
      left join red_conexion_gerencial.member_accounts a on a.person_id=p.id left join rcg_private.admin_quality_reviews q on q.person_id=p.id),
  selected as (select d from base where rcg_private.admin_matches(d||jsonb_build_object('searchIdentifier',search_key),p_filters)),
  paged as (select d from selected order by case when p_filters->>'sort'='name' then d->>'name' end,
    case when p_filters->>'sort'='oldest' then d->>'createdAt' end asc,
    case when coalesce(p_filters->>'sort','newest')='newest' then d->>'createdAt' end desc,d->>'id' limit lim offset off*lim)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(d-'createdAt'-'status') from paged),'[]'),'total',(select count(*) from selected),
    'ministries',coalesce((select jsonb_agg(distinct d->>'ministry') from base),'[]'),
    'counts',(select jsonb_build_object('high',count(*) filter(where d->'validation'->>'risk'='high'),
      'medium',count(*) filter(where d->'validation'->>'risk'='medium'),'low',count(*) filter(where d->'validation'->>'risk'='low')) from base)) into result;
  return result;
end $$;

create or replace function red_conexion_gerencial.admin_member_identity(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare key text; mail text;
begin
  perform rcg_private.admin_assert(); select link_key into key from rcg_private.directory_link_keys where person_id=p_id;
  select email into mail from red_conexion_gerencial.people where id=p_id;
  return jsonb_build_object('identifier',key,'related',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,
    'name',p.given_name||' '||p.family_name,'email',p.email,'role',p.position_title,'ministry',p.ministry,'active',p.is_active,'identifier',k.link_key))
    from red_conexion_gerencial.people p left join rcg_private.directory_link_keys k on k.person_id=p.id
    where p.id<>p_id and (lower(trim(p.email))=lower(trim(mail)) or k.link_key=key)),'[]'));
end $$;
create or replace function red_conexion_gerencial.admin_manage_member(p_id uuid,p_version integer,p_action text,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare p red_conexion_gerencial.people; aid uuid;
begin
  perform rcg_private.admin_assert(); perform pg_advisory_xact_lock(905319117);
  if p_action is null or p_action not in ('activate','deactivate','delete','quality_review') or length(trim(coalesce(p_note,'')))<10 then raise exception 'Ingresá una acción válida y un motivo de al menos 10 caracteres' using errcode='22023'; end if;
  select * into p from red_conexion_gerencial.people where id=p_id for update;
  if not found or p.version is distinct from p_version then raise exception 'El integrante cambió' using errcode='40001'; end if;
  select auth_user_id into aid from red_conexion_gerencial.member_accounts where person_id=p_id;
  if p_action in ('deactivate','delete') and (aid=auth.uid() or exists(select 1 from red_conexion_gerencial.admin_users where user_id=aid and is_active)) then
    raise exception 'Las cuentas administrativas se gestionan fuera de la baja de integrantes' using errcode='22023'; end if;
  perform set_config('rcg.admin_reason',p_note,true);
  if p_action='delete' then
    if exists(select 1 from rcg_private.admin_requests where person_id=p_id) then raise exception 'El integrante tiene solicitudes auditadas. Podés desactivarlo para conservar su historial.' using errcode='22023'; end if;
    delete from red_conexion_gerencial.people where id=p_id;
  elsif p_action='quality_review' then
    insert into rcg_private.admin_quality_reviews(person_id,person_version,validation) values(p_id,p.version,
      rcg_private.admin_validation((select link_key from rcg_private.directory_link_keys where person_id=p_id),p.email,p_id,aid))
      on conflict(person_id) do update set reviewed_at=now(),person_version=excluded.person_version,validation=excluded.validation;
  else
    update red_conexion_gerencial.people set is_active=(p_action='activate') where id=p_id;
    if aid is not null then insert into rcg_private.admin_access_states(user_id,state) values(aid,case when p_action='activate' then 'approved' else 'suspended' end)
      on conflict(user_id) do update set state=excluded.state,updated_at=now(); end if;
  end if;
  perform rcg_private.admin_log(null,p_id,p_action,p_note,jsonb_build_object('active',p.is_active),jsonb_build_object('active',case when p_action='activate' then true when p_action='deactivate' then false else p.is_active end));
end $$;

create or replace function red_conexion_gerencial.admin_save_person(p_id uuid,p_version integer,p_values jsonb,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare p red_conexion_gerencial.people; k text;
begin
  perform rcg_private.admin_assert(); perform pg_advisory_xact_lock(905319117);
  if p_values is null or jsonb_typeof(p_values)<>'object' or length(trim(coalesce(p_note,'')))<10 then raise exception 'Faltan los valores o el motivo de edición' using errcode='22023'; end if;
  for k in select jsonb_object_keys(p_values) loop
    if k not in ('given_name','family_name','position_title','ministry','secretariat','directorate','directorate_id','phone','email','advisory_topics','bio') then raise exception 'Campo no permitido' using errcode='22023'; end if;
  end loop;
  if p_id is not null then
    select * into p from red_conexion_gerencial.people where id=p_id for update;
    if not found or p.version is distinct from p_version then raise exception 'El perfil cambió' using errcode='40001'; end if;
    if exists(select 1 from red_conexion_gerencial.people q where q.id<>p_id and lower(trim(q.email))=lower(trim(p_values->>'email'))) then raise exception 'El correo ya está asociado a otro integrante' using errcode='22023'; end if;
  end if;
  perform set_config('rcg.admin_reason',p_note,true);
  if p_id is null then
    insert into red_conexion_gerencial.people(given_name,family_name,position_title,ministry,secretariat,directorate,directorate_id,phone,email,advisory_topics,bio,source_sheet,source_row)
      values(p_values->>'given_name',p_values->>'family_name',p_values->>'position_title',p_values->>'ministry',p_values->>'secretariat',p_values->>'directorate',
        nullif(p_values->>'directorate_id','')::uuid,coalesce(p_values->>'phone',''),lower(trim(p_values->>'email')),p_values->>'advisory_topics',coalesce(p_values->>'bio',''),'Web',null);
  else
    update red_conexion_gerencial.people set given_name=p_values->>'given_name',family_name=p_values->>'family_name',position_title=p_values->>'position_title',
      ministry=p_values->>'ministry',secretariat=p_values->>'secretariat',directorate=p_values->>'directorate',directorate_id=nullif(p_values->>'directorate_id','')::uuid,
      phone=coalesce(p_values->>'phone',''),email=lower(trim(p_values->>'email')),advisory_topics=p_values->>'advisory_topics',bio=coalesce(p_values->>'bio','') where id=p_id;
  end if;
end $$;

create or replace function red_conexion_gerencial.admin_member_history(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
  perform rcg_private.admin_assert();
  return coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'action',a.action,'actor',a.actor_label,'at',a.occurred_at,
    'reason',a.reason,'before',a.before_value,'after',a.after_value) order by a.occurred_at desc,a.id)
    from rcg_private.admin_audit a where a.person_id=p_id),'[]');
end $$;

-- Default function execute privileges are revoked explicitly, including private helpers.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='rcg_private' and p.proname like 'admin_%') or (n.nspname='red_conexion_gerencial' and (p.proname like 'admin_%' or p.proname in ('get_my_directory_gate','submit_profile_change'))) loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
    if split_part(f.signature::text,'.',1)='red_conexion_gerencial' then execute format('grant execute on function %s to authenticated',f.signature); end if;
  end loop;
end $$;
notify pgrst,'reload schema';
commit;
