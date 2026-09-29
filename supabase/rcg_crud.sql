-- Ejecutar exclusivamente en BASE GCBA (project ref pnhskmlejdaklwkvasxp).
-- Todos los datos de la nueva aplicación permanecen en este schema.
-- No altera las tablas de otros sistemas en public.
begin;

create table if not exists red_conexion_gerencial.directorates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  ministry text not null check (length(trim(ministry)) > 0),
  secretariat text,
  summary text not null default '',
  topics text[] not null default '{}',
  is_active boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists directorates_identity_idx
  on red_conexion_gerencial.directorates
  (lower(trim(name)), lower(trim(ministry)), lower(trim(coalesce(secretariat, ''))));

alter table red_conexion_gerencial.people
  add column if not exists directorate_id uuid references red_conexion_gerencial.directorates(id) on delete set null,
  add column if not exists bio text not null default '',
  add column if not exists is_active boolean not null default true,
  add column if not exists version integer not null default 1,
  add column if not exists updated_at timestamptz not null default now();

-- Las altas desde la web no tienen número de fila en la planilla de origen.
alter table red_conexion_gerencial.people alter column source_row drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'people_email_format_chk'
                 and conrelid = 'red_conexion_gerencial.people'::regclass) then
    alter table red_conexion_gerencial.people
      add constraint people_email_format_chk
      check (email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$');
  end if;
end;
$$;

create index if not exists people_directorate_id_idx
  on red_conexion_gerencial.people(directorate_id);

-- La hoja original permite texto libre y contiene variantes. Se cargan solo
-- los valores que identifican explícitamente una Dirección General.
insert into red_conexion_gerencial.directorates (name, ministry, secretariat)
select distinct on (
    lower(trim(directorate)), lower(trim(ministry)),
    lower(trim(coalesce(secretariat, ''))))
  trim(directorate), trim(ministry), nullif(trim(secretariat), '')
from red_conexion_gerencial.people
where directorate ~* 'Direcci[oó]n General'
  and length(trim(directorate)) > 0
order by lower(trim(directorate)), lower(trim(ministry)),
  lower(trim(coalesce(secretariat, ''))), source_row
on conflict do nothing;

update red_conexion_gerencial.people p
set directorate_id = d.id
from red_conexion_gerencial.directorates d
where p.directorate_id is null
  and lower(trim(p.directorate)) = lower(trim(d.name))
  and lower(trim(p.ministry)) = lower(trim(d.ministry))
  and lower(trim(coalesce(p.secretariat, ''))) = lower(trim(coalesce(d.secretariat, '')));

create table if not exists red_conexion_gerencial.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists red_conexion_gerencial.newsletters (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references red_conexion_gerencial.people(id) on delete restrict,
  title text not null check (length(trim(title)) between 1 and 100),
  subtitle text not null default '' check (length(subtitle) <= 160),
  topic text not null check (length(trim(topic)) > 0),
  summary text not null default '',
  body text not null default '' check (length(body) <= 5000),
  image_path text,
  tags text[] not null default '{}',
  reading_minutes integer not null default 1 check (reading_minutes between 1 and 120),
  status text not null default 'borrador'
    check (status in ('borrador', 'pendiente', 'cambios', 'publicado', 'archivado', 'rechazado')),
  featured boolean not null default false,
  review_note text,
  reviewed_by uuid references auth.users(id),
  published_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists newsletters_author_idx
  on red_conexion_gerencial.newsletters(author_id, updated_at desc);
create index if not exists newsletters_public_idx
  on red_conexion_gerencial.newsletters(published_at desc)
  where status = 'publicado';
create unique index if not exists newsletters_one_featured_idx
  on red_conexion_gerencial.newsletters(featured)
  where featured and status = 'publicado';

create or replace function red_conexion_gerencial.current_person_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.id
  from red_conexion_gerencial.people p
  join auth.users u on lower(u.email) = lower(p.email)
  where u.id = (select auth.uid())
    and u.email_confirmed_at is not null
    and p.is_active
  limit 1;
$$;

create or replace function red_conexion_gerencial.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from red_conexion_gerencial.admin_users a
    join auth.users u on u.id = a.user_id
    where a.user_id = (select auth.uid())
      and a.is_active
      and u.email_confirmed_at is not null
      and lower(u.email) = lower(a.email)
  );
$$;

create or replace function red_conexion_gerencial.is_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select red_conexion_gerencial.current_person_id() is not null
    or red_conexion_gerencial.is_admin();
$$;

create or replace function red_conexion_gerencial.touch_record()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

drop trigger if exists people_touch on red_conexion_gerencial.people;
create trigger people_touch before update on red_conexion_gerencial.people
for each row execute function red_conexion_gerencial.touch_record();

drop trigger if exists directorates_touch on red_conexion_gerencial.directorates;
create trigger directorates_touch before update on red_conexion_gerencial.directorates
for each row execute function red_conexion_gerencial.touch_record();

create or replace function red_conexion_gerencial.guard_newsletter()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status in ('pendiente', 'publicado') and length(trim(new.body)) = 0 then
    raise exception 'El contenido es obligatorio para enviar o publicar';
  end if;
  if tg_op = 'UPDATE' then
    if new.author_id is distinct from old.author_id then
      raise exception 'No se puede cambiar la autoría';
    end if;
    if current_user <> 'postgres' and not red_conexion_gerencial.is_admin() then
      if old.status not in ('borrador', 'cambios')
         or new.status not in ('borrador', 'pendiente') then
        raise exception 'Transición editorial no permitida';
      end if;
      if new.image_path is not null
         and split_part(new.image_path, '/', 1) <> (select auth.uid())::text then
        raise exception 'La portada no pertenece al usuario';
      end if;
    end if;
    new.updated_at := now();
    new.version := old.version + 1;
  elsif tg_op = 'INSERT' and current_user <> 'postgres'
        and not red_conexion_gerencial.is_admin() then
    if new.image_path is not null
       and split_part(new.image_path, '/', 1) <> (select auth.uid())::text then
      raise exception 'La portada no pertenece al usuario';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists newsletters_guard on red_conexion_gerencial.newsletters;
create trigger newsletters_guard before insert or update
on red_conexion_gerencial.newsletters
for each row execute function red_conexion_gerencial.guard_newsletter();

create or replace function red_conexion_gerencial.review_newsletter(
  target_id uuid, expected_version integer, new_status text, new_note text default null,
  make_featured boolean default false
)
returns red_conexion_gerencial.newsletters
language plpgsql security definer set search_path = '' as $$
declare
  result red_conexion_gerencial.newsletters;
  previous_status text;
begin
  if not red_conexion_gerencial.is_admin() then
    raise exception 'Acceso denegado';
  end if;
  if new_status not in ('publicado', 'cambios', 'rechazado', 'archivado') then
    raise exception 'Estado editorial no válido';
  end if;
  if make_featured and new_status <> 'publicado' then
    raise exception 'Solo se puede destacar un newsletter publicado';
  end if;
  select status into previous_status
  from red_conexion_gerencial.newsletters
  where id = target_id and version = expected_version
  for update;
  if not found then raise exception 'El newsletter cambió desde que lo abriste'; end if;
  if (new_status in ('cambios', 'rechazado') and previous_status <> 'pendiente')
     or (new_status = 'publicado' and previous_status not in ('pendiente', 'publicado'))
     or (new_status = 'archivado' and previous_status <> 'publicado') then
    raise exception 'Transición editorial no permitida';
  end if;
  if new_status in ('cambios', 'rechazado') and nullif(trim(new_note), '') is null then
    raise exception 'La observación es obligatoria';
  end if;
  if make_featured then
    update red_conexion_gerencial.newsletters
       set featured = false where featured and id <> target_id;
  end if;
  update red_conexion_gerencial.newsletters
     set status = new_status,
         review_note = nullif(trim(new_note), ''),
         reviewed_by = (select auth.uid()),
         featured = make_featured,
         published_at = case when new_status = 'publicado'
           then coalesce(published_at, now()) else published_at end
   where id = target_id and version = expected_version
   returning * into result;
  if not found then raise exception 'El newsletter cambió desde que lo abriste'; end if;
  return result;
end;
$$;

alter table red_conexion_gerencial.people enable row level security;
alter table red_conexion_gerencial.directorates enable row level security;
alter table red_conexion_gerencial.newsletters enable row level security;
alter table red_conexion_gerencial.admin_users enable row level security;

revoke all on schema red_conexion_gerencial from public, anon, authenticated, service_role;
revoke all on all tables in schema red_conexion_gerencial
  from public, anon, authenticated, service_role;
revoke all on all functions in schema red_conexion_gerencial
  from public, anon, authenticated, service_role;
grant usage on schema red_conexion_gerencial to authenticated;
grant select, insert, update, delete on
  red_conexion_gerencial.people, red_conexion_gerencial.directorates
  to authenticated;
grant select, delete on red_conexion_gerencial.newsletters to authenticated;
grant insert (author_id, title, subtitle, topic, summary, body, image_path,
              tags, reading_minutes, status)
  on red_conexion_gerencial.newsletters to authenticated;
grant update (title, subtitle, topic, summary, body, image_path,
              tags, reading_minutes, status)
  on red_conexion_gerencial.newsletters to authenticated;
grant execute on function red_conexion_gerencial.current_person_id(),
  red_conexion_gerencial.is_admin(), red_conexion_gerencial.is_member(),
  red_conexion_gerencial.review_newsletter(uuid, integer, text, text, boolean)
  to authenticated;

drop policy if exists people_read on red_conexion_gerencial.people;
create policy people_read on red_conexion_gerencial.people for select
to authenticated using ((select red_conexion_gerencial.is_member()));
drop policy if exists people_insert on red_conexion_gerencial.people;
create policy people_insert on red_conexion_gerencial.people for insert
to authenticated with check ((select red_conexion_gerencial.is_admin()));
drop policy if exists people_update on red_conexion_gerencial.people;
create policy people_update on red_conexion_gerencial.people for update
to authenticated using ((select red_conexion_gerencial.is_admin()))
with check ((select red_conexion_gerencial.is_admin()));
drop policy if exists people_delete on red_conexion_gerencial.people;
create policy people_delete on red_conexion_gerencial.people for delete
to authenticated using ((select red_conexion_gerencial.is_admin()));

drop policy if exists directorates_read on red_conexion_gerencial.directorates;
create policy directorates_read on red_conexion_gerencial.directorates for select
to authenticated using ((select red_conexion_gerencial.is_member()));
drop policy if exists directorates_insert on red_conexion_gerencial.directorates;
create policy directorates_insert on red_conexion_gerencial.directorates for insert
to authenticated with check ((select red_conexion_gerencial.is_admin()));
drop policy if exists directorates_update on red_conexion_gerencial.directorates;
create policy directorates_update on red_conexion_gerencial.directorates for update
to authenticated using ((select red_conexion_gerencial.is_admin()))
with check ((select red_conexion_gerencial.is_admin()));
drop policy if exists directorates_delete on red_conexion_gerencial.directorates;
create policy directorates_delete on red_conexion_gerencial.directorates for delete
to authenticated using ((select red_conexion_gerencial.is_admin()));

drop policy if exists newsletters_read on red_conexion_gerencial.newsletters;
create policy newsletters_read on red_conexion_gerencial.newsletters for select
to authenticated using (
  (select red_conexion_gerencial.is_admin())
  or (select red_conexion_gerencial.is_member()) and
     (status = 'publicado' or author_id = (select red_conexion_gerencial.current_person_id()))
);
drop policy if exists newsletters_insert on red_conexion_gerencial.newsletters;
create policy newsletters_insert on red_conexion_gerencial.newsletters for insert
to authenticated with check (
  author_id = (select red_conexion_gerencial.current_person_id())
  and status in ('borrador', 'pendiente')
  and not featured and reviewed_by is null and published_at is null
);
drop policy if exists newsletters_update on red_conexion_gerencial.newsletters;
create policy newsletters_update on red_conexion_gerencial.newsletters for update
to authenticated using (
  (select red_conexion_gerencial.is_admin())
  or author_id = (select red_conexion_gerencial.current_person_id())
     and status in ('borrador', 'cambios')
) with check (
  (select red_conexion_gerencial.is_admin())
  or author_id = (select red_conexion_gerencial.current_person_id())
     and status in ('borrador', 'pendiente')
);
drop policy if exists newsletters_delete on red_conexion_gerencial.newsletters;
create policy newsletters_delete on red_conexion_gerencial.newsletters for delete
to authenticated using (
  (select red_conexion_gerencial.is_admin())
  or author_id = (select red_conexion_gerencial.current_person_id())
     and status = 'borrador'
);

-- Bucket privado, exclusivo de la nueva aplicación. Ninguna URL pública.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rcg-newsletters', 'rcg-newsletters', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists rcg_images_read on storage.objects;
create policy rcg_images_read on storage.objects for select to authenticated
using (
  bucket_id = 'rcg-newsletters'
  and (select red_conexion_gerencial.is_member())
  and (owner_id = (select auth.uid())::text
    or (select red_conexion_gerencial.is_admin())
    or exists (
      select 1 from red_conexion_gerencial.newsletters n
      where n.image_path = name and n.status = 'publicado'
    ))
);
drop policy if exists rcg_images_insert on storage.objects;
create policy rcg_images_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'rcg-newsletters'
  and (select red_conexion_gerencial.is_member())
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists rcg_images_delete_orphan on storage.objects;
create policy rcg_images_delete_orphan on storage.objects for delete to authenticated
using (
  bucket_id = 'rcg-newsletters'
  and (owner_id = (select auth.uid())::text
       or (select red_conexion_gerencial.is_admin()))
  and not exists (
    select 1 from red_conexion_gerencial.newsletters n where n.image_path = name
  )
);

commit;
