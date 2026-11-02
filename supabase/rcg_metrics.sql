-- BASE GCBA only (pnhskmlejdaklwkvasxp). Requires rcg_administration.sql, rcg_gerencial_snapshot.sql and rcg_newsletter_reactions.sql.
-- Usage metrics for administrators. Auth is shared with Hub, so Red activity is recorded here,
-- aggregated per person, Buenos Aires day and kind. Safe to reapply.
-- History from the previous Red (Apps Script workbook) is loaded by scripts/import_metrics_history.py.
begin;

create table if not exists rcg_private.member_activity (
  user_id uuid references auth.users(id) on delete set null,
  person_id uuid not null references red_conexion_gerencial.people(id) on delete cascade,
  activity_date date not null,
  kind text not null check (kind in ('visit','newsletters','newsletter','search','profile')),
  newsletter_id uuid references red_conexion_gerencial.newsletters(id) on delete cascade,
  profile_id uuid references red_conexion_gerencial.people(id) on delete cascade,
  hits integer not null default 1 check (hits > 0),
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  source text not null default 'app' check (source in ('app','history','xlsx')),
  check ((kind = 'newsletter') = (newsletter_id is not null)),
  check (profile_id is null or kind = 'profile'),
  constraint member_activity_day unique nulls not distinct (person_id, activity_date, kind, newsletter_id, profile_id)
);
create index if not exists member_activity_date on rcg_private.member_activity(activity_date);
create index if not exists member_activity_newsletter on rcg_private.member_activity(newsletter_id) where newsletter_id is not null;
create index if not exists member_activity_profile on rcg_private.member_activity(profile_id) where profile_id is not null;

create table if not exists rcg_private.directory_searches (
  id bigint generated always as identity primary key,
  person_id uuid not null references red_conexion_gerencial.people(id) on delete cascade,
  searched_at timestamptz not null default now(),
  term text not null check (length(term) between 1 and 80),
  results integer not null check (results >= 0),
  source text not null default 'app' check (source in ('app','xlsx'))
);
create index if not exists directory_searches_person on rcg_private.directory_searches(person_id, searched_at desc);
create index if not exists directory_searches_term on rcg_private.directory_searches(term);

-- Departures of people no longer in the Directory. Dates and level only, no personal data.
create table if not exists rcg_private.metrics_departures (
  id bigint generated always as identity primary key,
  joined_on date not null,
  left_on date not null check (left_on >= joined_on),
  level text not null check (level in ('gerente','subgerente','otro')),
  reason text not null default '',
  source text not null default 'xlsx' check (source in ('xlsx'))
);

-- Demonstration reads for the fictional MOCK posts only, never attributed to people and only added to the
-- newsletter ranking. Remove them with: delete from rcg_private.metrics_demo_reads;
create table if not exists rcg_private.metrics_demo_reads (
  newsletter_id uuid primary key references red_conexion_gerencial.newsletters(id) on delete cascade,
  readers integer not null check (readers >= 0),
  views integer not null check (views >= readers),
  created_at timestamptz not null default now()
);

-- Coverage comes from the saved Dotación snapshot; the former editable universe is removed.
drop function if exists red_conexion_gerencial.admin_set_metrics_universe(integer);
drop table if exists rcg_private.metrics_settings;

do $$ declare t text; begin
  foreach t in array array['member_activity','directory_searches','metrics_departures','metrics_demo_reads'] loop
    execute format('alter table rcg_private.%I enable row level security', t);
    execute format('revoke all on rcg_private.%I from public, anon, authenticated, service_role', t);
  end loop;
end $$;

create or replace function rcg_private.local_date(p_at timestamptz)
returns date language sql stable set search_path = '' as $$
  select (p_at at time zone 'America/Argentina/Buenos_Aires')::date;
$$;

