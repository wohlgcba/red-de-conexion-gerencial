-- Server-only read bridge. No Dotación tables, copies, writes or account changes.
begin;
create or replace function red_conexion_gerencial.server_directory_for_dotacion(p_admin uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  -- Re-check the confirmed administrator even though the API already verified its JWT.
  if not exists(select 1 from red_conexion_gerencial.admin_users a join auth.users u on u.id=a.user_id
    where a.user_id=p_admin and a.is_active and u.email_confirmed_at is not null and lower(trim(a.email))=lower(trim(u.email))) then
    raise exception 'Acceso administrativo requerido' using errcode='42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',p.id,'name',trim(p.given_name||' '||p.family_name),'identifier',k.link_key,
    'active',p.is_active,'role',p.position_title,'ministry',p.ministry,
    'secretariat',coalesce(p.secretariat,''),'directorate',coalesce(p.directorate,''),
    'exceptionActive',e.id is not null,'exceptionJustification',e.exception_justification
  ) order by p.id) from red_conexion_gerencial.people p
    left join rcg_private.directory_link_keys k on k.person_id=p.id
    left join lateral(select r.id,r.exception_justification from rcg_private.admin_requests r
      where r.person_id=p.id and r.exception_active order by r.exception_approved_at desc nulls last,r.id limit 1) e on true),'[]'::jsonb);
end $$;
revoke all on function red_conexion_gerencial.server_directory_for_dotacion(uuid) from public,anon,authenticated;
grant usage on schema red_conexion_gerencial to service_role;
grant execute on function red_conexion_gerencial.server_directory_for_dotacion(uuid) to service_role;
notify pgrst,'reload schema';
commit;
