-- Verificación posterior a rcg_crud.sql; no devuelve datos personales.
do $$
begin
  if (select count(*) from red_conexion_gerencial.people) < 590 then
    raise exception 'Faltan registros del directorio';
  end if;
  if (select count(*) from red_conexion_gerencial.admin_users where is_active) <> 1 then
    raise exception 'Debe existir exactamente un administrador activo';
  end if;
  if has_schema_privilege('anon', 'red_conexion_gerencial', 'USAGE')
     or has_table_privilege('anon', 'red_conexion_gerencial.people', 'SELECT') then
    raise exception 'El rol anon tiene acceso al directorio';
  end if;
  if has_table_privilege('authenticated', 'red_conexion_gerencial.admin_users', 'SELECT') then
    raise exception 'La lista de administradores no debe exponerse';
  end if;
  if not has_schema_privilege('authenticated', 'red_conexion_gerencial', 'USAGE') then
    raise exception 'Falta acceso al schema para usuarios autenticados';
  end if;
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'red_conexion_gerencial' and c.relkind = 'r'
      and not c.relrowsecurity
  ) then
    raise exception 'Hay una tabla sin RLS';
  end if;
  if exists (select 1 from storage.buckets where id = 'rcg-newsletters' and public) then
    raise exception 'El bucket de newsletters no es privado';
  end if;
end;
$$;

select
  (select count(*) from red_conexion_gerencial.people) as people,
  (select count(*) from red_conexion_gerencial.directorates) as directorates,
  (select count(*) from red_conexion_gerencial.newsletters) as newsletters,
  (select count(*) from red_conexion_gerencial.admin_users where is_active) as active_admins,
  (select not public from storage.buckets where id = 'rcg-newsletters') as private_cover_bucket;
