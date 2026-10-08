-- Prueba transaccional: revierte fotos y objetos de prueba, sin subir archivos.
begin;
do $$
declare
  admin_id uuid;
  member_id uuid;
  admin_path text;
  second_path text;
  member_path text;
begin
  select user_id into admin_id from red_conexion_gerencial.admin_users where is_active limit 1;
  select a.auth_user_id into member_id from red_conexion_gerencial.member_accounts a
  join red_conexion_gerencial.people p on p.id = a.person_id
  where p.is_active and not a.must_change_password
    and not exists(select 1 from red_conexion_gerencial.admin_users x where x.user_id = a.auth_user_id and x.is_active) limit 1;
  if admin_id is null or member_id is null then raise exception 'Faltan cuentas de prueba'; end if;
  admin_path := admin_id::text || '/' || gen_random_uuid()::text || '.jpg';
  second_path := admin_id::text || '/' || gen_random_uuid()::text || '.jpg';
  member_path := member_id::text || '/' || gen_random_uuid()::text || '.jpg';
  insert into storage.objects(bucket_id, name, owner_id) values
    ('rcg-profile-photos', admin_path, admin_id::text), ('rcg-profile-photos', second_path, admin_id::text), ('rcg-profile-photos', member_path, member_id::text);
  perform set_config('rcg.photo_admin_path', admin_path, true);
  perform set_config('rcg.photo_second_path', second_path, true);
  perform set_config('rcg.photo_member_path', member_path, true);
  perform set_config('rcg.photo_member_id', member_id::text, true);
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
end;
$$;
set local role authenticated;
do $$
declare
  previous_version integer;
  denied boolean := false;
  delete_condition text;
  can_delete boolean;
begin
  select coalesce(max(version), 0) into previous_version from red_conexion_gerencial.profile_photos where user_id = auth.uid();
  perform red_conexion_gerencial.save_my_profile_photo(current_setting('rcg.photo_admin_path'), previous_version);
  if not exists(select 1 from red_conexion_gerencial.profile_photos where user_id = auth.uid() and version = previous_version + 1) then
    raise exception 'No se pudo guardar la foto del administrador';
  end if;
  begin
    perform red_conexion_gerencial.save_my_profile_photo(current_setting('rcg.photo_second_path'), previous_version);
  exception when others then
    if sqlerrm not like '%foto cambió%' then raise; end if;
    denied := true;
  end;
  if not denied then raise exception 'Falló el control de concurrencia de fotos'; end if;
  -- Storage prohíbe DELETE SQL directo. Verificar su política sin borrar objetos.
  select qual into delete_condition from pg_policies
  where schemaname = 'storage' and tablename = 'objects' and policyname = 'rcg_profile_images_delete';
  if delete_condition is null then raise exception 'Falta protección de fotos en uso'; end if;
  execute format('select exists(select 1 from storage.objects where name = %L and (%s))',
    current_setting('rcg.photo_admin_path'), delete_condition) into can_delete;
  if can_delete then raise exception 'Se puede eliminar una foto en uso'; end if;
end;
$$;
reset role;
do $$
begin
  perform set_config('request.jwt.claim.sub', current_setting('rcg.photo_member_id'), true);
  perform set_config('request.jwt.claims', json_build_object('sub', current_setting('rcg.photo_member_id'), 'role', 'authenticated')::text, true);
end;
$$;
set local role authenticated;
do $$
declare
  denied boolean := false;
  previous_version integer;
begin
  select coalesce(max(version), 0) into previous_version from red_conexion_gerencial.profile_photos where user_id = auth.uid();
  begin
    perform red_conexion_gerencial.save_my_profile_photo(current_setting('rcg.photo_admin_path'), previous_version);
  exception when others then
    if sqlerrm not like '%imagen no pertenece%' then raise; end if;
    denied := true;
  end;
  if not denied then raise exception 'Se pudo usar una imagen ajena'; end if;
  perform red_conexion_gerencial.save_my_profile_photo(current_setting('rcg.photo_member_path'), previous_version);
  if not exists(select 1 from red_conexion_gerencial.profile_photos where user_id = auth.uid() and person_id = red_conexion_gerencial.current_person_id()) then
    raise exception 'La foto no se vinculó al integrante';
  end if;
  denied := false;
  begin
    update red_conexion_gerencial.profile_photos set image_path = current_setting('rcg.photo_admin_path') where user_id = auth.uid();
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Se permite escritura directa no autorizada'; end if;
end;
$$;
reset role;
select not public as private_bucket,
  not has_table_privilege('anon', 'red_conexion_gerencial.profile_photos', 'SELECT') as anonymous_read_denied,
  true as profile_photo_permissions_passed
from storage.buckets where id = 'rcg-profile-photos';
rollback;
