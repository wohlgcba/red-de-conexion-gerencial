-- Ejecutar exclusivamente en BASE GCBA: pnhskmlejdaklwkvasxp.
-- Permite autoría institucional sin crear personas ficticias en el directorio.
begin;

alter table red_conexion_gerencial.newsletters
  alter column author_id drop not null,
  add column if not exists author_user_id uuid references auth.users(id) on delete restrict;

alter table red_conexion_gerencial.newsletters
  alter column author_user_id set default auth.uid();

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'red_conexion_gerencial.newsletters'::regclass
                   and conname = 'newsletters_author_identity_check') then
    alter table red_conexion_gerencial.newsletters
      add constraint newsletters_author_identity_check
      check (author_id is not null or author_user_id is not null);
  end if;
end;
$$;

create index if not exists newsletters_author_user_idx
  on red_conexion_gerencial.newsletters(author_user_id, updated_at desc);

create or replace function red_conexion_gerencial.guard_newsletter()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.status in ('pendiente', 'publicado') and length(trim(new.body)) = 0 then
    raise exception 'El contenido es obligatorio para enviar o publicar';
  end if;

  if tg_op = 'INSERT' and current_user <> 'postgres' then
    if not red_conexion_gerencial.is_member() then
      raise exception 'Acceso denegado';
    end if;
    if new.author_id is distinct from red_conexion_gerencial.current_person_id() then
      raise exception 'La autoría debe corresponder a la cuenta autenticada';
    end if;
    -- El cliente no puede elegir ni suplantar el usuario propietario.
    new.author_user_id := (select auth.uid());
    if not red_conexion_gerencial.is_admin()
       and new.status not in ('borrador', 'pendiente') then
      raise exception 'Solo la administración puede publicar sin revisión';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.author_id is distinct from old.author_id
       or new.author_user_id is distinct from old.author_user_id then
      raise exception 'No se puede cambiar la autoría';
    end if;
    if current_user <> 'postgres' and not red_conexion_gerencial.is_admin() then
      if old.author_id is distinct from red_conexion_gerencial.current_person_id()
         or old.status not in ('borrador', 'cambios')
         or new.status not in ('borrador', 'pendiente') then
        raise exception 'Transición editorial no permitida';
      end if;
    end if;
    new.updated_at := now();
    new.version := old.version + 1;
  end if;

  if current_user <> 'postgres' and not red_conexion_gerencial.is_admin()
     and new.image_path is not null
     and split_part(new.image_path, '/', 1) <> (select auth.uid())::text then
    raise exception 'La portada no pertenece al usuario';
  end if;

  if new.status = 'publicado' then
    if tg_op = 'INSERT' then
      new.published_at := now();
      new.reviewed_by := (select auth.uid());
    elsif old.status <> 'publicado' then
      new.published_at := coalesce(old.published_at, now());
      new.reviewed_by := (select auth.uid());
    end if;
  else
    new.featured := false;
  end if;
  return new;
end;
$$;

drop policy if exists newsletters_insert on red_conexion_gerencial.newsletters;
create policy newsletters_insert on red_conexion_gerencial.newsletters for insert
to authenticated with check (
  author_user_id = (select auth.uid())
  and (
    ((select red_conexion_gerencial.is_admin())
     and author_id is not distinct from (select red_conexion_gerencial.current_person_id())
     and status in ('borrador', 'publicado'))
    or (author_id = (select red_conexion_gerencial.current_person_id())
        and status in ('borrador', 'pendiente')
        and not featured and reviewed_by is null and published_at is null)
  )
);

-- author_user_id y los campos editoriales siguen sin permisos de escritura
-- directa para authenticated; los determina el trigger del servidor.
notify pgrst, 'reload schema';
commit;
