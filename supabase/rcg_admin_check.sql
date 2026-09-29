-- Prueba de permisos y revisión. Todo se revierte al finalizar.
begin;
do $$
declare
  test_user auth.users;
  test_person uuid;
  test_newsletter uuid := gen_random_uuid();
begin
  select u.* into test_user
  from auth.users u
  join red_conexion_gerencial.people p on lower(u.email) = lower(p.email)
  where u.email_confirmed_at is not null and p.is_active
  limit 1;
  if test_user.id is null then raise exception 'No hay usuario confirmado para la prueba'; end if;
  select id into test_person from red_conexion_gerencial.people
  where lower(email) = lower(test_user.email);
  insert into red_conexion_gerencial.admin_users (user_id, email)
  values (test_user.id, test_user.email);
  insert into red_conexion_gerencial.newsletters
    (id, author_id, title, topic, body, status)
  values (test_newsletter, test_person, 'Prueba editorial transaccional',
          'Procesos', 'Contenido de prueba', 'pendiente');
  perform set_config('request.jwt.claim.sub', test_user.id::text, true);
  perform set_config('rcg.test_newsletter_id', test_newsletter::text, true);
end;
$$;
set local role authenticated;
do $$
declare
  test_id uuid := current_setting('rcg.test_newsletter_id')::uuid;
  current_version integer;
  test_directorate uuid;
  test_person uuid;
begin
  if not red_conexion_gerencial.is_admin() then raise exception 'El rol de prueba no es administrador'; end if;
  insert into red_conexion_gerencial.directorates (name, ministry)
  values ('Dirección General de Prueba Transaccional', 'Organismo de Prueba')
  returning id into test_directorate;
  insert into red_conexion_gerencial.people
    (source_sheet, source_row, given_name, family_name, position_title,
     ministry, directorate_id, phone, email)
  values ('Web', null, 'Persona', 'De Prueba', 'Cargo de prueba',
          'Organismo de Prueba', test_directorate, '',
          'rcg-' || gen_random_uuid()::text || '@example.invalid')
  returning id into test_person;
  update red_conexion_gerencial.people set bio = 'Actualización de prueba'
  where id = test_person;
  if not found then raise exception 'No se pudo actualizar el perfil'; end if;
  delete from red_conexion_gerencial.people where id = test_person;
  if not found then raise exception 'No se pudo eliminar el perfil'; end if;
  delete from red_conexion_gerencial.directorates where id = test_directorate;
  if not found then raise exception 'No se pudo eliminar la dirección'; end if;
  select version into current_version from red_conexion_gerencial.newsletters where id = test_id;
  perform red_conexion_gerencial.review_newsletter(test_id, current_version, 'publicado', null, true);
  if not exists (select 1 from red_conexion_gerencial.newsletters
                 where id = test_id and status = 'publicado' and featured) then
    raise exception 'No se publicó o destacó el newsletter';
  end if;
  select version into current_version from red_conexion_gerencial.newsletters where id = test_id;
  perform red_conexion_gerencial.review_newsletter(test_id, current_version, 'archivado', null, false);
  if not exists (select 1 from red_conexion_gerencial.newsletters
                 where id = test_id and status = 'archivado') then
    raise exception 'No se archivó el newsletter';
  end if;
end;
$$;
select true as admin_review_passed;
rollback;
