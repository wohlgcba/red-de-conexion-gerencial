-- Local migration. Apply after rcg_admin_newsletters.sql, rcg_newsletter_rich_text.sql,
-- rcg_administration_intake.sql and rcg_newsletter_reactions.sql. No remote execution.
begin;
create schema if not exists rcg_private;
alter table red_conexion_gerencial.newsletters drop constraint if exists newsletters_status_check;
alter table red_conexion_gerencial.newsletters add constraint newsletters_status_check
  check(status in ('borrador','pendiente','cambios','publicado','rechazado','oculto','archivado'));
alter table red_conexion_gerencial.newsletters
  add column if not exists visibility text not null default 'unpublished' check(visibility in ('unpublished','visible','hidden','archived')),
  add column if not exists published_revision uuid,
  add column if not exists working_revision uuid,
  add column if not exists latest_revision uuid,
  add column if not exists previous_visibility text;

create table if not exists rcg_private.newsletter_versions(
  id uuid primary key default gen_random_uuid(), newsletter_id uuid not null references red_conexion_gerencial.newsletters(id) on delete cascade,
  number integer not null check(number>0), content jsonb not null,
  state text not null check(state in ('borrador','pendiente','cambios','publicado','rechazado','sustituida')),
  request_type text not null check(request_type in ('new','correction','version','minor','legacy')),
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), submitted_at timestamptz,
  unique(newsletter_id,number)
);
create table if not exists rcg_private.newsletter_editorial_audit(
  id uuid primary key default gen_random_uuid(), newsletter_id uuid not null, revision_id uuid,
  action text not null, actor_id uuid, actor_label text not null, note text not null default '',
  before_value jsonb not null, after_value jsonb not null, created_at timestamptz not null default now()
);
create index if not exists editorial_audit_newsletter on rcg_private.newsletter_editorial_audit(newsletter_id,created_at desc);
-- Durable intent only: nothing is marked sent until an actual mail transport is configured.
create table if not exists rcg_private.newsletter_email_outbox(
  id uuid primary key default gen_random_uuid(), audit_id uuid not null unique references rcg_private.newsletter_editorial_audit(id),
  recipient text not null, action text not null check(action in ('cambios','rechazado','hide')),
  subject text not null, message text not null, state text not null default 'pending' check(state in ('pending','sent','failed')),
  created_at timestamptz not null default now(), sent_at timestamptz, last_error text
);
alter table rcg_private.newsletter_versions enable row level security;
alter table rcg_private.newsletter_editorial_audit enable row level security;
alter table rcg_private.newsletter_email_outbox enable row level security;
revoke all on rcg_private.newsletter_versions,rcg_private.newsletter_editorial_audit,rcg_private.newsletter_email_outbox from public,anon,authenticated,service_role;

create or replace function rcg_private.newsletter_content(n red_conexion_gerencial.newsletters) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('title',n.title,'subtitle',n.subtitle,'topic',n.topic,'summary',n.summary,
  'body',n.body,'body_html',n.body_html,'image_path',n.image_path,'tags',n.tags,'reading_minutes',n.reading_minutes)
$$;

-- Idempotent backfill: one historical snapshot, without changing legacy content or dates.
drop trigger if exists newsletters_guard on red_conexion_gerencial.newsletters;
do $$ declare n red_conexion_gerencial.newsletters; v uuid; begin
 for n in select * from red_conexion_gerencial.newsletters where latest_revision is null for update loop
  insert into rcg_private.newsletter_versions(newsletter_id,number,content,state,request_type,created_by,created_at,submitted_at)
   values(n.id,1,rcg_private.newsletter_content(n),case when n.status='archivado' then 'publicado' else n.status end,
    'legacy',n.author_user_id,n.updated_at,case when n.status<>'borrador' then n.updated_at end) returning id into v;
  update red_conexion_gerencial.newsletters set latest_revision=v,
   published_revision=case when n.status in ('publicado','archivado') then v end,
   working_revision=case when n.status in ('borrador','pendiente','cambios') then v end,
   visibility=case when n.status='publicado' then 'visible' when n.status='archivado' then 'archived' else 'unpublished' end,
   previous_visibility=case when n.status='archivado' then 'visible' end where id=n.id;
  -- Guard increments are restored only during this local migration's legacy backfill.
 end loop;