-- Same reading as the Dotación reconciliation, plus the abbreviations used in the form.
create or replace function rcg_private.position_level(p_title text)
returns text language sql immutable set search_path = '' as $$
  select case
    when t ~ '^(sub ?-?e?gerent|sugerent|subgerencia|sgo\M|s\.g\.o)' then 'subgerente'
    when t ~ '^(gerent|gerencia|go\M|g\.o\.)' then 'gerente'
    else 'otro' end
  from (select lower(trim(coalesce(p_title, ''))) as t) x;
$$;

-- Fictional accounts from scripts/seed_mock_test_users.py never count as Red members.
create or replace function rcg_private.metrics_people()
returns table(person_id uuid, level text, joined_on date, left_on date, active boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, rcg_private.position_level(p.position_title),
    coalesce(p.source_registered_at::date, rcg_private.local_date(p.imported_at)),
    case when not p.is_active then (select rcg_private.local_date(max(a.occurred_at)) from rcg_private.admin_audit a
      where a.person_id = p.id and a.action = 'deactivate') end, p.is_active
  from red_conexion_gerencial.people p
  where p.source_sheet <> 'RCG_MOCK_TEST_USERS_V1'
  union all
  select null, d.level, d.joined_on, d.left_on, false from rcg_private.metrics_departures d;
$$;

create or replace function rcg_private.metrics_actor()
returns uuid language sql stable security definer set search_path = '' as $$
  select a.person_id from red_conexion_gerencial.member_accounts a
    join red_conexion_gerencial.people p on p.id = a.person_id
    where a.auth_user_id = auth.uid() and p.is_active;
$$;

create or replace function red_conexion_gerencial.record_activity(p_kind text, p_target uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); target uuid;
begin
  if actor is null then raise exception 'Acceso denegado' using errcode = '42501'; end if;
  if p_kind is null or p_kind not in ('visit','newsletters','newsletter','profile') or (p_kind in ('newsletter','profile')) <> (p_target is not null) then
    raise exception 'Actividad inválida' using errcode = '22023';
  end if;
  -- A first login still pending its password change counts as entering the Red.
  target := rcg_private.metrics_actor();
  if target is null then return; end if;
  if p_kind <> 'visit' and not red_conexion_gerencial.is_member() then raise exception 'Acceso denegado' using errcode = '42501'; end if;
  if p_kind = 'newsletter' and not exists(select 1 from red_conexion_gerencial.newsletters n where n.id = p_target and n.status = 'publicado') then return; end if;
  if p_kind = 'profile' and (p_target = target or not exists(select 1 from red_conexion_gerencial.people p where p.id = p_target and p.is_active)) then return; end if;
  insert into rcg_private.member_activity(user_id, person_id, activity_date, kind, newsletter_id, profile_id)
    values (actor, target, rcg_private.local_date(now()), p_kind,
      case when p_kind = 'newsletter' then p_target end, case when p_kind = 'profile' then p_target end)
    on conflict on constraint member_activity_day do update
      set hits = least(rcg_private.member_activity.hits + 1, 100000), last_at = now(), user_id = excluded.user_id;
end $$;

create or replace function red_conexion_gerencial.record_search(p_term text, p_results integer)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); target uuid; clean text := left(regexp_replace(lower(trim(coalesce(p_term, ''))), '\s+', ' ', 'g'), 80);
begin
  if actor is null or not red_conexion_gerencial.is_member() then raise exception 'Acceso denegado' using errcode = '42501'; end if;
  if length(clean) < 2 or p_results is null or p_results < 0 then return; end if;
  target := rcg_private.metrics_actor();
  if target is null then return; end if;
  -- The same term again within minutes is a refinement of one search, not a new one.
  if exists(select 1 from rcg_private.directory_searches s where s.person_id = target and s.term = clean and s.searched_at > now() - interval '10 minutes') then return; end if;
  insert into rcg_private.directory_searches(person_id, term, results) values (target, clean, least(p_results, 100000));
  insert into rcg_private.member_activity(user_id, person_id, activity_date, kind)
    values (actor, target, rcg_private.local_date(now()), 'search')
    on conflict on constraint member_activity_day do update
      set hits = least(rcg_private.member_activity.hits + 1, 100000), last_at = now(), user_id = excluded.user_id;
