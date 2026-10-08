-- Prueba transaccional: crea únicamente un newsletter de prueba y lo revierte.
begin;
do $$
declare admin_id uuid;
begin
  select user_id into admin_id from red_conexion_gerencial.admin_users where is_active limit 1;
  if admin_id is null then raise exception 'Falta administrador de prueba'; end if;
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
end;
$$;
set local role authenticated;
do $$
declare test_id uuid; result_html text; denied boolean := false;
begin
  insert into red_conexion_gerencial.newsletters(author_id, title, topic, body, body_html, status)
  values (red_conexion_gerencial.current_person_id(), 'Prueba transaccional de formato', 'Gestión', 'Texto con formato',
    '<p>Texto con <strong>formato</strong> y <a href="https://example.com">enlace</a></p>', 'borrador')
  returning id into test_id;
  select body_html into result_html from red_conexion_gerencial.newsletters where id = test_id;
  if result_html not like '%<strong>formato</strong>%' then raise exception 'El formato no se guardó'; end if;
  update red_conexion_gerencial.newsletters set body = 'Texto con formato nuevo', body_html = '<h2>Texto con formato nuevo</h2>' where id = test_id;
  if not exists(select 1 from red_conexion_gerencial.newsletters where id = test_id and body_html = '<h2>Texto con formato nuevo</h2>') then raise exception 'No se pudo editar el formato'; end if;
  update red_conexion_gerencial.newsletters set status = 'publicado' where id = test_id;
  if not exists(select 1 from red_conexion_gerencial.newsletters where id = test_id and body_html = '<h2>Texto con formato nuevo</h2>' and published_at is not null) then raise exception 'Publicar no conserva el formato'; end if;
  begin
    update red_conexion_gerencial.newsletters set body_html = repeat('a', 60001) where id = test_id;
  exception when check_violation then denied := true;
  end;
  if not denied then raise exception 'No existe límite de formato'; end if;
  update red_conexion_gerencial.newsletters set body = 'Texto actualizado por cliente anterior' where id = test_id;
  if exists(select 1 from red_conexion_gerencial.newsletters where id = test_id and body_html is not null) then raise exception 'El formato del cliente anterior quedó desactualizado'; end if;
end;
$$;
reset role;
select true as rich_text_roundtrip_passed,
  has_column_privilege('authenticated', 'red_conexion_gerencial.newsletters', 'body_html', 'INSERT') as can_create_format,
  has_column_privilege('authenticated', 'red_conexion_gerencial.newsletters', 'body_html', 'UPDATE') as can_edit_format,
  not has_table_privilege('anon', 'red_conexion_gerencial.newsletters', 'SELECT') as anonymous_read_denied,
  not has_column_privilege('authenticated', 'red_conexion_gerencial.newsletters', 'author_user_id', 'UPDATE') as cannot_spoof_author;
rollback;