end $$;
create trigger newsletters_guard before insert or update on red_conexion_gerencial.newsletters
 for each row execute function red_conexion_gerencial.guard_newsletter();

create or replace function rcg_private.editorial_access(p_id uuid, p_admin boolean default false)
returns red_conexion_gerencial.newsletters language plpgsql security definer set search_path='' as $$
declare n red_conexion_gerencial.newsletters;
begin
 if auth.uid() is null or not red_conexion_gerencial.is_member() then raise exception 'Acceso denegado' using errcode='42501'; end if;
 select * into n from red_conexion_gerencial.newsletters where id=p_id;
 if not found or (not red_conexion_gerencial.is_admin() and (p_admin or
    not coalesce(n.author_user_id=auth.uid() or n.author_id=red_conexion_gerencial.current_person_id(),false))) then
  raise exception 'Acceso denegado' using errcode='42501'; end if;
 return n;
end $$;

create or replace function rcg_private.editorial_log(n red_conexion_gerencial.newsletters,p_revision uuid,p_action text,p_note text,p_before jsonb,p_after jsonb,p_notify boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare aid uuid; owner_id uuid; mail text; message text;
begin
 insert into rcg_private.newsletter_editorial_audit(newsletter_id,revision_id,action,actor_id,actor_label,note,before_value,after_value)
 values(n.id,p_revision,p_action,auth.uid(),coalesce((select email from auth.users where id=auth.uid()),'Migración'),coalesce(p_note,''),p_before,p_after) returning id into aid;
 if not p_notify then return; end if;
 owner_id:=coalesce(n.author_user_id,(select auth_user_id from red_conexion_gerencial.member_accounts where person_id=n.author_id));
 if owner_id is null then return; end if;
 message:=case p_action when 'publicado' then 'Tu newsletter fue aprobado y publicado.' when 'cambios' then 'Se solicitaron cambios en tu newsletter.'
  when 'rechazado' then 'Tu newsletter fue rechazado. Consultá las observaciones.' when 'hide' then 'Tu newsletter fue ocultado.'
  when 'archive' then 'Tu newsletter fue archivado.' when 'restore' then 'Tu newsletter fue restaurado.' when 'direct_publish' then 'Tu newsletter fue publicado.' else 'La administración corrigió tu newsletter.' end;
 insert into rcg_private.admin_notifications(user_id,event_key,message,href)
 values(owner_id,'editorial:'||aid::text,message,'/mis-newsletters');
 if p_action in ('cambios','rechazado','hide') then
  select email into mail from auth.users where id=owner_id and email_confirmed_at is not null;
  if mail is not null then insert into rcg_private.newsletter_email_outbox(audit_id,recipient,action,subject,message)
   values(aid,mail,p_action,message,n.title||E'\n\n'||coalesce(p_note,'')); end if;
 end if;
end $$;

create or replace function rcg_private.editorial_project(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare n red_conexion_gerencial.newsletters; v rcg_private.newsletter_versions; projected_status text;
begin
 select * into n from red_conexion_gerencial.newsletters where id=p_id;
 select * into v from rcg_private.newsletter_versions where id=coalesce(n.published_revision,n.latest_revision);
 projected_status:=case n.visibility when 'visible' then 'publicado' when 'hidden' then 'oculto' when 'archived' then 'archivado'
  else (select state from rcg_private.newsletter_versions where id=n.latest_revision) end;
 update red_conexion_gerencial.newsletters set title=v.content->>'title',subtitle=v.content->>'subtitle',topic=v.content->>'topic',
  summary=v.content->>'summary',body=v.content->>'body',body_html=v.content->>'body_html',image_path=v.content->>'image_path',
  tags=array(select jsonb_array_elements_text(v.content->'tags')),reading_minutes=(v.content->>'reading_minutes')::int,
  status=projected_status,featured=featured and projected_status='publicado' where id=n.id;
end $$;

create or replace function red_conexion_gerencial.editorial_save(p_id uuid,p_expected integer,p_content jsonb,p_intent text,p_note text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare n red_conexion_gerencial.newsletters; prior rcg_private.newsletter_versions; v uuid; seq integer; state text;
 admin boolean:=red_conexion_gerencial.is_admin(); kind text; before_value jsonb;
begin
 if auth.uid() is null or not red_conexion_gerencial.is_member() then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if p_intent is null or p_intent not in ('borrador','pendiente','publicado','minor') or p_intent in ('publicado','minor') and not admin then
  raise exception 'Transición editorial no permitida' using errcode='42501'; end if;
 if p_note is null or length(p_note)>3000 or p_intent='minor' and length(trim(p_note))<10 then raise exception 'Justificá la edición menor (mínimo 10 caracteres)' using errcode='22023'; end if;
 if jsonb_typeof(p_content) is distinct from 'object' or (p_content-array['title','subtitle','topic','summary','body','body_html','image_path','tags','reading_minutes'])<>'{}'::jsonb
  or length(trim(coalesce(p_content->>'title',''))) not between 1 and 100 or length(coalesce(p_content->>'subtitle',''))>160
  or length(trim(coalesce(p_content->>'topic','')))=0 or length(coalesce(p_content->>'topic',''))>100
  or length(coalesce(p_content->>'summary',''))>1000 or length(coalesce(p_content->>'body',''))>5000
  or length(coalesce(p_content->>'body_html',''))>60000 or jsonb_typeof(p_content->'tags') is distinct from 'array'
  or jsonb_array_length(p_content->'tags')>20 or (p_content->>'reading_minutes')::int not between 1 and 120 then
  raise exception 'Revisá título, temática, contenido y límites del newsletter' using errcode='22023'; end if;
 if p_intent<>'borrador' and length(trim(coalesce(p_content->>'body','')))=0 then raise exception 'Completá el contenido antes de enviar o publicar' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(905319118);
 if p_id is null then
  if p_intent='minor' then raise exception 'Publicación no disponible' using errcode='22023'; end if;
  insert into red_conexion_gerencial.newsletters(author_id,author_user_id,title,topic)
   values(red_conexion_gerencial.current_person_id(),auth.uid(),p_content->>'title',p_content->>'topic') returning * into n;
  kind:='new';
 else
  n:=rcg_private.editorial_access(p_id);
  if n.version is distinct from p_expected then raise exception 'El newsletter cambió. Actualizá antes de guardar.' using errcode='40001'; end if;
  select * into prior from rcg_private.newsletter_versions where id=case when p_intent='minor' then coalesce(n.working_revision,n.published_revision,n.latest_revision) else coalesce(n.working_revision,n.latest_revision) end;
  if n.visibility in ('hidden','archived') then raise exception 'Restaurá el newsletter antes de editarlo' using errcode='22023'; end if;
  if not admin and (prior.state='pendiente' or n.published_revision is null and prior.state not in ('borrador','cambios')) then
   raise exception 'El newsletter no está disponible para edición' using errcode='22023'; end if;
  if p_intent='minor' and not admin then raise exception 'Acceso denegado' using errcode='42501'; end if;
  kind:=case when p_intent='minor' then 'minor' when prior.state='cambios' or prior.request_type='correction' and prior.state='borrador' then 'correction'
   when n.published_revision is not null then 'version' else 'new' end;
 end if;
 before_value:=to_jsonb(n);
 if nullif(p_content->>'image_path','') is not null and split_part(p_content->>'image_path','/',1)<>auth.uid()::text
  and not exists(select 1 from rcg_private.newsletter_versions x where x.newsletter_id=n.id and x.content->>'image_path'=p_content->>'image_path') then
  raise exception 'La portada no pertenece a esta publicación o cuenta' using errcode='42501'; end if;
 select coalesce(max(number),0)+1 into seq from rcg_private.newsletter_versions where newsletter_id=n.id;
 state:=case when p_intent='minor' then prior.state else p_intent end;
 if state not in ('borrador','pendiente','cambios','publicado') then raise exception 'La versión no admite una edición menor' using errcode='22023'; end if;
 if n.working_revision is not null then update rcg_private.newsletter_versions x set state='sustituida' where x.id=n.working_revision and x.state in ('borrador','pendiente','cambios'); end if;
 insert into rcg_private.newsletter_versions(newsletter_id,number,content,state,request_type,created_by,submitted_at)
 values(n.id,seq,p_content,state,kind,auth.uid(),case when state='pendiente' then now() end) returning id into v;
 update red_conexion_gerencial.newsletters set latest_revision=v,
  working_revision=case when state<>'publicado' then v end,
  published_revision=case when state='publicado' then v else published_revision end,
  visibility=case when state='publicado' then 'visible' else visibility end,
  published_at=case when state='publicado' then coalesce(published_at,now()) else published_at end where id=n.id;
 perform rcg_private.editorial_project(n.id);
 perform rcg_private.editorial_log(n,v,case when p_intent='minor' then 'minor' when state='pendiente' then 'submitted' when state='publicado' then 'direct_publish' else 'draft_saved' end,
  p_note,before_value,p_content||jsonb_build_object('state',state),p_intent='minor' or state='publicado');
 return n.id;
end $$;

create or replace function red_conexion_gerencial.editorial_decide(p_id uuid,p_expected integer,p_revision uuid,p_action text,p_note text default '',p_featured boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare n red_conexion_gerencial.newsletters; v rcg_private.newsletter_versions; before_value jsonb;
begin
 perform pg_advisory_xact_lock(905319118);
 n:=rcg_private.editorial_access(p_id,true);
 if n.version is distinct from p_expected then raise exception 'El newsletter cambió. Actualizá la revisión.' using errcode='40001'; end if;
 if p_action is null or p_action not in ('publicado','cambios','rechazado','hide','archive','restore') then raise exception 'Acción editorial inválida' using errcode='22023'; end if;
 if p_note is null or length(p_note)>3000 or p_action in ('cambios','rechazado','hide','archive','restore') and length(trim(p_note))<10 then
  raise exception 'Ingresá una observación de al menos 10 caracteres' using errcode='22023'; end if;
 before_value:=to_jsonb(n);
 if p_action in ('publicado','cambios','rechazado') then
  select * into v from rcg_private.newsletter_versions where id=n.working_revision;
  if v.id is distinct from p_revision or v.state<>'pendiente' or v.id is null or n.visibility in ('hidden','archived') then
   raise exception 'La versión ya no está pendiente de revisión' using errcode='40001'; end if;
  update rcg_private.newsletter_versions set state=p_action where id=v.id;
  if p_action='publicado' then
   if p_featured then update red_conexion_gerencial.newsletters set featured=false where featured and id<>n.id; end if;
   update red_conexion_gerencial.newsletters set published_revision=v.id,working_revision=null,visibility='visible',
    featured=p_featured,published_at=coalesce(published_at,now()) where id=n.id;
  elsif p_action='rechazado' then update red_conexion_gerencial.newsletters set working_revision=null where id=n.id;
  end if;
 else
  if p_action='hide' and n.visibility<>'visible' or p_action='archive' and n.visibility='archived'
   or p_action='restore' and n.visibility not in ('hidden','archived') then raise exception 'Transición de visibilidad no permitida' using errcode='22023'; end if;
  update red_conexion_gerencial.newsletters set
   previous_visibility=case when p_action<>'restore' then visibility end,
   visibility=case when p_action='hide' then 'hidden' when p_action='archive' then 'archived'
     when published_revision is null then 'unpublished' when visibility='archived' and previous_visibility='hidden' then 'hidden' else 'visible' end
   where id=n.id;
 end if;
 update red_conexion_gerencial.newsletters set review_note=nullif(trim(p_note),''),reviewed_by=auth.uid() where id=n.id;
 perform rcg_private.editorial_project(n.id);
 if p_action='publicado' then update red_conexion_gerencial.newsletters set featured=p_featured where id=n.id; end if;
 perform rcg_private.editorial_log(n,coalesce(v.id,n.published_revision,n.latest_revision),p_action,trim(p_note),before_value,
  (select to_jsonb(x) from red_conexion_gerencial.newsletters x where id=n.id),true);
end $$;

create or replace function red_conexion_gerencial.editorial_detail(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare n red_conexion_gerencial.newsletters;
begin
 n:=rcg_private.editorial_access(p_id);
 return jsonb_build_object('newsletter',to_jsonb(n),'versions',coalesce((select jsonb_agg(to_jsonb(v) order by v.number desc)
  from (
   select * from (select * from rcg_private.newsletter_versions where newsletter_id=n.id order by number desc limit 100) recent
   union
   select * from rcg_private.newsletter_versions where newsletter_id=n.id and id in (n.published_revision,n.working_revision)
  ) v),'[]'),
  'history',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'revisionId',a.revision_id,'action',a.action,'actor',a.actor_label,'note',a.note,'at',a.created_at,
   'emailState',case when exists(select 1 from rcg_private.newsletter_email_outbox e where e.audit_id=a.id and e.state='sent') then 'sent'
    when exists(select 1 from rcg_private.newsletter_email_outbox e where e.audit_id=a.id) then 'pending_configuration' else 'not_requested' end) order by a.created_at desc)
   from (select * from rcg_private.newsletter_editorial_audit where newsletter_id=n.id order by created_at desc limit 200) a),'[]'));
end $$;

create or replace function red_conexion_gerencial.editorial_my_work()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not red_conexion_gerencial.is_member() then raise exception 'Acceso denegado' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(n)||v.content||jsonb_build_object('status',case when n.visibility in ('hidden','archived') then n.status else v.state end,'revision_id',v.id,'revision_number',v.number,'has_publication',n.published_revision is not null,
  'can_delete_draft',n.published_revision is null and n.status='borrador' and not exists(select 1 from rcg_private.newsletter_versions submitted where submitted.newsletter_id=n.id and submitted.submitted_at is not null)))
  from red_conexion_gerencial.newsletters n join rcg_private.newsletter_versions v on v.id=coalesce(n.working_revision,n.latest_revision)
  where n.author_user_id=auth.uid() or n.author_id=red_conexion_gerencial.current_person_id()),'[]');
