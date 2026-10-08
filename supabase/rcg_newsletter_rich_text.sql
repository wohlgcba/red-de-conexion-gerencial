-- Cambio aditivo: conserva body como texto plano y todos los permisos editoriales.
begin;
alter table red_conexion_gerencial.newsletters
  add column if not exists body_html text check (length(body_html) <= 60000);
grant insert (body_html), update (body_html) on red_conexion_gerencial.newsletters to authenticated;

-- Un cliente anterior que edite el texto plano no debe dejar formato desactualizado.
create or replace function red_conexion_gerencial.guard_newsletter_rich_text()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.body is distinct from old.body
     and new.body_html is not distinct from old.body_html then
    new.body_html := null;
  end if;
  return new;
end;
$$;
revoke all on function red_conexion_gerencial.guard_newsletter_rich_text() from public, anon, authenticated;
drop trigger if exists newsletters_rich_text_guard on red_conexion_gerencial.newsletters;
create trigger newsletters_rich_text_guard before update on red_conexion_gerencial.newsletters
for each row execute function red_conexion_gerencial.guard_newsletter_rich_text();
notify pgrst, 'reload schema';
commit;