end $$;

-- Managers in the saved Dotación snapshot and how many of them are active Red members, by CUIT/CUIL.
create or replace function rcg_private.metrics_coverage()
returns jsonb language sql stable security definer set search_path = '' as $$
  with managers as (
    select p.identifier, case when bool_or(rcg_private.admin_norm(trim(r->>'role')) ~ '^gerent[ea]([[:space:]]|$)') then 'gerente' else 'subgerente' end as level
    from rcg_private.gerencial_snapshot_people p cross join jsonb_array_elements(p.assignments) r
    group by p.identifier having bool_or(rcg_private.admin_is_manager(r->>'role'))),
  members as (
    select distinct k.link_key from rcg_private.directory_link_keys k join red_conexion_gerencial.people p on p.id = k.person_id
    where p.is_active and p.source_sheet <> 'RCG_MOCK_TEST_USERS_V1'),
  matched as (select m.*, m.identifier in (select link_key from members) as in_red from managers m)
  select case when s.singleton is null then null else jsonb_build_object('syncedAt', s.synced_at,
    'managers', (select count(*) from matched), 'covered', (select count(*) from matched where in_red),
    'gerentes', jsonb_build_object('total', (select count(*) from matched where level = 'gerente'), 'covered', (select count(*) from matched where level = 'gerente' and in_red)),
    'subgerentes', jsonb_build_object('total', (select count(*) from matched where level = 'subgerente'), 'covered', (select count(*) from matched where level = 'subgerente' and in_red))) end
  from (select true as anchor) a left join rcg_private.gerencial_snapshot s on s.singleton;
$$;

