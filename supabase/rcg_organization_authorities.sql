-- Local migration only. Requires rcg_organization.sql and rcg_administration.sql.
begin;
alter table red_conexion_gerencial.organization_units
 add column if not exists authority_status text not null default 'unidentified'
  check(authority_status in ('automatic','manual','pending','vacant','unidentified','not_applicable')),
 add column if not exists authority_reason text not null default '',
 add column if not exists authority_reference date,
 add column if not exists authority_expected boolean,
 add column if not exists authority_version integer not null default 1,
 add column if not exists authority_reviewed boolean not null default false,
 add column if not exists proposed_name text,
 add column if not exists name_evidence text,
 add column if not exists name_history jsonb not null default '[]'::jsonb;

alter table rcg_private.organization_assignments
 add column if not exists assignment_origin text not null default 'legacy' check(assignment_origin in ('legacy','automatic','manual')),
 add column if not exists administrative_position text,
 add column if not exists confidence text check(confidence in ('high','medium','low')),
 add column if not exists matching_method text,
 add column if not exists source_name text,
 add column if not exists source_period text,
 add column if not exists source_reference date,
 add column if not exists valid_from date,
 add column if not exists valid_until date,
 add column if not exists validity_basis text,
 add column if not exists evidence_until date,
 add column if not exists observed_at date,
 add column if not exists review_excluded boolean not null default false;

-- Recognize the exact provenance of the old automated importer. Everything else
-- already confirmed is protected as a prior manual decision, not re-guessed.
update rcg_private.organization_assignments set assignment_origin=case
 when verification_basis like 'Único candidato con identificador válido y cargo jerárquico compatible%' then 'automatic'
 when responsibility_confirmed then 'manual' else 'legacy' end
 where assignment_origin='legacy';
update red_conexion_gerencial.organization_units u set authority_status=case
 when exists(select 1 from rcg_private.organization_assignments a where a.unit_id=u.id and a.responsibility_confirmed and a.assignment_origin='manual') then 'manual'
 when exists(select 1 from rcg_private.organization_assignments a where a.unit_id=u.id and a.responsibility_confirmed) then 'automatic'
 when exists(select 1 from rcg_private.organization_assignments a where a.unit_id=u.id) then 'pending' else 'unidentified' end
 where authority_reference is null and authority_version=1;

create table if not exists rcg_private.organization_authority_audit(
 id uuid primary key default gen_random_uuid(),unit_id uuid not null references red_conexion_gerencial.organization_units(id),
 actor_id uuid,action text not null,note text not null,evidence text not null,
 before_value jsonb not null,after_value jsonb not null,created_at timestamptz not null default now()
);
create index if not exists authority_audit_unit_idx on rcg_private.organization_authority_audit(unit_id,created_at desc);
alter table rcg_private.organization_authority_audit enable row level security;
revoke all on rcg_private.organization_authority_audit from public,anon,authenticated,service_role;

create or replace function rcg_private.authority_safe_text(p_text text)
returns text language sql immutable set search_path='' as $$
 select regexp_replace(p_text,'[0-9]{2}[-. ]?[0-9]{8}[-. ]?[0-9]','[identificador protegido]','g')
$$;
revoke all on function rcg_private.authority_safe_text(text) from public,anon,authenticated,service_role;

create or replace function rcg_private.authority_display_status(p_unit uuid)
returns text language sql stable security definer set search_path='' as $$
 select case when u.authority_status in ('automatic','manual') and not exists(
  select 1 from rcg_private.organization_assignments a where a.unit_id=u.id and a.responsibility_confirmed and not a.review_excluded
   and (a.valid_from is null or a.valid_from<=current_date) and (a.valid_until is null or a.valid_until>=current_date)
   and (a.assignment_origin='manual' or a.evidence_until is null or a.evidence_until>=current_date))
 then 'pending' else u.authority_status end from red_conexion_gerencial.organization_units u where u.id=p_unit
$$;
revoke all on function rcg_private.authority_display_status(uuid) from public,anon,authenticated,service_role;

-- Safe assignment projection reused by the chart and administrative review.
create or replace function rcg_private.authority_dto(p_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',a.id,'unitId',a.unit_id,'responsibleId',o.id,
  'name',case when p.is_active and k.person_id=o.person_id and o.reconciliation_status='member'
   then trim(p.given_name||' '||p.family_name) else o.institutional_name end,
  'role',a.position_title,'administrativeRole',a.administrative_position,
  'membership',case when p.is_active and k.person_id=o.person_id and o.reconciliation_status='member' then 'member'
   when o.reconciliation_status='non_member' and o.verified_at is not null and k.person_id is null then 'non_member' else 'pending' end,
  'personId',case when p.is_active and k.person_id=o.person_id and o.reconciliation_status='member' then p.id end,
  'identificationStatus',case when a.assignment_origin='manual' then 'manual' when a.responsibility_confirmed then 'automatic' else 'pending' end,
  'confidence',a.confidence,'method',a.matching_method,'source',a.source_name,'sourcePeriod',a.source_period,
  'sourceDate',a.source_reference,'validFrom',a.valid_from,'validUntil',a.valid_until,'validityBasis',rcg_private.authority_safe_text(a.validity_basis),
  'evidenceUntil',a.evidence_until,'checkedAt',a.observed_at)
 from rcg_private.organization_assignments a join rcg_private.organization_people o on o.id=a.responsible_id
 left join rcg_private.directory_link_keys k on k.link_key=o.link_key
 left join red_conexion_gerencial.people p on p.id=k.person_id where a.id=p_id