end $$;

create or replace function red_conexion_gerencial.editorial_list(p_tray text default 'pending',p_filters jsonb default '{}')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; page integer:=greatest(1,least(coalesce((p_filters->>'page')::int,1),100000)); size integer:=greatest(1,least(coalesce((p_filters->>'pageSize')::int,12),100));
begin
 if not red_conexion_gerencial.is_admin() then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if p_tray not in ('pending','changes','published','retired','all') then raise exception 'Bandeja inválida' using errcode='22023'; end if;
 with base as (
  select n.*,coalesce(p.given_name||' '||p.family_name,'Administración de la Red') as author_name,coalesce(p.position_title,'Equipo administrador') as author_role,
   coalesce(p.ministry,'Red de Conexión Gerencial') as author_ministry,coalesce(p.directorate,p.secretariat,'') as author_unit,
   w.state as work_state,w.id as work_id,w.request_type,coalesce(w.submitted_at,n.updated_at) as sent_at,
   case when p_tray in ('pending','changes') or n.published_revision is null then coalesce(w.content,l.content) else rcg_private.newsletter_content(n) end as content,
   (select jsonb_build_object('action',a.action,'note',a.note,'actor',a.actor_label,'at',a.created_at) from rcg_private.newsletter_editorial_audit a where a.newsletter_id=n.id order by a.created_at desc limit 1) as last_event
  from red_conexion_gerencial.newsletters n left join red_conexion_gerencial.people p on p.id=n.author_id
   left join rcg_private.newsletter_versions w on w.id=n.working_revision
   left join rcg_private.newsletter_versions l on l.id=n.latest_revision
 ), filtered as (
  select * from base b where
   (p_tray='all' or p_tray='pending' and work_state='pendiente' and visibility not in ('hidden','archived')
    or p_tray='changes' and work_state='cambios' and visibility not in ('hidden','archived')
    or p_tray='published' and visibility='visible' or p_tray='retired' and visibility in ('hidden','archived'))
   and (coalesce(p_filters->>'query','')='' or rcg_private.admin_norm(content->>'title'||' '||coalesce(content->>'body','')||' '||author_name||' '||author_ministry) like '%'||rcg_private.admin_norm(p_filters->>'query')||'%')
   and (coalesce(p_filters->>'topic','')='' or content->>'topic'=p_filters->>'topic')
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
  'topics',coalesce((select jsonb_agg(distinct content->>'topic') from base),'[]'),
  'ministries',coalesce((select jsonb_agg(distinct author_ministry) from base),'[]'),
  'authors',coalesce((select jsonb_agg(a) from (select distinct coalesce(author_user_id::text,author_id::text,'institutional') as id,author_name as name from base) a),'[]'),
  'emailConfigured',false) into result;
 return result;
