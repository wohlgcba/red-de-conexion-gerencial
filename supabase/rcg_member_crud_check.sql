-- Prueba transaccional: no conserva el newsletter de prueba.
begin;
do $$
declare member_id uuid;
begin
  select u.id into member_id
  from auth.users u
  join red_conexion_gerencial.people p on lower(u.email) = lower(p.email)
  where u.email_confirmed_at is not null and p.is_active
  limit 1;
  if member_id is null then raise exception 'No hay integrante confirmado'; end if;
  perform set_config('request.jwt.claim.sub', member_id::text, true);
end;
$$;
set local role authenticated;
do $$
declare draft_id uuid;
begin
  insert into red_conexion_gerencial.newsletters
    (author_id, title, subtitle, topic, body, status)
  values
    (red_conexion_gerencial.current_person_id(), 'Prueba transaccional',
     'No se conserva', 'Procesos', 'Contenido de prueba', 'borrador')
  returning id into draft_id;

  update red_conexion_gerencial.newsletters
  set status = 'pendiente' where id = draft_id;
  if not found then raise exception 'No se pudo enviar a revisión'; end if;
  if (select status from red_conexion_gerencial.newsletters where id = draft_id) <> 'pendiente' then
    raise exception 'Estado inesperado';
  end if;
end;
$$;
select true as member_crud_passed;
rollback;