$$;
revoke all on function rcg_private.authority_dto(uuid) from public,anon,authenticated,service_role;

create or replace function red_conexion_gerencial.get_organization_chart()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce(red_conexion_gerencial.is_member(),false) then raise exception 'Acceso no autorizado' using errcode='42501'; end if;
 return jsonb_build_object('units',coalesce((select jsonb_agg(jsonb_build_object(
  'id',u.id,'parentId',u.parent_id,'name',u.name,'type',u.unit_type,'code',u.code,'directorateId',u.directorate_id,
  'responsibilityPending',u.authority_status='pending' or u.authority_status in ('automatic','manual') and not exists(
   select 1 from rcg_private.organization_assignments a where a.unit_id=u.id and a.responsibility_confirmed and not a.review_excluded
    and (a.valid_from is null or a.valid_from<=current_date) and (a.valid_until is null or a.valid_until>=current_date)
    and (a.assignment_origin='manual' or a.evidence_until is null or a.evidence_until>=current_date)),
  'identificationStatus',case when u.authority_status in ('automatic','manual') and not exists(
   select 1 from rcg_private.organization_assignments a where a.unit_id=u.id and a.responsibility_confirmed and not a.review_excluded
    and (a.valid_from is null or a.valid_from<=current_date) and (a.valid_until is null or a.valid_until>=current_date)
    and (a.assignment_origin='manual' or a.evidence_until is null or a.evidence_until>=current_date)) then 'pending' else u.authority_status end,
  'identificationReason',rcg_private.authority_safe_text(u.authority_reason),'referenceDate',u.authority_reference,
  'proposedName',u.proposed_name,'nameEvidence',rcg_private.authority_safe_text(u.name_evidence),
  'aliases',coalesce((select jsonb_agg(h->>'name') from jsonb_array_elements(u.name_history) h),'[]')) order by u.name,u.id)
  from red_conexion_gerencial.organization_units u),'[]'),
  'responsibilities',coalesce((select jsonb_agg(rcg_private.authority_dto(a.id) order by a.unit_id,a.id)
   from rcg_private.organization_assignments a where a.responsibility_confirmed and not a.review_excluded
    and (a.valid_from is null or a.valid_from<=current_date) and (a.valid_until is null or a.valid_until>=current_date)
    and (a.assignment_origin='manual' or a.evidence_until is null or a.evidence_until>=current_date)
    and exists(select 1 from red_conexion_gerencial.organization_units u where u.id=a.unit_id and u.authority_status in ('automatic','manual'))),'[]'));
end $$;

create or replace function red_conexion_gerencial.admin_organization_authorities(p_query text default '',p_state text default 'pending',p_page integer default 1,p_size integer default 25)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not red_conexion_gerencial.is_admin() then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if p_page is null or p_page<1 or p_size is null or p_size not between 1 and 50 or p_query is null or length(p_query)>150
  or p_state is null or p_state not in ('','automatic','manual','pending','vacant','unidentified','not_applicable','renamed') then raise exception 'Filtros inválidos' using errcode='22023'; end if;
 with recursive tree as (
  select id,name as organism from red_conexion_gerencial.organization_units where parent_id is null
  union all select u.id,t.organism from red_conexion_gerencial.organization_units u join tree t on u.parent_id=t.id
 ), base as (
  select u.*,t.organism,rcg_private.authority_display_status(u.id) as display_status from red_conexion_gerencial.organization_units u join tree t using(id)
 ), filtered as (
  select * from base where (p_state='' or display_status=p_state or p_state='renamed' and proposed_name is not null)
   and (p_query='' or rcg_private.admin_norm(name||' '||organism||' '||coalesce(proposed_name,'')) like '%'||rcg_private.admin_norm(p_query)||'%')
 ), page as (select * from filtered order by name,id limit p_size offset (p_page-1)*p_size)
 select jsonb_build_object('total',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(jsonb_build_object(
  'id',u.id,'name',u.name,'type',u.unit_type,'organism',u.organism,'code',u.code,'status',u.display_status,
  'reason',rcg_private.authority_safe_text(u.authority_reason),'referenceDate',u.authority_reference,'version',u.authority_version,
  'proposedName',u.proposed_name,'nameEvidence',rcg_private.authority_safe_text(u.name_evidence),
  'candidates',coalesce((select jsonb_agg(rcg_private.authority_dto(a.id)||jsonb_build_object('reason',rcg_private.authority_safe_text(a.verification_basis),'excluded',a.review_excluded) order by a.responsibility_confirmed desc,a.id)
   from rcg_private.organization_assignments a where a.unit_id=u.id),'[]'),
  'history',coalesce((select jsonb_agg(jsonb_build_object('action',h.action,'note',rcg_private.authority_safe_text(h.note),'evidence',rcg_private.authority_safe_text(h.evidence),'at',h.created_at) order by h.created_at desc)
   from (select * from rcg_private.organization_authority_audit where unit_id=u.id order by created_at desc limit 20) h),'[]')) order by u.name,u.id) from page u),'[]'),
  'counts',(select jsonb_object_agg(status,total) from (select display_status as status,count(*) as total from base group by display_status) s),
  'byType',(select jsonb_agg(s) from (select unit_type,display_status,count(*) as total from base group by unit_type,display_status) s),
  'byOrganism',(select jsonb_agg(s) from (select organism,display_status,count(*) as total from base group by organism,display_status) s)) into result;
 return result;
