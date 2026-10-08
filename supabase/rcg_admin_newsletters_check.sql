-- Pruebas transaccionales de permisos: ningún registro de prueba se conserva.
begin;
do $$
declare
  admin_id uuid;
  member_id uuid;
begin
  select a.user_id into admin_id from red_conexion_gerencial.admin_users a
  join auth.users u on u.id = a.user_id
  where a.is_active and u.email_confirmed_at is not null limit 1;
  select a.auth_user_id into member_id from red_conexion_gerencial.member_accounts a
  join red_conexion_gerencial.people p on p.id = a.person_id
  join auth.users u on u.id = a.auth_user_id
  where p.is_active and not a.must_change_password and u.email_confirmed_at is not null
    and not exists (select 1 from red_conexion_gerencial.admin_users x
                    where x.user_id = a.auth_user_id and x.is_active) limit 1;
  if admin_id is null or member_id is null then raise exception 'Faltan cuentas para verificar permisos'; end if;
  perform set_config('rcg.test_member', member_id::text, true);
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
end;
$$;
set local role authenticated;
do $$
declare
  test_id uuid;
  draft_id uuid;
  item red_conexion_gerencial.newsletters;
  changed integer;
begin
  if not red_conexion_gerencial.is_admin() then raise exception 'Administrador no reconocido'; end if;
  insert into red_conexion_gerencial.newsletters(author_id, title, topic, body, status)
  values (red_conexion_gerencial.current_person_id(), 'PRUEBA: publicación administrativa', 'Gestión', 'Contenido de prueba', 'publicado')
  returning * into item;
  test_id := item.id;
  if item.author_user_id is distinct from auth.uid() or item.published_at is null
     or item.reviewed_by is distinct from auth.uid() then
    raise exception 'No se registró identidad o auditoría de publicación';
  end if;
  insert into red_conexion_gerencial.newsletters(author_id, title, topic, body, status)
  values (red_conexion_gerencial.current_person_id(), 'PRUEBA: borrador administrativo', 'Gestión', 'Contenido de prueba', 'borrador')
  returning id into draft_id;
  update red_conexion_gerencial.newsletters set status = 'publicado'
  where id = draft_id and version = 1;
  if not found then raise exception 'No se pudo publicar el borrador'; end if;
  update red_conexion_gerencial.newsletters set title = 'PRUEBA: versión obsoleta'
  where id = draft_id and version = 1;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Falló el control de concurrencia'; end if;
  perform set_config('rcg.test_published', test_id::text, true);
end;
$$;
reset role;
do $$
begin
  perform set_config('request.jwt.claim.sub', current_setting('rcg.test_member'), true);
  perform set_config('request.jwt.claims', json_build_object('sub', current_setting('rcg.test_member'), 'role', 'authenticated')::text, true);
end;
$$;
set local role authenticated;
do $$
declare
  item red_conexion_gerencial.newsletters;
  denied boolean;
begin
  if red_conexion_gerencial.is_admin() or red_conexion_gerencial.current_person_id() is null then
    raise exception 'Integrante de prueba inválido';
  end if;
  insert into red_conexion_gerencial.newsletters(author_id, title, topic, body, status)
  values (red_conexion_gerencial.current_person_id(), 'PRUEBA: revisión de integrante', 'Gestión', 'Contenido de prueba', 'pendiente')
  returning * into item;
  if item.author_user_id is distinct from auth.uid() or item.published_at is not null then
    raise exception 'Se alteró el flujo de revisión del integrante';
  end if;
  denied := false;
  begin
    insert into red_conexion_gerencial.newsletters(author_id, title, topic, body, status)
    values (red_conexion_gerencial.current_person_id(), 'PRUEBA: publicación prohibida', 'Gestión', 'Contenido', 'publicado');
  exception when others then
    if sqlerrm not like '%Solo la administración%' then raise; end if;
    denied := true;
  end;
  if not denied then raise exception 'El integrante pudo publicar sin revisión'; end if;
  denied := false;
  begin
    insert into red_conexion_gerencial.newsletters(author_id, title, topic, body, status)
    values (null, 'PRUEBA: suplantación institucional', 'Gestión', 'Contenido', 'borrador');
  exception when others then
    if sqlerrm not like '%autoría debe corresponder%' then raise; end if;
    denied := true;
  end;
  if not denied then raise exception 'El integrante pudo usar autoría institucional'; end if;
  insert into red_conexion_gerencial.newsletters(author_id, title, topic, body, status)
  values (red_conexion_gerencial.current_person_id(), 'PRUEBA: borrador de integrante', 'Gestión', 'Contenido', 'borrador') returning * into item;
  denied := false;
  begin
    update red_conexion_gerencial.newsletters set status = 'publicado' where id = item.id;
  exception when others then
    if sqlerrm not like '%Transición editorial no permitida%' then raise; end if;
    denied := true;
  end;
  if not denied then raise exception 'El integrante pudo autopublicar un borrador'; end if;
  if not exists (select 1 from red_conexion_gerencial.newsletters where id = current_setting('rcg.test_published')::uuid) then
    raise exception 'El integrante no puede leer la publicación administrativa';
  end if;
end;
$$;
select true as admin_publish_and_member_review_checks_passed;
rollback;
