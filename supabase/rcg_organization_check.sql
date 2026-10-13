-- Execute only in a LOCAL test database with the organization migration applied.
-- Synthetic fixtures, rollback; no real identities or directory writes.
begin;
insert into red_conexion_gerencial.organization_units(id,parent_id,name,unit_type,source_key) values
 ('10000000-0000-4000-8000-000000000001',null,'Organismo sintético','Organismo','test-root'),
 ('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Gerencia sintética','Gerencia Operativa','test-child');
set constraints all immediate;
do $$ begin
  begin
    update red_conexion_gerencial.organization_units set parent_id = '10000000-0000-4000-8000-000000000002' where id = '10000000-0000-4000-8000-000000000001';
    raise exception 'Cycle protection failed';
  exception when raise_exception then
    if sqlerrm <> 'Dependencia circular o profundidad excesiva.' then raise; end if;
  end;
end $$;
select
  not has_schema_privilege('authenticated','rcg_private','USAGE') as private_schema_denied,
  not has_table_privilege('authenticated','rcg_private.organization_people','SELECT') as identifier_read_denied,
  not has_table_privilege('authenticated','rcg_private.directory_link_keys','SELECT') as directory_keys_denied,
  not has_table_privilege('authenticated','red_conexion_gerencial.organization_units','SELECT') as direct_table_read_denied,
  not has_function_privilege('anon','red_conexion_gerencial.get_organization_chart()','EXECUTE') as anonymous_rpc_denied,
  has_function_privilege('authenticated','red_conexion_gerencial.get_organization_chart()','EXECUTE') as authenticated_rpc_available;
rollback;
