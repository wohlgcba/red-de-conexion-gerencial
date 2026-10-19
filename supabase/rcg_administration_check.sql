-- Read-only smoke check. No test accounts, requests, votes or profile changes.
begin read only;
do $$ declare uid uuid; begin
  select a.user_id into uid from red_conexion_gerencial.admin_users a join auth.users u on u.id=a.user_id
    where a.is_active and u.email_confirmed_at is not null and lower(a.email)=lower(u.email) limit 1;
  if uid is null then raise exception 'No enabled administrator'; end if;
  perform set_config('request.jwt.claim.sub',uid::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
end $$;
set local role authenticated;
do $$ declare result jsonb; begin
  if not red_conexion_gerencial.is_admin() then raise exception 'Administrator check failed'; end if;
  result:=red_conexion_gerencial.admin_list_requests('all','{}');
  if jsonb_typeof(result->'rows')<>'array' then raise exception 'Request list unavailable'; end if;
  result:=red_conexion_gerencial.admin_list_members('{"pageSize":1,"page":1}');
  if (result->>'total')::integer<1 or jsonb_array_length(result->'rows')<>1 then raise exception 'Member list unavailable'; end if;
  if result->'rows'->0 ?| array['identifier','link_key','cuit','cuil'] then raise exception 'Identifier leaked in list'; end if;
  if jsonb_typeof(red_conexion_gerencial.get_my_notifications()->'items')<>'array' then raise exception 'Notifications unavailable'; end if;
end $$;
reset role;
do $$ declare uid uuid; begin
  select a.auth_user_id into uid from red_conexion_gerencial.member_accounts a
    join red_conexion_gerencial.people p on p.id=a.person_id join auth.users u on u.id=a.auth_user_id
    where p.is_active and not a.must_change_password and u.email_confirmed_at is not null
      and not exists(select 1 from red_conexion_gerencial.admin_users x where x.user_id=a.auth_user_id) limit 1;
  if uid is null then raise exception 'No confirmed member to check'; end if;
  perform set_config('request.jwt.claim.sub',uid::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
end $$;
set local role authenticated;
do $$ begin
  if not red_conexion_gerencial.is_member() then raise exception 'Existing member access changed'; end if;
  begin perform red_conexion_gerencial.admin_list_requests('all','{}'); raise exception 'Unauthorized administration access'; exception when insufficient_privilege then null; end;
  begin perform red_conexion_gerencial.admin_member_identity(gen_random_uuid()); raise exception 'Unauthorized identity access'; exception when insufficient_privilege then null; end;
  begin perform 1 from rcg_private.admin_requests limit 1; raise exception 'Private table exposed'; exception when insufficient_privilege then null; end;
  perform red_conexion_gerencial.get_my_directory_requests();
  perform red_conexion_gerencial.get_my_notifications();
end $$;
reset role;
do $$ begin
  if has_function_privilege('anon','red_conexion_gerencial.submit_access_request(text,text,text,text,text,text)','execute') then raise exception 'Anonymous writes enabled'; end if;
  if to_regclass('rcg_private.admin_dotacion_rows') is not null or to_regclass('rcg_private.admin_dotacion_sources') is not null then raise exception 'Unwanted Dotacion storage exists'; end if;
end $$;
rollback;
select true as administration_reads_ok,true as existing_member_access_ok,true as identifiers_private,
  true as unauthorized_calls_denied,true as no_dotacion_storage,true as read_only_check;
