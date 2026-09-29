-- Solo lecturas, bajo el rol authenticated de un integrante ya confirmado.
begin;
do $$
declare member_id uuid;
begin
  select u.id into member_id
  from auth.users u
  join red_conexion_gerencial.people p on lower(u.email) = lower(p.email)
  where u.email_confirmed_at is not null and p.is_active
  limit 1;
  if member_id is null then raise exception 'No hay integrante confirmado para la prueba'; end if;
  perform set_config('request.jwt.claim.sub', member_id::text, true);
end;
$$;
set local role authenticated;
do $$
begin
  update red_conexion_gerencial.people set bio = bio
  where id = red_conexion_gerencial.current_person_id();
  if found then raise exception 'Un integrante pudo modificar el directorio'; end if;
  if has_table_privilege(current_user, 'red_conexion_gerencial.admin_users', 'SELECT') then
    raise exception 'Se expuso la lista de administradores';
  end if;
end;
$$;
select
  red_conexion_gerencial.is_member() as member_access,
  red_conexion_gerencial.is_admin() as admin_access,
  (select count(*) from red_conexion_gerencial.people) as visible_people,
  (select count(*) from red_conexion_gerencial.directorates) as visible_directorates,
  (select count(*) from red_conexion_gerencial.newsletters) as visible_newsletters;
rollback;
