"""Activate administration on BASE GCBA after local tests and explicit authorization.

Default only prepares an atomic SQL transaction in ignored .local/.
--apply executes it. No roster, Dotacion import, account creation or backfill.
"""
import argparse
import json
import re
from pathlib import Path
from connect_organization import query_file

ROOT = Path(__file__).resolve().parents[1]
PROTECTED = [
    'auth.users', 'red_conexion_gerencial.people', 'red_conexion_gerencial.directorates',
    'red_conexion_gerencial.newsletters', 'red_conexion_gerencial.member_accounts',
    'red_conexion_gerencial.admin_users', 'red_conexion_gerencial.organization_units',
    'rcg_private.directory_link_keys', 'rcg_private.organization_people',
    'rcg_private.organization_assignments',
]


def prepare():
    statements = ['begin;', "set local statement_timeout='90s';", """
do $$ begin
 if current_user<>'postgres' or to_regclass('red_conexion_gerencial.member_accounts') is null
   then raise exception 'Unexpected administration target'; end if;
end $$;
create temporary table admin_protected_before(entity text primary key, checksum text) on commit drop;
"""
    ]
    for table in PROTECTED:
        statements.append(f"insert into admin_protected_before select '{table}',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) from {table} t;")
    for name in ['rcg_administration.sql', 'rcg_administration_intake.sql', 'rcg_dotacion_online.sql', 'rcg_gerencial_snapshot.sql']:
        sql = (ROOT / 'supabase' / name).read_text(encoding='utf-8')
        statements.append(re.sub(r'(?m)^(begin;|commit;)\s*$', '', sql))
    for table in PROTECTED:
        statements.append(f"""do $$ begin
if (select checksum from admin_protected_before where entity='{table}') is distinct from
 (select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) from {table} t)
then raise exception 'Protected records changed; activation rolled back'; end if;
end $$;""")
    statements.extend(["""do $$ begin
if to_regclass('rcg_private.admin_dotacion_rows') is not null or to_regclass('rcg_private.admin_dotacion_sources') is not null then
 raise exception 'Unexpected Dotacion storage; activation rolled back'; end if;
end $$;""", 'commit;', "select true as activated,true as existing_records_unchanged,true as no_dotacion_import;"])
    target = ROOT / '.local' / 'admin-activate.sql'
    target.parent.mkdir(exist_ok=True)
    target.write_text('\n'.join(statements), encoding='utf-8')
    return target


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    target = prepare()
    if args.apply:
        print(json.dumps(query_file(target)))
    else:
        print(json.dumps({'prepared': True, 'remoteChanges': False, 'dotacionImport': False}))