create or replace function red_conexion_gerencial.admin_metrics(p_granularity text default 'month')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare today date := rcg_private.local_date(now()); step interval; first_bucket date; result jsonb;
begin
  perform rcg_private.admin_assert();
  if p_granularity is null or p_granularity not in ('day','week','month') then raise exception 'Período inválido' using errcode = '22023'; end if;
  step := ('1 ' || p_granularity)::interval;
  first_bucket := case p_granularity
    when 'day' then today - 29
    when 'week' then date_trunc('week', today)::date - 7 * 25
    else greatest((date_trunc('month', today::timestamp) - interval '35 months')::date,
      date_trunc('month', coalesce((select min(joined_on) from rcg_private.metrics_people()), today)::timestamp)::date) end;
  -- Inactive people without a recorded deactivation date are left out of the history.
  with members as materialized (select * from rcg_private.metrics_people() m where m.active or m.left_on >= m.joined_on),
  current_members as (select * from members where active),
  activity as materialized (select a.* from rcg_private.member_activity a join members m on m.person_id = a.person_id),
  searches as materialized (select s.* from rcg_private.directory_searches s join members m on m.person_id = s.person_id),
  buckets as (select b::date as starts, (b + step)::date as ends from generate_series(first_bucket::timestamp, today::timestamp, step) b)
  select jsonb_build_object(
    'generatedAt', now(), 'today', today, 'granularity', p_granularity,
    'trackingSince', (select min(first_at) from rcg_private.member_activity where source = 'app'),
    'historySince', (select min(first_at) from rcg_private.member_activity where source = 'xlsx'),
    'historyUntil', (select max(last_at) from rcg_private.member_activity where source = 'xlsx'),
    'coverage', rcg_private.metrics_coverage(),
    'summary', jsonb_build_object(
      'members', (select count(*) from current_members),
      'gerentes', (select count(*) from current_members where level = 'gerente'),
      'subgerentes', (select count(*) from current_members where level = 'subgerente'),
      'otros', (select count(*) from current_members where level = 'otro'),
      'withAccount', (select count(*) from current_members m where exists(select 1 from red_conexion_gerencial.member_accounts a where a.person_id = m.person_id)),
      'entered', (select count(*) from current_members m where exists(select 1 from activity a where a.person_id = m.person_id)),
      'newsletterVisitors', (select count(distinct a.person_id) from activity a join current_members m using (person_id) where a.kind in ('newsletters','newsletter')),
      'newsletterReaders', (select count(distinct a.person_id) from activity a join current_members m using (person_id) where a.kind = 'newsletter'),
      'newsletterViews', (select coalesce(sum(hits), 0) from activity where kind = 'newsletter'),
      'publishedNewsletters', (select count(*) from red_conexion_gerencial.newsletters where status = 'publicado'),
      'directoryUsers', (select count(distinct a.person_id) from activity a join current_members m using (person_id) where a.kind in ('search','profile')),
      'searches', (select count(*) from searches),
      'emptySearches', (select count(*) from searches where results = 0),
      'profileViews', (select coalesce(sum(hits), 0) from activity where kind = 'profile')),
    'growth', (select jsonb_agg(g.value order by g.starts) from (
      select b.starts, jsonb_build_object('starts', b.starts,
        'gerente', count(*) filter (where m.level = 'gerente' and (m.left_on is null or m.left_on >= b.ends)),
        'subgerente', count(*) filter (where m.level = 'subgerente' and (m.left_on is null or m.left_on >= b.ends)),
        'otro', count(*) filter (where m.level = 'otro' and (m.left_on is null or m.left_on >= b.ends)),
        'joined', count(*) filter (where m.joined_on >= b.starts),
        'left', count(*) filter (where m.left_on >= b.starts and m.left_on < b.ends)) as value
      from buckets b left join members m on m.joined_on < b.ends group by b.starts, b.ends) g),
    'activity', (select jsonb_agg(jsonb_build_object('starts', b.starts,
        'visitors', (select count(distinct a.person_id) from activity a where a.activity_date >= b.starts and a.activity_date < b.ends),
        'newsletterVisitors', (select count(distinct a.person_id) from activity a where a.kind in ('newsletters','newsletter') and a.activity_date >= b.starts and a.activity_date < b.ends),
        'directoryUsers', (select count(distinct a.person_id) from activity a where a.kind in ('search','profile') and a.activity_date >= b.starts and a.activity_date < b.ends),
        'newsletterViews', (select coalesce(sum(a.hits), 0) from activity a where a.kind = 'newsletter' and a.activity_date >= b.starts and a.activity_date < b.ends),
        'searches', (select count(*) from searches s where rcg_private.local_date(s.searched_at) >= b.starts and rcg_private.local_date(s.searched_at) < b.ends),
        'profileViews', (select coalesce(sum(a.hits), 0) from activity a where a.kind = 'profile' and a.activity_date >= b.starts and a.activity_date < b.ends)) order by b.starts)
      from buckets b),
    'newsletters', coalesce((select jsonb_agg(x order by (x->>'readers')::int desc, (x->>'views')::int desc, x->>'publishedAt' desc nulls last) from (
      select jsonb_build_object('id', n.id, 'title', n.title, 'topic', n.topic, 'status', n.status, 'publishedAt', n.published_at,
        'readers', (select count(distinct a.person_id) from activity a where a.newsletter_id = n.id) + coalesce(d.readers, 0),
        'views', (select coalesce(sum(a.hits), 0) from activity a where a.newsletter_id = n.id) + coalesce(d.views, 0),
        'demo', d.newsletter_id is not null,
        'lastViewedAt', (select max(a.last_at) from activity a where a.newsletter_id = n.id),
        'reactions', (select count(*) from red_conexion_gerencial.newsletter_reactions r where r.newsletter_id = n.id)) as x
      from red_conexion_gerencial.newsletters n
      left join rcg_private.metrics_demo_reads d on d.newsletter_id = n.id and 'MOCK' = any(n.tags)
      where n.status = 'publicado' or exists(select 1 from activity a where a.newsletter_id = n.id)
      order by n.published_at desc nulls last limit 100) ranked), '[]'),
    'directory', jsonb_build_object(
      'topTerms', coalesce((select jsonb_agg(jsonb_build_object('term', term, 'searches', n, 'people', people, 'results', results) order by n desc, term) from (
        select term, count(*) as n, count(distinct person_id) as people, round(avg(results))::int as results from searches group by term order by count(*) desc, term limit 12) t), '[]'),
      'emptyTerms', coalesce((select jsonb_agg(jsonb_build_object('term', term, 'searches', n, 'people', people) order by n desc, term) from (
        select term, count(*) as n, count(distinct person_id) as people from searches where results = 0 group by term order by count(*) desc, term limit 12) t), '[]'),
      'topProfiles', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'role', role, 'ministry', ministry, 'views', views, 'viewers', viewers) order by views desc, name) from (
        select p.id, trim(p.given_name || ' ' || p.family_name) as name, p.position_title as role, p.ministry, sum(a.hits) as views, count(distinct a.person_id) as viewers
        from activity a join red_conexion_gerencial.people p on p.id = a.profile_id and p.is_active
        where a.kind = 'profile' group by p.id order by sum(a.hits) desc, 2 limit 10) t), '[]'))
  ) into result;
  return result;
