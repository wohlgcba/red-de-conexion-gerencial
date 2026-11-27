-- Apply after rcg_editorial.sql. Legacy publications default to Compartí con la Red.
begin;

alter table red_conexion_gerencial.newsletters
  add column if not exists portal_section text not null default 'comparti-con-la-red' check (portal_section in (
    'conocimiento-en-red', 'red-en-practica', 'caja-de-herramientas', 'espacio-de-aprendizaje', 'radar-gerencial', 'comparti-con-la-red'
  )),
  add column if not exists attachments jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rcg-portal-attachments', 'rcg-portal-attachments', false, 26214400, array[
  'application/pdf', 'application/msword', 'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg', 'image/png', 'image/webp'
])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function rcg_private.portal_attachment_mime(p_path text)
returns text language sql immutable set search_path = '' as $$
  select case substring(p_path from '[.]([a-z]+)$')
    when 'pdf' then 'application/pdf'
    when 'doc' then 'application/msword'
    when 'docx' then 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    when 'ppt' then 'application/vnd.ms-powerpoint'
    when 'pptx' then 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    when 'png' then 'image/png'
    when 'webp' then 'image/webp'
    when 'jpeg' then 'image/jpeg'
    when 'jpg' then 'image/jpeg'
  end
$$;

create or replace function rcg_private.portal_attachment_matches(p_files jsonb, p_path text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p_files @> jsonb_build_array(jsonb_build_object('path', p_path))
    or p_files @> jsonb_build_array(jsonb_build_object('previewPath', p_path)), false)
$$;

