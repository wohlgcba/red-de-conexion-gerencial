"""Prepare one fictional manager for a NEW access request, without an Auth account.

Only writes a clearly marked fixture to the private saved managerial snapshot.
Never modifies the source MySQL roster, Directory, accounts or requests.
Use an inbox you control so the normal signup can verify its email.
Dry-run by default; --execute applies the single-row fixture transaction.
"""
import argparse
import json
import re
import uuid
from pathlib import Path
from connect_organization import literal, query_file

ROOT = Path(__file__).resolve().parents[1]
IDENTIFIER = '20999909001'  # Synthetic, checksum-valid test identifier.


def fixture(email):
    email = email.strip().lower()
    if len(email)>254 or not re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+', email):
        raise ValueError('Indicá un correo válido que controles para verificar el registro.')
    return {
        'name': 'Luciano TestIngreso', 'email': email, 'identifier': IDENTIFIER,
        'assignments': [{
            'identifier': IDENTIFIER, 'name': 'TestIngreso, Luciano',
            'role': 'Gerente Operativo de Prueba de Ingreso (MOCK)',
            'ministry': 'Organismo de prueba de la Red (MOCK)',
            'unit': 'GO de Prueba de Ingreso (MOCK)',
            'path': 'Organismo de prueba de la Red (MOCK)|Secretaría de Pruebas Institucionales (MOCK)|DG de Prueba de Ingreso (MOCK)|GO de Prueba de Ingreso (MOCK)',
        }],
        'contacts': [{'kind': 'email', 'label': 'Correo de verificación de prueba', 'value': email, 'sourceField': 'MAIL_LABORAL'}],
    }


def transaction(data):
    key, email = literal(data['identifier']), literal(data['email'])
    assignments = literal(json.dumps(data['assignments'], ensure_ascii=False)) + '::jsonb'
    contacts = literal(json.dumps(data['contacts'], ensure_ascii=False)) + '::jsonb'
    protected = ['auth.users', 'red_conexion_gerencial.people', 'red_conexion_gerencial.member_accounts', 'rcg_private.admin_requests', 'rcg_private.gerencial_snapshot']
    sql = ['begin;', "set local statement_timeout='30s';", "select pg_advisory_xact_lock(hashtext('rcg_gerencial_snapshot'));",
           'create temporary table fixture_protected_before(entity text,checksum text) on commit drop;']
    for table in protected:
        sql.append(f"insert into fixture_protected_before select '{table}',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) from {table} t;")
    sql.append(f"""
create temporary table fixture_other_people_before on commit drop as
  select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.identifier)::text,'[]')) as checksum
  from rcg_private.gerencial_snapshot_people t where identifier<>{key};
do $$ begin
  if not exists(select 1 from rcg_private.gerencial_snapshot where singleton) then
    raise exception 'Falta el padrón guardado; no se crea una fuente de producción ficticia'; end if;
  if exists(select 1 from auth.users where lower(trim(email))={email}) then
    raise exception 'Ese correo ya tiene cuenta; para probar registro nuevo elegí otro alias'; end if;
  if exists(select 1 from red_conexion_gerencial.people where lower(trim(email))={email})
    or exists(select 1 from rcg_private.directory_link_keys where link_key={key})
    or exists(select 1 from rcg_private.organization_people where link_key={key})
    or exists(select 1 from rcg_private.admin_requests where lower(trim(email))={email} or link_key={key}) then
    raise exception 'Hay una identidad o solicitud previa; no se altera su flujo'; end if;
  if exists(select 1 from rcg_private.gerencial_snapshot_people where identifier={key} and assignments<>{assignments})
    or exists(select 1 from rcg_private.gerencial_snapshot_people p,jsonb_array_elements(p.contacts) c
      where p.identifier<>{key} and lower(c->>'value')={email}) then
    raise exception 'Los datos de prueba coinciden con otro registro; operación cancelada'; end if;
end $$;
insert into rcg_private.gerencial_snapshot_people(identifier,assignments,contacts)
  values({key},{assignments},{contacts})
  on conflict(identifier) do update set contacts=excluded.contacts;
do $$ begin
  if (select checksum from fixture_other_people_before) is distinct from
    (select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.identifier)::text,'[]')) from rcg_private.gerencial_snapshot_people t where identifier<>{key}) then
    raise exception 'Se alteró otro integrante del padrón; operación cancelada'; end if;
end $$;
""")
    for table in protected:
        sql.append(f"""do $$ begin
if (select checksum from fixture_protected_before where entity='{table}') is distinct from
 (select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) from {table} t) then
 raise exception 'Se alteraron datos protegidos; operación cancelada'; end if;
end $$;""")
    sql.append(f"""commit;
select true as test_manager_ready,
  rcg_private.admin_evidence({key})->>'eligibility' as detected_role,
  not exists(select 1 from auth.users where lower(trim(email))={email}) as no_auth_account,
  not exists(select 1 from rcg_private.directory_link_keys where link_key={key}) as not_in_directory,
  not exists(select 1 from rcg_private.admin_requests where link_key={key}) as no_previous_request;
""")
    delimiter = '$fixture_' + uuid.uuid4().hex + '$'
    return '\n'.join(sql).replace('do $$ begin', f'do {delimiter} begin').replace('end $$;', f'end {delimiter};')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--email', required=True)
    parser.add_argument('--execute', action='store_true')
    args = parser.parse_args()
    data = fixture(args.email)
    target = ROOT / '.local' / 'mock-access-applicant.sql'
    target.parent.mkdir(exist_ok=True)
    target.write_text(transaction(data), encoding='utf-8')
    if args.execute:
        result = query_file(target)
        (target.parent / 'mock-access-applicant.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps({'applied': True, 'result': result, 'mysqlModified': False, 'accountsCreated': 0}))
    else:
        print(json.dumps({'prepared': True, 'remoteChanges': False, 'accountsCreated': 0}))


if __name__ == '__main__':
    main()