end $$;

create or replace function red_conexion_gerencial.admin_review_authority(p_unit uuid,p_expected integer,p_assignment uuid,p_state text,p_note text,p_evidence text,p_accept_name boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare u red_conexion_gerencial.organization_units; a rcg_private.organization_assignments; previous jsonb;
begin
 if not red_conexion_gerencial.is_admin() then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if p_state is null or p_state not in ('manual','pending','vacant','unidentified','not_applicable')
  or coalesce(length(trim(p_note)),0)<15 or length(p_note)>1500
  or coalesce(length(trim(p_evidence)),0)<5 or length(p_evidence)>1000 then
  raise exception 'Indicá una justificación y evidencia institucional verificable' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(771245904);
 select * into u from red_conexion_gerencial.organization_units where id=p_unit for update;
 if not found then raise exception 'Unidad no disponible' using errcode='22023'; end if;
 if u.authority_version is distinct from p_expected then raise exception 'La unidad cambió. Actualizá la revisión.' using errcode='40001'; end if;
 previous:=jsonb_build_object('status',u.authority_status,'name',u.name,'assignments',
  (select jsonb_agg(id) from rcg_private.organization_assignments where unit_id=u.id and responsibility_confirmed));
 if p_state='manual' then
  select * into a from rcg_private.organization_assignments where id=p_assignment and unit_id=u.id;
  if not found or a.review_excluded or (a.valid_from is not null and a.valid_from>current_date)
   or (a.valid_until is not null and a.valid_until<current_date) then raise exception 'El candidato requiere actualizar su evidencia de vigencia' using errcode='22023'; end if;
 end if;
 update rcg_private.organization_assignments set responsibility_confirmed=false where unit_id=u.id;
 if p_state='manual' then update rcg_private.organization_assignments set responsibility_confirmed=true,assignment_origin='manual',verification_basis=p_note where id=a.id; end if;
 if p_accept_name and u.proposed_name is null then raise exception 'No hay un cambio de denominación para confirmar' using errcode='22023'; end if;
 update red_conexion_gerencial.organization_units set authority_status=p_state,authority_reason=p_note,
  authority_reference=current_date,authority_version=authority_version+1,authority_reviewed=true,
  authority_expected=case when p_state in ('manual','vacant') then true when p_state='not_applicable' then false else null end,
  name=case when p_accept_name then proposed_name else name end,
  name_history=case when p_accept_name then name_history||jsonb_build_array(jsonb_build_object('name',name,'observedUntil',current_date,'evidence',p_evidence)) else name_history end,
  proposed_name=case when p_accept_name then null else proposed_name end,
  name_evidence=case when p_accept_name then null else name_evidence end where id=u.id;
 insert into rcg_private.organization_authority_audit(unit_id,actor_id,action,note,evidence,before_value,after_value)
 values(u.id,auth.uid(),'manual_review',p_note,p_evidence,previous,
  jsonb_build_object('status',p_state,'assignment',p_assignment,'nameAccepted',p_accept_name));
end $$;

revoke all on function red_conexion_gerencial.admin_organization_authorities(text,text,integer,integer),
 red_conexion_gerencial.admin_review_authority(uuid,integer,uuid,text,text,text,boolean) from public,anon,authenticated,service_role;
grant execute on function red_conexion_gerencial.admin_organization_authorities(text,text,integer,integer),
 red_conexion_gerencial.admin_review_authority(uuid,integer,uuid,text,text,text,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
