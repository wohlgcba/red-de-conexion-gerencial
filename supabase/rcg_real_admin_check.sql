-- Verifica el administrador activo sin exponer su identidad ni modificar datos.
begin;
do $$
declare target_user uuid;
begin
  select user_id into target_user
  from red_conexion_gerencial.admin_users where is_active;
  if target_user is null then raise exception 'No hay administrador activo'; end if;
  perform set_config('request.jwt.claim.sub', target_user::text, true);
end;
$$;
set local role authenticated;
select
  red_conexion_gerencial.is_admin() as admin_access,
  red_conexion_gerencial.is_member() as member_access,
  (select count(*) from red_conexion_gerencial.people) as visible_people,
  (select count(*) from red_conexion_gerencial.directorates) as visible_directorates;
rollback;
