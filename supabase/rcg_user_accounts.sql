-- Cuentas de la Red. Supabase Auth es compartido con Hub Red de Enlaces.
-- No almacenar CUIT ni contraseñas en este schema: Auth conserva solo el hash.
begin;

create table if not exists red_conexion_gerencial.member_accounts (
  person_id uuid primary key references red_conexion_gerencial.people(id) on delete cascade,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  password_changed_at timestamptz
);

alter table red_conexion_gerencial.member_accounts enable row level security;
revoke all on red_conexion_gerencial.member_accounts from public, anon, authenticated, service_role;

-- Las cuentas ya existentes en BASE GCBA conservan sus claves de Hub.
insert into red_conexion_gerencial.member_accounts
  (person_id, auth_user_id, must_change_password)
select p.id, u.id, false
from red_conexion_gerencial.people p
join auth.users u on lower(trim(u.email)) = lower(trim(p.email))
where u.email_confirmed_at is not null
on conflict do nothing;

create or replace function red_conexion_gerencial.get_my_account_status()
returns table (person_id uuid, must_change_password boolean)
language sql stable security definer set search_path = ''
as $$
  select a.person_id, a.must_change_password
  from red_conexion_gerencial.member_accounts a
  join red_conexion_gerencial.people p on p.id = a.person_id
  join auth.users u on u.id = a.auth_user_id
  where a.auth_user_id = (select auth.uid())
    and p.is_active
    and u.email_confirmed_at is not null
  limit 1;
$$;

revoke all on function red_conexion_gerencial.get_my_account_status() from public, anon, authenticated, service_role;
grant execute on function red_conexion_gerencial.get_my_account_status() to authenticated;

-- Una cuenta nueva solo puede consultar el directorio después de cambiar su clave inicial.
create or replace function red_conexion_gerencial.current_person_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select a.person_id
  from red_conexion_gerencial.member_accounts a
  join red_conexion_gerencial.people p on p.id = a.person_id
  join auth.users u on u.id = a.auth_user_id
  where a.auth_user_id = (select auth.uid())
    and u.email_confirmed_at is not null
    and p.is_active
    and not a.must_change_password
  limit 1;
$$;

-- El estado se libera únicamente cuando Supabase Auth registra un cambio real del hash.
create or replace function red_conexion_gerencial.record_password_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.encrypted_password is distinct from new.encrypted_password then
    update red_conexion_gerencial.member_accounts
    set must_change_password = false,
        password_changed_at = now()
    where auth_user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists rcg_record_password_change on auth.users;
create trigger rcg_record_password_change
after update of encrypted_password on auth.users
for each row execute function red_conexion_gerencial.record_password_change();

revoke all on function red_conexion_gerencial.record_password_change() from public, anon, authenticated, service_role;

commit;
