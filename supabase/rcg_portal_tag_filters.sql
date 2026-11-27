-- Apply after rcg_portal.sql so editorial filters can match every tag on a publication.
begin;

create or replace function rcg_private.portal_publication_tags(p_content jsonb)
returns text[] language sql immutable set search_path='' as $$
  with labels as (
    select regexp_replace(btrim(raw.label), '^#+[[:space:]]*', '') as label
    from jsonb_array_elements_text(coalesce(p_content->'tags','[]'::jsonb) || jsonb_build_array(p_content->>'topic')) as raw(label)
  ), canonical as (
    select case when rcg_private.admin_norm(label) in ('innovacion', 'innovacion publica') then 'Innovación' else label end as label
    from labels
    where rcg_private.admin_norm(label) not in ('', 'sin tematica')
  )
  select array(select distinct label from canonical order by label)
$$;
revoke all on function rcg_private.portal_publication_tags(jsonb) from public, anon, authenticated, service_role;

create or replace function red_conexion_gerencial.editorial_list(p_tray text default 'pending',p_filters jsonb default '{}')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; page integer:=greatest(1,least(coalesce((p_filters->>'page')::int,1),100000)); size integer:=greatest(1,least(coalesce((p_filters->>'pageSize')::int,12),100));
begin
 if not red_conexion_gerencial.is_admin() then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if p_tray not in ('pending','changes','published','retired','all') then raise exception 'Bandeja inválida' using errcode='22023'; end if;
 with source as (
  select n.*,coalesce(p.given_name||' '||p.family_name,'Administración de la Red') as author_name,coalesce(p.position_title,'Equipo administrador') as author_role,
   coalesce(p.ministry,'Red de gerentes y mandos medios') as author_ministry,coalesce(p.directorate,p.secretariat,'') as author_unit,
   w.state as work_state,w.id as work_id,w.request_type,coalesce(w.submitted_at,n.updated_at) as sent_at,
   case when p_tray in ('pending','changes') or n.published_revision is null then coalesce(w.content,l.content) else rcg_private.newsletter_content(n) end as content,
   (select jsonb_build_object('action',a.action,'note',a.note,'actor',a.actor_label,'at',a.created_at) from rcg_private.newsletter_editorial_audit a where a.newsletter_id=n.id order by a.created_at desc limit 1) as last_event
  from red_conexion_gerencial.newsletters n left join red_conexion_gerencial.people p on p.id=n.author_id
   left join rcg_private.newsletter_versions w on w.id=n.working_revision
   left join rcg_private.newsletter_versions l on l.id=n.latest_revision
 ), base as (
  select source.*, rcg_private.portal_publication_tags(content) as portal_tags from source
 ), filtered as (
  select * from base b where
   (p_tray='all' or p_tray='pending' and work_state='pendiente' and visibility not in ('hidden','archived')
    or p_tray='changes' and work_state='cambios' and visibility not in ('hidden','archived')
    or p_tray='published' and visibility='visible' or p_tray='retired' and visibility in ('hidden','archived'))
   and (coalesce(p_filters->>'query','')='' or rcg_private.admin_norm(content->>'title'||' '||coalesce(content->>'body','')||' '||author_name||' '||author_ministry||' '||array_to_string(b.portal_tags,' ')) like '%'||rcg_private.admin_norm(p_filters->>'query')||'%')
   and (coalesce(p_filters->>'topic','')='' or exists (
     select 1 from unnest(b.portal_tags) as tags(label)
     where rcg_private.admin_norm(label)=rcg_private.admin_norm(p_filters->>'topic')
   ))
   and (coalesce(p_filters->>'ministry','')='' or author_ministry=p_filters->>'ministry')
   and (coalesce(p_filters->>'author','')='' or coalesce(author_user_id::text,author_id::text,'institutional')=p_filters->>'author')
   and (coalesce(p_filters->>'status','')='' or status=p_filters->>'status' or work_state=p_filters->>'status')
 ), ordered as (
  select * from filtered order by case when p_filters->>'sort'='title' then content->>'title' end,
   case when p_filters->>'sort'='oldest' then updated_at end asc,
   case when coalesce(p_filters->>'sort','newest')='newest' then updated_at end desc,id
  limit size offset (page-1)*size
 )
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(o)) from ordered o),'[]'),
  'total',(select count(*) from filtered),'counts',(select jsonb_build_object(
   'pending',count(*) filter(where work_state='pendiente' and visibility not in ('hidden','archived')),
   'changes',count(*) filter(where work_state='cambios' and visibility not in ('hidden','archived')),
   'published',count(*) filter(where visibility='visible'),'retired',count(*) filter(where visibility in ('hidden','archived'))) from base),
  'topics',coalesce((select jsonb_agg(distinct label order by label) from base cross join lateral unnest(portal_tags) as tags(label)),'[]'),
  'ministries',coalesce((select jsonb_agg(distinct author_ministry) from base),'[]'),
  'authors',coalesce((select jsonb_agg(a) from (select distinct coalesce(author_user_id::text,author_id::text,'institutional') as id,author_name as name from base) a),'[]'),
  'emailConfigured',false) into result;
 return result;
end $$;

notify pgrst,'reload schema';
commit;