create or replace function red_conexion_gerencial.portal_attachment_referenced(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select split_part(p_path, '/', 1) = auth.uid()::text and exists(
    select 1 from rcg_private.newsletter_versions v where rcg_private.portal_attachment_matches(v.content->'attachments', p_path)
  )
$$;

create or replace function red_conexion_gerencial.portal_attachment_readable(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select red_conexion_gerencial.is_member() and (
    split_part(p_path, '/', 1) = auth.uid()::text
    or exists (
      select 1 from red_conexion_gerencial.newsletters n
      where n.visibility = 'visible' and n.status = 'publicado'
        and rcg_private.portal_attachment_matches(n.attachments, p_path)
    )
    or exists (
      select 1 from rcg_private.newsletter_versions v
      join red_conexion_gerencial.newsletters n on n.id = v.newsletter_id
      where (red_conexion_gerencial.is_admin() or n.author_user_id = auth.uid()
        or n.author_id = red_conexion_gerencial.current_person_id())
      and rcg_private.portal_attachment_matches(v.content->'attachments', p_path)
    )
  )
$$;

create or replace function rcg_private.validate_portal_attachments(p_id uuid, p_files jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  f jsonb;
  file_path text;
  preview_path text;
  mime text;
  object_path text;
  used_paths text[] := '{}';
begin
  if jsonb_typeof(p_files) is distinct from 'array' then
    raise exception 'La lista de archivos es inválida' using errcode = '22023';
  end if;
  if jsonb_array_length(p_files) > 5 then
    raise exception 'Podés adjuntar hasta cinco archivos' using errcode = '22023';
  end if;
  for f in select value from jsonb_array_elements(p_files) loop
    if jsonb_typeof(f) is distinct from 'object' then
      raise exception 'Datos de archivo inválidos' using errcode = '22023';
    end if;
    file_path := f->>'path';
    preview_path := f->>'previewPath';
    mime := rcg_private.portal_attachment_mime(file_path);
    if (f - array['path','name','mime','previewPath']) <> '{}'::jsonb
      or jsonb_typeof(f->'name') is distinct from 'string'
      or length(trim(f->>'name')) not between 1 and 200
      or mime is null or mime is distinct from f->>'mime'
      or (mime not like 'image/%' and mime <> 'application/pdf') <> (preview_path is not null)
      or (preview_path is not null and rcg_private.portal_attachment_mime(preview_path) is distinct from 'application/pdf') then
      raise exception 'Revisá el formato y la vista previa de los archivos' using errcode = '22023';
    end if;
    foreach object_path in array array_remove(array[file_path, preview_path], null) loop
      if object_path = any(used_paths) or object_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.][a-z]+$' then
        raise exception 'Ruta de archivo inválida o repetida' using errcode = '22023';
      end if;
      if split_part(object_path, '/', 1) <> auth.uid()::text and not exists (
        select 1 from rcg_private.newsletter_versions v where v.newsletter_id = p_id
          and rcg_private.portal_attachment_matches(v.content->'attachments', object_path)
      ) then
        raise exception 'El archivo no pertenece a esta publicación o cuenta' using errcode = '42501';
      end if;
      perform 1 from storage.objects o where o.bucket_id = 'rcg-portal-attachments' and o.name = object_path
        and o.metadata->>'mimetype' = rcg_private.portal_attachment_mime(object_path);
      if not found then
        raise exception 'El archivo adjunto no está disponible' using errcode = '22023';
      end if;
      used_paths := array_append(used_paths, object_path);
    end loop;
  end loop;
end $$;

revoke all on function rcg_private.portal_attachment_mime(text), rcg_private.portal_attachment_matches(jsonb,text),
  rcg_private.validate_portal_attachments(uuid,jsonb), red_conexion_gerencial.portal_attachment_readable(text),
  red_conexion_gerencial.portal_attachment_referenced(text) from public, anon, authenticated, service_role;
grant execute on function red_conexion_gerencial.portal_attachment_readable(text),
  red_conexion_gerencial.portal_attachment_referenced(text) to authenticated;

drop policy if exists rcg_portal_attachments_read on storage.objects;
create policy rcg_portal_attachments_read on storage.objects for select to authenticated
  using (bucket_id = 'rcg-portal-attachments' and red_conexion_gerencial.portal_attachment_readable(name));
drop policy if exists rcg_portal_attachments_upload on storage.objects;
create policy rcg_portal_attachments_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'rcg-portal-attachments' and red_conexion_gerencial.is_member()
    and split_part(name, '/', 1) = auth.uid()::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](pdf|doc|docx|ppt|pptx|jpg|jpeg|png|webp)$');
drop policy if exists rcg_portal_attachments_delete_orphan on storage.objects;
create policy rcg_portal_attachments_delete_orphan on storage.objects for delete to authenticated
  using (bucket_id = 'rcg-portal-attachments' and red_conexion_gerencial.is_member()
    and split_part(name, '/', 1) = auth.uid()::text and not red_conexion_gerencial.portal_attachment_referenced(name));

create or replace function red_conexion_gerencial.guard_newsletter()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.status in ('pendiente', 'publicado') and length(trim(new.body)) = 0 and jsonb_array_length(new.attachments) = 0 then
    raise exception 'El contenido es obligatorio para enviar o publicar';
  end if;

  if tg_op = 'INSERT' and current_user <> 'postgres' then
    if not red_conexion_gerencial.is_member() then
      raise exception 'Acceso denegado';
    end if;
    if new.author_id is distinct from red_conexion_gerencial.current_person_id() then
      raise exception 'La autoría debe corresponder a la cuenta autenticada';
    end if;
    -- El cliente no puede elegir ni suplantar el usuario propietario.
    new.author_user_id := (select auth.uid());
    if not red_conexion_gerencial.is_admin()
       and new.status not in ('borrador', 'pendiente') then
      raise exception 'Solo la administración puede publicar sin revisión';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.author_id is distinct from old.author_id
       or new.author_user_id is distinct from old.author_user_id then
      raise exception 'No se puede cambiar la autoría';
    end if;
    if current_user <> 'postgres' and not red_conexion_gerencial.is_admin() then
      if old.author_id is distinct from red_conexion_gerencial.current_person_id()
         or old.status not in ('borrador', 'cambios')
         or new.status not in ('borrador', 'pendiente') then
        raise exception 'Transición editorial no permitida';
      end if;
    end if;
    new.updated_at := now();
    new.version := old.version + 1;
  end if;

  if current_user <> 'postgres' and not red_conexion_gerencial.is_admin()
     and new.image_path is not null
     and split_part(new.image_path, '/', 1) <> (select auth.uid())::text then
    raise exception 'La portada no pertenece al usuario';
  end if;

  if new.status = 'publicado' then
    if tg_op = 'INSERT' then
      new.published_at := now();
      new.reviewed_by := (select auth.uid());
    elsif old.status <> 'publicado' then
      new.published_at := coalesce(old.published_at, now());
      new.reviewed_by := (select auth.uid());
    end if;
  else
    new.featured := false;
  end if;
  return new;
end;
$$;

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
  portal_section=coalesce(v.content->>'portal_section','comparti-con-la-red'),
  attachments=coalesce(v.content->'attachments','[]'::jsonb),
  status=projected_status,featured=featured and projected_status='publicado' where id=n.id;
end $$;

create or replace function red_conexion_gerencial.editorial_save(p_id uuid,p_expected integer,p_content jsonb,p_intent text,p_note text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare n red_conexion_gerencial.newsletters; prior rcg_private.newsletter_versions; v uuid; seq integer; state text;
 admin boolean:=red_conexion_gerencial.is_admin(); kind text; before_value jsonb; section text; files jsonb;
begin
 if auth.uid() is null or not red_conexion_gerencial.is_member() then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if p_intent is null or p_intent not in ('borrador','pendiente','publicado','minor') or p_intent in ('publicado','minor') and not admin then
  raise exception 'Transición editorial no permitida' using errcode='42501'; end if;
 if p_note is null or length(p_note)>3000 or p_intent='minor' and length(trim(p_note))<10 then raise exception 'Justificá la edición menor (mínimo 10 caracteres)' using errcode='22023'; end if;
 if jsonb_typeof(p_content) is distinct from 'object' or (p_content-array['title','subtitle','topic','summary','body','body_html','image_path','tags','reading_minutes','portal_section','attachments'])<>'{}'::jsonb
  or length(trim(coalesce(p_content->>'title',''))) not between 1 and 100 or length(coalesce(p_content->>'subtitle',''))>160
  or length(trim(coalesce(p_content->>'topic','')))=0 or length(coalesce(p_content->>'topic',''))>100
  or length(coalesce(p_content->>'summary',''))>1000 or length(coalesce(p_content->>'body',''))>5000
  or length(coalesce(p_content->>'body_html',''))>60000 or jsonb_typeof(p_content->'tags') is distinct from 'array'
  or jsonb_array_length(p_content->'tags')>20 or (p_content->>'reading_minutes')::int not between 1 and 120 then
  raise exception 'Revisá título, temática, contenido y límites del newsletter' using errcode='22023'; end if;
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
 section:=coalesce(p_content->>'portal_section',prior.content->>'portal_section',n.portal_section,'comparti-con-la-red');
 if section not in ('conocimiento-en-red','red-en-practica','caja-de-herramientas','espacio-de-aprendizaje','radar-gerencial','comparti-con-la-red') then
  raise exception 'Sección del Portal inválida' using errcode='22023';
 end if;
 if not admin and (section<>'comparti-con-la-red' or n.portal_section<>'comparti-con-la-red'
     or prior.content->>'portal_section'<>'comparti-con-la-red') then
  raise exception 'Solo Administración puede publicar o editar en esa sección' using errcode='42501';
 end if;
 if p_intent in ('pendiente','publicado') and trim(p_content->>'topic')='Sin temática' then
  raise exception 'Elegí un eje temático antes de enviar o publicar' using errcode='22023';
 end if;
 files:=coalesce(p_content->'attachments',prior.content->'attachments','[]'::jsonb);
 perform rcg_private.validate_portal_attachments(n.id,files);
 if p_intent<>'borrador' and length(trim(coalesce(p_content->>'body','')))=0 and jsonb_array_length(files)=0 then
  raise exception 'Agregá contenido o adjuntá un archivo' using errcode='22023';
 end if;
 p_content:=p_content || jsonb_build_object('portal_section',section,'attachments',files);
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

notify pgrst,'reload schema';
commit;