end $$;

create or replace function red_conexion_gerencial.editorial_delete_draft(p_id uuid,p_expected integer)
returns void language plpgsql security definer set search_path='' as $$
declare n red_conexion_gerencial.newsletters;
begin
 perform pg_advisory_xact_lock(905319118); n:=rcg_private.editorial_access(p_id);
 if n.version is distinct from p_expected then raise exception 'El newsletter cambió' using errcode='40001'; end if;
 if n.published_revision is not null or n.status<>'borrador' or exists(select 1 from rcg_private.newsletter_versions where newsletter_id=n.id and submitted_at is not null) then
  raise exception 'La eliminación definitiva de publicaciones no está habilitada. Usá Archivar.' using errcode='42501'; end if;
 perform rcg_private.editorial_log(n,n.latest_revision,'draft_deleted','Borrador no enviado',to_jsonb(n),'{}');
 delete from red_conexion_gerencial.newsletters where id=n.id;
end $$;

-- Existing entry point cannot bypass the new version/visibility transaction.
create or replace function red_conexion_gerencial.review_newsletter(target_id uuid,expected_version integer,new_status text,new_note text default null,make_featured boolean default false)
returns red_conexion_gerencial.newsletters language plpgsql security definer set search_path='' as $$
declare n red_conexion_gerencial.newsletters;
begin
 n:=rcg_private.editorial_access(target_id,true);
 perform red_conexion_gerencial.editorial_decide(target_id,expected_version,n.working_revision,case new_status when 'archivado' then 'archive' else new_status end,coalesce(new_note,''),make_featured);
 select * into n from red_conexion_gerencial.newsletters where id=target_id; return n;
