-- Vincula únicamente las cuentas creadas por el provisionador de esta Red.
-- El marcador de app_metadata solo puede escribirlo la API administrativa.
insert into red_conexion_gerencial.member_accounts
  (person_id, auth_user_id, must_change_password)
select p.id, u.id, true
from red_conexion_gerencial.people p
join auth.users u on lower(trim(u.email)) = lower(trim(p.email))
where u.raw_app_meta_data ->> 'rcg_initial_cuit' = 'true'
on conflict do nothing;
