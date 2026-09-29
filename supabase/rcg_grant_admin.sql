-- Definir rcg.admin_email en la misma sesión antes de ejecutar este archivo.
-- Ejecutar después de crear y confirmar la cuenta en Supabase Auth.
-- Nunca almacenar contraseñas en SQL ni en el frontend.
begin;
do $$
declare
  target_user uuid;
  target_email text := lower(nullif(current_setting('rcg.admin_email', true), ''));
begin
  if target_email is null then raise exception 'Falta rcg.admin_email'; end if;
  select id into target_user from auth.users
  where lower(email) = target_email and email_confirmed_at is not null;
  if target_user is null then
    raise exception 'La cuenta administradora todavía no existe o no está confirmada';
  end if;
  if exists (select 1 from red_conexion_gerencial.admin_users
             where is_active and user_id <> target_user) then
    raise exception 'Ya hay otro administrador activo; revisar antes de continuar';
  end if;
  insert into red_conexion_gerencial.admin_users (user_id, email, is_active)
  values (target_user, target_email, true)
  on conflict (user_id) do update
  set email = excluded.email, is_active = true;
end;
$$;
commit;
