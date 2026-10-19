-- Apply AFTER rcg_administration.sql. Public intake requires verified Auth ownership.
begin;
create table if not exists rcg_private.admin_notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null, message text not null, href text not null,
  created_at timestamptz not null default now(), read_at timestamptz,
  unique(user_id,event_key)
);
alter table rcg_private.admin_notifications enable row level security;
revoke all on rcg_private.admin_notifications from public,anon,authenticated,service_role;
create index if not exists admin_notifications_user on rcg_private.admin_notifications(user_id,created_at desc);

create or replace function rcg_private.admin_notify_request()
returns trigger language plpgsql security definer set search_path='' as $$
declare message text; event text:=new.id::text||':'||new.version::text;
begin
  if tg_op='INSERT' then
    insert into rcg_private.admin_notifications(user_id,event_key,message,href)
      select a.user_id,event||':new',case when new.kind='access' then 'Nueva solicitud de acceso al Directorio.' else 'Nueva solicitud de cambio de datos.' end,'/administracion'
      from red_conexion_gerencial.admin_users a join auth.users u on u.id=a.user_id
      where a.is_active and u.email_confirmed_at is not null and lower(a.email)=lower(u.email) on conflict do nothing;
  elsif new.status is distinct from old.status or new.exception_active is distinct from old.exception_active then
    message:=case when old.exception_active and not new.exception_active then 'Se revocó tu excepción. El acceso requiere una decisión administrativa independiente.'
      when new.status='approved' and new.kind='access' then 'Tu solicitud de acceso fue aprobada. Ya podés ingresar a la Red.'
      when new.status='approved' then 'Tu solicitud de cambio fue aprobada.' when new.status='rejected' then 'Tu solicitud fue rechazada. Consultá el detalle de la revisión.'
      when new.status='information' then 'La administración solicitó información adicional. Consultá tu solicitud.'
      else 'Tu solicitud está en revisión administrativa.' end;
    insert into rcg_private.admin_notifications(user_id,event_key,message,href)
      values(new.user_id,event,message,case when new.kind='access' then '/solicitar-acceso' else '/mi-cuenta' end) on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists admin_request_notifications on rcg_private.admin_requests;
create trigger admin_request_notifications after insert or update on rcg_private.admin_requests for each row execute function rcg_private.admin_notify_request();

create or replace function red_conexion_gerencial.get_my_notifications()
returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
  if auth.uid() is null then raise exception 'Acceso denegado' using errcode='42501'; end if;
  return jsonb_build_object('unreadCount',(select count(*) from rcg_private.admin_notifications where user_id=auth.uid() and read_at is null),
    'items',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'message',n.message,'href',n.href,'read',n.read_at is not null,'createdAt',n.created_at) order by n.created_at desc,n.id)
      from (select * from rcg_private.admin_notifications where user_id=auth.uid() order by (read_at is null) desc,created_at desc,id limit 50) n),'[]'));
end $$;
create or replace function red_conexion_gerencial.read_my_notifications(p_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$ begin
  if auth.uid() is null then raise exception 'Acceso denegado' using errcode='42501'; end if;
  update rcg_private.admin_notifications set read_at=coalesce(read_at,now()) where user_id=auth.uid() and (p_id is null or id=p_id);
end $$;

create or replace function red_conexion_gerencial.get_my_directory_requests()
returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
  if auth.uid() is null then raise exception 'Acceso denegado' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'kind',r.kind,'status',r.status,'field',r.field,
    'oldValue',r.old_value,'newValue',r.new_value,'reason',r.reason,'note',r.note,'createdAt',r.created_at,'version',r.version) order by r.created_at desc)
    from rcg_private.admin_requests r where r.user_id=auth.uid()),'[]');
end $$;

create or replace function red_conexion_gerencial.submit_access_request(p_given text,p_family text,p_role text,p_ministry text,p_identifier text,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); mail text; rid uuid; pid uuid; pv integer; last_request rcg_private.admin_requests;
  key text:=regexp_replace(coalesce(p_identifier,''),'[[:space:]-]','','g');