end $$;

-- All content/state writes now go through checked RPCs; direct SQL REST writes fail closed.
revoke insert,update,delete on red_conexion_gerencial.newsletters from authenticated;
revoke insert(author_id,title,subtitle,topic,summary,body,body_html,image_path,tags,reading_minutes,status),
 update(title,subtitle,topic,summary,body,body_html,image_path,tags,reading_minutes,status) on red_conexion_gerencial.newsletters from authenticated;
drop policy if exists rcg_images_read on storage.objects;
create policy rcg_images_read on storage.objects for select to authenticated using(
 bucket_id='rcg-newsletters' and red_conexion_gerencial.is_member() and
 (owner_id=auth.uid()::text or red_conexion_gerencial.is_admin()
  or exists(select 1 from red_conexion_gerencial.newsletters n where n.image_path=name and n.status='publicado')));
-- Historical covers cannot be deleted after replacement in the editor.
create or replace function red_conexion_gerencial.editorial_image_referenced(p_path text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from rcg_private.newsletter_versions where content->>'image_path'=p_path)
$$;
drop policy if exists rcg_images_delete_orphan on storage.objects;
create policy rcg_images_delete_orphan on storage.objects for delete to authenticated using(
 bucket_id='rcg-newsletters' and (owner_id=auth.uid()::text or red_conexion_gerencial.is_admin())
 and not red_conexion_gerencial.editorial_image_referenced(name));

do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where (n.nspname='rcg_private' and p.proname in ('newsletter_content','editorial_access','editorial_log','editorial_project'))
    or (n.nspname='red_conexion_gerencial' and p.proname like 'editorial_%') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  if f.signature::text like 'red_conexion_gerencial.%' then execute format('grant execute on function %s to authenticated',f.signature); end if;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
