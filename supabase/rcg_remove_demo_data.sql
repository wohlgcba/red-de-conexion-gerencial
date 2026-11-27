-- Retire only the explicitly identified Red demo records, keeping a private undo copy.
-- Requires the Portal, administration, metrics and directory activity migrations.
begin;
set local lock_timeout = '5s';
select pg_advisory_xact_lock(905319117);
select pg_advisory_xact_lock(905319118);
select pg_advisory_xact_lock(hashtext('rcg_gerencial_snapshot'));

create temporary table rcg_mock_posts on commit drop as
select id from red_conexion_gerencial.newsletters where 'MOCK' = any(tags);

create temporary table rcg_mock_people on commit drop as
select p.id from red_conexion_gerencial.people p
where p.source_sheet = 'RCG_MOCK_TEST_USERS_V1'
or (
  p.source_sheet = 'Solicitud administrativa' and p.source_row is null
  and p.position_title like '%(MOCK)%' and p.ministry like '%(MOCK)%'
  and exists (
    select 1 from rcg_private.admin_requests r
    join red_conexion_gerencial.member_accounts a on a.person_id = p.id and a.auth_user_id = r.user_id
    join rcg_private.directory_link_keys k on k.person_id = p.id and k.link_key = r.link_key
    where r.person_id = p.id and r.link_key = '20999909001' and r.role like '%(MOCK)%'
  )
);

create temporary table rcg_mock_users on commit drop as
select auth_user_id as user_id from red_conexion_gerencial.member_accounts
where person_id in (select id from pg_temp.rcg_mock_people);

create temporary table rcg_mock_requests on commit drop as
select r.id from rcg_private.admin_requests r
where (r.link_key = '20999909001' and r.role like '%(MOCK)%')
   or r.person_id in (select id from pg_temp.rcg_mock_people)
   or (r.person_id is null and r.user_id in (select user_id from pg_temp.rcg_mock_users));

do $$ begin
  if exists (
    select 1 from red_conexion_gerencial.newsletters n
    where (n.author_id in (select id from pg_temp.rcg_mock_people)
       or n.author_user_id in (select user_id from pg_temp.rcg_mock_users))
      and n.id not in (select id from pg_temp.rcg_mock_posts)
  ) or exists (
    select 1 from red_conexion_gerencial.admin_users a
    where a.user_id in (select user_id from pg_temp.rcg_mock_users)
  ) or exists (
    select 1 from rcg_private.organization_people o
    where o.person_id in (select id from pg_temp.rcg_mock_people)
  ) then
    raise exception 'Los perfiles de prueba tienen vínculos adicionales. Revisar antes de retirar.';
  end if;
end $$;

create temporary table rcg_mock_editorial_audit on commit drop as
select id from rcg_private.newsletter_editorial_audit
where newsletter_id in (select id from pg_temp.rcg_mock_posts);

create temporary table rcg_mock_notifications on commit drop as
select n.id from rcg_private.admin_notifications n
where exists(select 1 from pg_temp.rcg_mock_requests r where n.event_key like r.id::text || ':%')
   or exists(select 1 from pg_temp.rcg_mock_editorial_audit a where n.event_key = 'editorial:' || a.id::text);

create table if not exists rcg_private.mock_retirement_backup (
  source_table text not null,
  row_digest text not null,
  row_data jsonb not null,
  retired_at timestamptz not null default now(),
  primary key (source_table, row_digest)
);
alter table rcg_private.mock_retirement_backup enable row level security;
revoke all on rcg_private.mock_retirement_backup from public, anon, authenticated, service_role;