begin
  if actor is null then raise exception 'Verificá tu correo antes de solicitar el ingreso' using errcode='42501'; end if;
  select email into mail from auth.users where id=actor and email_confirmed_at is not null;
  if mail is null then raise exception 'Primero verificá tu correo electrónico' using errcode='42501'; end if;
  if not rcg_private.valid_link_key(key) then raise exception 'Revisá el CUIL/CUIT: debe tener 11 dígitos y un dígito verificador válido' using errcode='22023'; end if;
  if length(trim(coalesce(p_given,''))) not between 1 and 100 or length(trim(coalesce(p_family,''))) not between 1 and 100
    or length(trim(coalesce(p_role,''))) not between 1 and 200 or length(trim(coalesce(p_ministry,''))) not between 1 and 200
    or length(trim(coalesce(p_reason,''))) not between 10 and 3000 then raise exception 'Completá los datos y una justificación de al menos 10 caracteres' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(905319117);
  if exists(select 1 from red_conexion_gerencial.member_accounts where auth_user_id=actor)
    or exists(select 1 from red_conexion_gerencial.admin_users where user_id=actor and is_active) then
    raise exception 'Tu cuenta ya tiene un perfil o permisos de la Red. Ingresá o contactá a administración si tu acceso está suspendido.' using errcode='22023'; end if;
  select * into last_request from rcg_private.admin_requests where user_id=actor and kind='access' order by created_at desc limit 1 for update;
  if found and last_request.status in ('pending','reviewing','information') then return last_request.id; end if;
  if found and last_request.created_at>now()-interval '24 hours' then raise exception 'Ya enviaste una solicitud recientemente. Esperá 24 horas para volver a solicitarlo.' using errcode='22023'; end if;
  select p.id,p.version into pid,pv from red_conexion_gerencial.people p left join rcg_private.directory_link_keys k on k.person_id=p.id
    where lower(trim(p.email))=lower(trim(mail)) or k.link_key=key order by p.id limit 1;
  insert into rcg_private.admin_requests(kind,user_id,person_id,person_version,given_name,family_name,email,link_key,role,ministry,reason)
    values('access',actor,pid,pv,trim(p_given),trim(p_family),mail,key,trim(p_role),trim(p_ministry),trim(p_reason)) returning id into rid;
  insert into rcg_private.admin_access_states(user_id,state) values(actor,'pending') on conflict(user_id) do update set state='pending',updated_at=now();
  perform rcg_private.admin_log(rid,pid,'created',p_reason,'{}',jsonb_build_object('kind','access')); return rid;
end $$;

-- The applicant can answer a clarification without editing the original proposal/evidence.
create or replace function red_conexion_gerencial.reply_to_my_request(p_id uuid,p_version integer,p_message text)
returns void language plpgsql security definer set search_path='' as $$
declare r rcg_private.admin_requests;
begin
  if auth.uid() is null then raise exception 'Acceso denegado' using errcode='42501'; end if;
  select * into r from rcg_private.admin_requests where id=p_id and user_id=auth.uid() for update;
  if not found then raise exception 'Acceso denegado' using errcode='42501'; end if;
  if r.version is distinct from p_version or r.status<>'information' then raise exception 'La solicitud cambió' using errcode='40001'; end if;
  if length(trim(coalesce(p_message,''))) not between 10 and 3000 then raise exception 'Escribí una aclaración entre 10 y 3000 caracteres' using errcode='22023'; end if;
  perform rcg_private.admin_log(r.id,r.person_id,'applicant_reply',trim(p_message),'{}','{}');
  update rcg_private.admin_requests set status='reviewing',version=version+1,updated_at=now() where id=r.id;
  insert into rcg_private.admin_notifications(user_id,event_key,message,href)
    select user_id,r.id::text||':reply:'||(r.version+1)::text,'Un solicitante respondió al pedido de información.','/administracion'
      from red_conexion_gerencial.admin_users where is_active on conflict do nothing;
end $$;

-- Shared email remains Auth-owned; only own verified session may create/read requests.
revoke all on function rcg_private.admin_notify_request() from public,anon,authenticated,service_role;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='red_conexion_gerencial' and p.proname in ('get_my_notifications','read_my_notifications','get_my_directory_requests','submit_access_request','reply_to_my_request') loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
    execute format('grant execute on function %s to authenticated',f.signature);
  end loop;
end $$;
notify pgrst,'reload schema';
commit;