end $$;

create or replace function red_conexion_gerencial.admin_metrics_people(p_filters jsonb default '{}')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  bulk boolean := coalesce((p_filters->>'export')::boolean, false);
  lim integer := case when bulk then 2000 else least(50, greatest(1, coalesce((p_filters->>'pageSize')::int, 25))) end;
  off integer := case when bulk then 0 else greatest(0, coalesce((p_filters->>'page')::int, 1) - 1) * lim end;
  search text := lower(trim(coalesce(p_filters->>'query', '')));
  state text := coalesce(p_filters->>'status', '');
  wanted_level text := coalesce(p_filters->>'level', '');
  result jsonb;
begin
  perform rcg_private.admin_assert();
  if state not in ('', 'never', 'entered') or wanted_level not in ('', 'gerente', 'subgerente', 'otro') then
    raise exception 'Los filtros no son válidos' using errcode = '22023';
  end if;
  with base as materialized (
    select p.id, trim(p.given_name || ' ' || p.family_name) as name, p.family_name, p.position_title as role, m.level,
      p.ministry, coalesce(p.directorate, '') as directorate, p.email, m.joined_on,
      case when a.person_id is null then 'none' when a.must_change_password then 'pending_password' else 'active' end as account,
      act.first_at, act.last_at, coalesce(act.days, 0) as days, coalesce(act.read, 0) as read, coalesce(act.directory, 0) as directory
    from rcg_private.metrics_people() m
    join red_conexion_gerencial.people p on p.id = m.person_id and m.active
    left join red_conexion_gerencial.member_accounts a on a.person_id = p.id
    left join lateral (select min(x.first_at) as first_at, max(x.last_at) as last_at, count(distinct x.activity_date) as days,
      count(distinct x.newsletter_id) as read, coalesce(sum(x.hits) filter (where x.kind in ('search','profile')), 0) as directory
      from rcg_private.member_activity x where x.person_id = p.id) act on true
    where wanted_level in ('', m.level)
      and (search = '' or lower(p.given_name || ' ' || p.family_name || ' ' || p.email || ' ' || p.position_title || ' ' || p.ministry || ' ' || coalesce(p.directorate, '')) like '%' || search || '%')),
  selected as (select * from base where state = '' or (state = 'never') = (last_at is null))
  select jsonb_build_object(
    'total', (select count(*) from selected),
    'counts', jsonb_build_object('all', (select count(*) from base), 'never', (select count(*) from base where last_at is null),
      'entered', (select count(*) from base where last_at is not null)),
    'rows', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'role', role, 'level', level, 'ministry', ministry,
        'directorate', directorate, 'email', email, 'joinedOn', joined_on, 'account', account, 'firstActivityAt', first_at,
        'lastActivityAt', last_at, 'activeDays', days, 'newslettersRead', read, 'directoryUses', directory))
      from (select * from selected order by
        case when p_filters->>'sort' = 'recent' then last_at end desc nulls last,
        case when p_filters->>'sort' = 'active' then days end desc,
        case when p_filters->>'sort' = 'joined' then joined_on end desc,
        family_name, name, id limit lim offset off) page), '[]')
  ) into result;
  return result;
