-- BASE GCBA pnhskmlejdaklwkvasxp: fotos privadas exclusivas de esta aplicación.
-- No modifica user_metadata ni las fotos de otras apps que comparten Auth.
begin;
create table if not exists red_conexion_gerencial.profile_photos (
  user_id uuid primary key references auth.users(id) on delete cascade,
  person_id uuid unique references red_conexion_gerencial.people(id) on delete cascade,
  image_path text not null unique,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table red_conexion_gerencial.profile_photos enable row level security;
revoke all on red_conexion_gerencial.profile_photos from public, anon, authenticated, service_role;
grant select on red_conexion_gerencial.profile_photos to authenticated;
drop policy if exists rcg_profile_photos_read on red_conexion_gerencial.profile_photos;
create policy rcg_profile_photos_read on red_conexion_gerencial.profile_photos for select to authenticated
using ((select red_conexion_gerencial.is_member()));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('rcg-profile-photos', 'rcg-profile-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict(id) do nothing;

drop policy if exists rcg_profile_images_read on storage.objects;
create policy rcg_profile_images_read on storage.objects for select to authenticated
using (bucket_id = 'rcg-profile-photos' and (select red_conexion_gerencial.is_member())
  and (owner_id = (select auth.uid())::text or exists
    (select 1 from red_conexion_gerencial.profile_photos p where p.image_path = name)));
drop policy if exists rcg_profile_images_insert on storage.objects;
create policy rcg_profile_images_insert on storage.objects for insert to authenticated
with check (bucket_id = 'rcg-profile-photos' and (select red_conexion_gerencial.is_member())
  and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists rcg_profile_images_delete on storage.objects;
create policy rcg_profile_images_delete on storage.objects for delete to authenticated
using (bucket_id = 'rcg-profile-photos' and owner_id = (select auth.uid())::text
  and (select red_conexion_gerencial.is_member())
  and not exists (select 1 from red_conexion_gerencial.profile_photos p where p.image_path = name));

create or replace function red_conexion_gerencial.save_my_profile_photo(new_path text, expected_version integer)
returns void language plpgsql security definer set search_path = '' as $$
declare
  owner_uid uuid := (select auth.uid());
  current_version integer;
begin
  if owner_uid is null or not red_conexion_gerencial.is_member() then raise exception 'Acceso denegado'; end if;
  if new_path !~ ('^' || owner_uid::text || '/[0-9a-f-]{36}[.](jpg|png|webp)$')
     or not exists (select 1 from storage.objects where bucket_id = 'rcg-profile-photos' and name = new_path and owner_id = owner_uid::text) then
    raise exception 'La imagen no pertenece a la cuenta autenticada';
  end if;
  select version into current_version from red_conexion_gerencial.profile_photos where user_id = owner_uid for update;
  if found then
    if current_version is distinct from expected_version then raise exception 'Tu foto cambió desde que comenzaste. Actualizá la página.'; end if;
    update red_conexion_gerencial.profile_photos set image_path = new_path, version = version + 1, updated_at = now() where user_id = owner_uid;
  else
    if expected_version is distinct from 0 then raise exception 'La foto cambió. Actualizá la página.'; end if;
    insert into red_conexion_gerencial.profile_photos(user_id, person_id, image_path)
    values (owner_uid, red_conexion_gerencial.current_person_id(), new_path);
  end if;
end;
$$;
revoke all on function red_conexion_gerencial.save_my_profile_photo(text, integer) from public, anon, authenticated, service_role;
grant execute on function red_conexion_gerencial.save_my_profile_photo(text, integer) to authenticated;
notify pgrst, 'reload schema';
commit;