do $$
declare entry record;
begin
  for entry in select * from (values
    ('red_conexion_gerencial.newsletters','t.id in (select id from pg_temp.rcg_mock_posts)'),
    ('rcg_private.newsletter_versions','t.newsletter_id in (select id from pg_temp.rcg_mock_posts)'),
    ('red_conexion_gerencial.newsletter_reactions','t.newsletter_id in (select id from pg_temp.rcg_mock_posts) or t.user_id in (select user_id from pg_temp.rcg_mock_users)'),
    ('rcg_private.newsletter_editorial_audit','t.id in (select id from pg_temp.rcg_mock_editorial_audit)'),
    ('rcg_private.newsletter_email_outbox','t.audit_id in (select id from pg_temp.rcg_mock_editorial_audit)'),
    ('red_conexion_gerencial.people','t.id in (select id from pg_temp.rcg_mock_people)'),
    ('red_conexion_gerencial.member_accounts','t.person_id in (select id from pg_temp.rcg_mock_people)'),
    ('red_conexion_gerencial.profile_photos','t.person_id in (select id from pg_temp.rcg_mock_people)'),
    ('rcg_private.directory_link_keys','t.person_id in (select id from pg_temp.rcg_mock_people)'),
    ('rcg_private.portal_entries','t.person_id in (select id from pg_temp.rcg_mock_people)'),
    ('rcg_private.admin_quality_reviews','t.person_id in (select id from pg_temp.rcg_mock_people)'),
    ('rcg_private.member_activity','t.person_id in (select id from pg_temp.rcg_mock_people) or t.profile_id in (select id from pg_temp.rcg_mock_people) or t.newsletter_id in (select id from pg_temp.rcg_mock_posts)'),
    ('rcg_private.directory_searches','t.person_id in (select id from pg_temp.rcg_mock_people)'),
    ('rcg_private.metrics_demo_reads','true'),
    ('rcg_private.admin_access_states','t.user_id in (select user_id from pg_temp.rcg_mock_users)'),
    ('rcg_private.admin_requests','t.id in (select id from pg_temp.rcg_mock_requests)'),
    ('rcg_private.admin_notifications','t.id in (select id from pg_temp.rcg_mock_notifications)'),
    ('rcg_private.admin_audit','t.request_id in (select id from pg_temp.rcg_mock_requests) or t.person_id in (select id from pg_temp.rcg_mock_people)'),
    ('rcg_private.gerencial_snapshot_people','t.identifier = ''20999909001'' and exists (select 1 from jsonb_array_elements(t.assignments) a where a->>''role'' = ''Gerente Operativo de Prueba de Ingreso (MOCK)'')')
  ) as sources(relation, predicate)
  loop
    execute format('insert into rcg_private.mock_retirement_backup(source_table,row_digest,row_data)
      select %L,md5(to_jsonb(t)::text),to_jsonb(t) from %s t where %s on conflict do nothing',
      entry.relation, entry.relation::regclass, entry.predicate);
  end loop;
end $$;

delete from rcg_private.admin_notifications where id in (select id from pg_temp.rcg_mock_notifications);
delete from rcg_private.newsletter_email_outbox where audit_id in (select id from pg_temp.rcg_mock_editorial_audit);
delete from rcg_private.newsletter_editorial_audit where id in (select id from pg_temp.rcg_mock_editorial_audit);
delete from rcg_private.metrics_demo_reads;
delete from red_conexion_gerencial.newsletter_reactions where user_id in (select user_id from pg_temp.rcg_mock_users);
delete from red_conexion_gerencial.newsletters where id in (select id from pg_temp.rcg_mock_posts);
delete from rcg_private.admin_audit where request_id in (select id from pg_temp.rcg_mock_requests);
delete from rcg_private.admin_requests where id in (select id from pg_temp.rcg_mock_requests);
delete from rcg_private.admin_access_states where user_id in (select user_id from pg_temp.rcg_mock_users);
delete from red_conexion_gerencial.people where id in (select id from pg_temp.rcg_mock_people);
-- The directory trigger also logs the retirement briefly; keep the active audit free of fixture identities.
delete from rcg_private.admin_audit where person_id in (select id from pg_temp.rcg_mock_people);
delete from rcg_private.gerencial_snapshot_people t
where t.identifier = '20999909001'
  and exists(select 1 from jsonb_array_elements(t.assignments) a where a->>'role' = 'Gerente Operativo de Prueba de Ingreso (MOCK)');

select
  (select count(*) from pg_temp.rcg_mock_posts) as retired_posts,
  (select count(*) from pg_temp.rcg_mock_people) as retired_profiles,
  (select count(*) from pg_temp.rcg_mock_requests) as retired_requests,
  (select count(*) from rcg_private.metrics_demo_reads) as remaining_demo_read_rows,
  (select count(*) from red_conexion_gerencial.newsletters where status='publicado') as remaining_published_posts;
commit;