end $$;

-- Loads the previous Red's logs (local Buenos Aires times). Matches people by email only; replaces earlier
-- imports, so it can be rerun. Departures keep dates and level; the email only excludes current members.
create or replace function rcg_private.import_metrics_history(p_logins jsonb, p_views jsonb, p_searches jsonb, p_departures jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare stats jsonb; n integer;
begin
  delete from rcg_private.member_activity where source = 'xlsx';
  delete from rcg_private.directory_searches where source = 'xlsx';
  delete from rcg_private.metrics_departures where source = 'xlsx';
  drop table if exists pg_temp.import_people, pg_temp.import_logins, pg_temp.import_views, pg_temp.import_searches;
  create temporary table import_people on commit drop as
    select distinct on (lower(trim(p.email))) lower(trim(p.email)) as email, p.id, a.auth_user_id
    from red_conexion_gerencial.people p left join red_conexion_gerencial.member_accounts a on a.person_id = p.id
    where p.source_sheet <> 'RCG_MOCK_TEST_USERS_V1' order by lower(trim(p.email)), p.is_active desc;
  create temporary table import_logins on commit drop as
    select i.id as person_id, i.auth_user_id, x.at from jsonb_to_recordset(p_logins) x(email text, at timestamp)
    left join import_people i on i.email = lower(trim(x.email));
  create temporary table import_views on commit drop as
    select v.id as person_id, v.auth_user_id, t.id as profile_id, x.at from jsonb_to_recordset(p_views) x(viewer text, target text, at timestamp)
    left join import_people v on v.email = lower(trim(x.viewer)) left join import_people t on t.email = lower(trim(x.target));
  create temporary table import_searches on commit drop as
    select i.id as person_id, i.auth_user_id, x.at, left(regexp_replace(lower(trim(coalesce(x.term, ''))), '\s+', ' ', 'g'), 80) as term,
      greatest(coalesce(x.results, 0), 0) as results
    from jsonb_to_recordset(p_searches) x(email text, at timestamp, term text, results integer)
    left join import_people i on i.email = lower(trim(x.email));

  insert into rcg_private.member_activity(person_id, user_id, activity_date, kind, profile_id, hits, first_at, last_at, source)
  select person_id, min(auth_user_id::text)::uuid, day, kind, profile_id, count(*), min(at) at time zone 'America/Argentina/Buenos_Aires',
    max(at) at time zone 'America/Argentina/Buenos_Aires', 'xlsx'
  from (select person_id, auth_user_id, at, at::date as day, 'visit' as kind, null::uuid as profile_id from import_logins
    union all select person_id, auth_user_id, at, at::date, 'profile', nullif(profile_id, person_id) from import_views
    union all select person_id, auth_user_id, at, at::date, 'search', null from import_searches where term <> '') e
  where person_id is not null
  group by person_id, day, kind, profile_id
  on conflict on constraint member_activity_day do nothing;
  get diagnostics n = row_count;

  insert into rcg_private.directory_searches(person_id, searched_at, term, results, source)
  select person_id, at at time zone 'America/Argentina/Buenos_Aires', term, results, 'xlsx' from import_searches
  where person_id is not null and term <> '';

  insert into rcg_private.metrics_departures(joined_on, left_on, level, reason, source)
  select x.joined_on, x.left_on, rcg_private.position_level(x.role), coalesce(x.reason, ''), 'xlsx'
  from jsonb_to_recordset(p_departures) x(joined_on date, left_on date, role text, email text, reason text)
  where x.left_on >= x.joined_on and not exists(select 1 from import_people i where i.email = lower(trim(x.email)));

  select jsonb_build_object(
    'activityRows', n,
    'logins', jsonb_build_object('total', (select count(*) from import_logins), 'matched', (select count(*) from import_logins where person_id is not null),
      'people', (select count(distinct person_id) from import_logins)),
    'views', jsonb_build_object('total', (select count(*) from import_views), 'matched', (select count(*) from import_views where person_id is not null),
      'withProfile', (select count(*) from import_views where person_id is not null and profile_id is not null)),
    'searches', jsonb_build_object('total', (select count(*) from import_searches), 'matched', (select count(*) from import_searches where person_id is not null and term <> '')),
    'departures', (select count(*) from rcg_private.metrics_departures where source = 'xlsx')) into stats;
  return stats;
end $$;

revoke all on function rcg_private.import_metrics_history(jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated, service_role;
revoke all on function rcg_private.local_date(timestamptz) from public, anon, authenticated, service_role;
revoke all on function rcg_private.position_level(text) from public, anon, authenticated, service_role;
revoke all on function rcg_private.metrics_people() from public, anon, authenticated, service_role;
revoke all on function rcg_private.metrics_actor() from public, anon, authenticated, service_role;
revoke all on function red_conexion_gerencial.record_activity(text, uuid) from public, anon, authenticated, service_role;
revoke all on function red_conexion_gerencial.record_search(text, integer) from public, anon, authenticated, service_role;
revoke all on function rcg_private.metrics_coverage() from public, anon, authenticated, service_role;
revoke all on function red_conexion_gerencial.admin_metrics(text) from public, anon, authenticated, service_role;
revoke all on function red_conexion_gerencial.admin_metrics_people(jsonb) from public, anon, authenticated, service_role;
grant execute on function red_conexion_gerencial.record_activity(text, uuid) to authenticated;
grant execute on function red_conexion_gerencial.record_search(text, integer) to authenticated;
grant execute on function red_conexion_gerencial.admin_metrics(text) to authenticated;
grant execute on function red_conexion_gerencial.admin_metrics_people(jsonb) to authenticated;

-- Prior evidence of entering the Red, only from sources that belong to it: sign-ins and password
-- changes of accounts the Red created (rcg_initial_cuit) and newsletter reactions.
insert into rcg_private.member_activity(user_id, person_id, activity_date, kind, first_at, last_at, source)
select a.auth_user_id, a.person_id, rcg_private.local_date(e.at), 'visit', e.at, e.at, 'history'
from red_conexion_gerencial.member_accounts a
join auth.users u on u.id = a.auth_user_id
cross join lateral (values (u.last_sign_in_at), (a.password_changed_at)) e(at)
where u.raw_app_meta_data->>'rcg_initial_cuit' = 'true' and e.at is not null
on conflict on constraint member_activity_day do nothing;

insert into rcg_private.member_activity(user_id, person_id, activity_date, kind, newsletter_id, first_at, last_at, source)
select r.user_id, a.person_id, rcg_private.local_date(r.created_at), k.kind, k.newsletter_id, r.created_at, r.created_at, 'history'
from red_conexion_gerencial.newsletter_reactions r
join red_conexion_gerencial.member_accounts a on a.auth_user_id = r.user_id
cross join lateral (values ('visit', null::uuid), ('newsletter', r.newsletter_id)) k(kind, newsletter_id)
on conflict on constraint member_activity_day do nothing;

commit;
