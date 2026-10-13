"""Connect the reviewed offline Dotación snapshot to BASE GCBA only.

Private staging SQL stays in .local. No keys, contacts or SQL errors are logged.
Default prepares the transaction; --apply explicitly executes it remotely.
"""
from __future__ import annotations
import argparse
import json
import sqlite3
import subprocess
import uuid
from collections import Counter
from pathlib import Path
from build_organization_sample import norm, valid_key

ROOT = Path(__file__).resolve().parents[1]
PROJECT = 'pnhskmlejdaklwkvasxp'
PRIVATE = ROOT / '.local'


def literal(value):
    if value is None:
        return 'null'
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if isinstance(value, int):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def inserts(table, columns, rows):
    for start in range(0, len(rows), 400):
        yield f'insert into {table}({columns}) values\n' + ',\n'.join(
            '(' + ','.join(literal(value) for value in row) + ')' for row in rows[start:start + 400]
        ) + ';'


def compatible(unit_type, position):
    role = norm(position)
    prefixes = {'Subgerencia Operativa': ('subgerente operativo',),
                'Gerencia Operativa': ('gerente operativo',),
                'Gerencia General': ('gerente general',),
                'Dirección General': ('director general', 'directora general'),
                'Secretaría': ('secretario', 'secretaria'),
                'Subsecretaría': ('subsecretario', 'subsecretaria')}
    return any(role.startswith(prefix) for prefix in prefixes.get(unit_type, ()))


def build_transaction(review):
    with sqlite3.connect(review) as db:
        units = db.execute('select id,parent_id,name,unit_type,code from units order by id').fetchall()
        keys = db.execute('select link_key,source_row,expected_email from directory_keys order by source_row').fetchall()
        candidates = db.execute("select unit_id,link_key,institutional_name,position_title,review_state from candidates where review_state <> 'rejected' order by unit_id,link_key").fetchall()
    types = {item[0]: item[3] for item in units}
    count = Counter(item[0] for item in candidates)
    if not units or not keys or not candidates:
        raise ValueError('El snapshot privado está incompleto.')
    if len({key[0] for key in keys}) != len(keys) or any(not valid_key(key[0]) or not key[2] for key in keys):
        raise ValueError('Las claves de Directorio requieren revisión.')
    people = {}
    assignments = []
    for unit_id, key, name, role, _ in candidates:
        if not valid_key(key) or not name.strip() or not compatible(types.get(unit_id), role):
            raise ValueError('Un candidato no satisface las reglas de responsabilidad.')
        # Random private UUIDs; never derive browser-visible IDs from a CUIT.
        if key not in people:
            parts = name.split(',', 1)
            display = (parts[1].strip() + ' ' + parts[0].strip()).title() if len(parts) == 2 else name.title()
            people[key] = (str(uuid.uuid4()), key, display)
        assignments.append((str(uuid.uuid4()), unit_id, key, role, count[unit_id] == 1))
    migration = (ROOT / 'supabase/rcg_organization.sql').read_text(encoding='utf-8')
    # One atomic transaction includes schema, data, assertions and schema reload.
    migration = migration.replace('begin;\ncreate schema', 'create schema', 1).rsplit('commit;', 1)[0]
    sql = ["begin; set local statement_timeout='120s'; select pg_advisory_xact_lock(771245903);",
           '''create temp table protected_before on commit drop as
           select 'people' as entity, md5(jsonb_agg(to_jsonb(p) order by p.id)::text) as digest from red_conexion_gerencial.people p
           union all select 'directorates',md5(jsonb_agg(to_jsonb(d) order by d.id)::text) from red_conexion_gerencial.directorates d
           union all select 'newsletters',md5(jsonb_agg(to_jsonb(n) order by n.id)::text) from red_conexion_gerencial.newsletters n
           union all select 'auth',md5(jsonb_agg(to_jsonb(a) order by a.id)::text) from auth.users a;''', migration,
           '''create temp table staged_units(id uuid primary key,parent_id uuid,name text,unit_type text,code text) on commit drop;
           create temp table staged_keys(link_key text primary key,source_row integer,expected_email text) on commit drop;
           create temp table staged_people(id uuid,link_key text primary key,institutional_name text) on commit drop;
           create temp table staged_assignments(id uuid,unit_id uuid,link_key text,position_title text,confirmed boolean) on commit drop;''']
    sql.extend(inserts('staged_units', 'id,parent_id,name,unit_type,code', units))
    sql.extend(inserts('staged_keys', 'link_key,source_row,expected_email', keys))
    sql.extend(inserts('staged_people', 'id,link_key,institutional_name', list(people.values())))
    sql.extend(inserts('staged_assignments', 'id,unit_id,link_key,position_title,confirmed', assignments))
    sql.append('''
    create temp table matched_keys on commit drop as
    select s.link_key,p.id as person_id from staged_keys s join red_conexion_gerencial.people p
      on p.source_sheet='Respuestas de formulario 1' and p.source_row=s.source_row
      and lower(trim(p.email))=s.expected_email and p.is_active;
    do $$ begin
      if exists(select link_key from matched_keys group by link_key having count(*)>1)
        or exists(select person_id from matched_keys group by person_id having count(*)>1) then
        raise exception 'Reconciliación ambigua; operación cancelada.'; end if;
      if exists(select 1 from matched_keys m join rcg_private.directory_link_keys k
        on (k.person_id=m.person_id or k.link_key=m.link_key)
        where k.person_id<>m.person_id or k.link_key<>m.link_key) then
        raise exception 'Vínculo existente incompatible; operación cancelada.'; end if;
    end $$;
    insert into rcg_private.directory_link_keys(person_id,link_key,verified_at,verification_basis)
      select person_id,link_key,now(),'CUIT validado en XLSX Directorio; fila de origen y correo coinciden con el registro activo'
      from matched_keys on conflict(person_id) do nothing;
    insert into red_conexion_gerencial.organization_units(id,parent_id,name,unit_type,code,source_key)
      select id,parent_id,name,unit_type,code,id::text from staged_units
      on conflict(id) do update set parent_id=excluded.parent_id,name=excluded.name,unit_type=excluded.unit_type,code=excluded.code;
    insert into rcg_private.organization_people(id,link_key,institutional_name,reconciliation_status,person_id,verified_at,verification_basis)
      select s.id,s.link_key,s.institutional_name,case when m.person_id is not null then 'member' else 'pending' end,
        m.person_id,case when m.person_id is not null then now() end,
        case when m.person_id is not null then 'Identificador validado y vinculado a un perfil activo por fila y correo de origen'
        else 'Pendiente: Directorio contiene registros sin identificador validado; no se infiere ausencia de pertenencia' end
      from staged_people s left join matched_keys m using(link_key)
      on conflict(link_key) do update set institutional_name=excluded.institutional_name,
        reconciliation_status=excluded.reconciliation_status,person_id=excluded.person_id,
        verified_at=excluded.verified_at,verification_basis=excluded.verification_basis;
    update rcg_private.organization_assignments set responsibility_confirmed=false,
      verification_basis='Snapshot actualizado; pendiente de confirmación'
      where unit_id in(select id from staged_units);
    insert into rcg_private.organization_assignments(id,unit_id,responsible_id,position_title,responsibility_confirmed,verification_basis)
      select s.id,s.unit_id,o.id,s.position_title,s.confirmed,
        case when s.confirmed then 'Único candidato con identificador válido y cargo jerárquico compatible con la unidad contextual en Dotación'
        else 'Varios candidatos en la misma unidad; requiere revisión' end
      from staged_assignments s join rcg_private.organization_people o using(link_key)
      on conflict(unit_id,responsible_id,position_title) do update set
        responsibility_confirmed=excluded.responsibility_confirmed,verification_basis=excluded.verification_basis;
    set constraints all immediate;
    create temp table protected_after on commit drop as
      select 'people' as entity,md5(jsonb_agg(to_jsonb(p) order by p.id)::text) as digest from red_conexion_gerencial.people p
      union all select 'directorates',md5(jsonb_agg(to_jsonb(d) order by d.id)::text) from red_conexion_gerencial.directorates d
      union all select 'newsletters',md5(jsonb_agg(to_jsonb(n) order by n.id)::text) from red_conexion_gerencial.newsletters n
      union all select 'auth',md5(jsonb_agg(to_jsonb(a) order by a.id)::text) from auth.users a;
    do $$ begin
      if exists(select 1 from protected_before b full join protected_after a using(entity)
        where b.digest is distinct from a.digest) then
        raise exception 'Se modificaron datos fuera del Organigrama; operación cancelada.'; end if;
    end $$;
    create temp table import_summary on commit preserve rows as select
      (select count(*) from staged_units) as units,
      (select count(*) from staged_units where parent_id is null) as organisms,
      (select count(*) from matched_keys) as verified_directory_links,
      (select count(*) from staged_keys)-(select count(*) from matched_keys) as unmatched_directory_rows,
      (select count(*) from staged_assignments where confirmed) as confirmed_assignments,
      (select count(distinct unit_id) from staged_assignments where not confirmed) as ambiguous_units,
      (select count(*) from staged_assignments s join matched_keys m using(link_key) where s.confirmed) as member_assignments,
      true as existing_records_unchanged;
    commit;
    select * from import_summary;
    ''')
    return '\n'.join(sql), {'units': len(units), 'directoryKeys': len(keys), 'candidates': len(assignments),
                            'confirmedAssignments': sum(row[-1] for row in assignments),
                            'ambiguousUnits': sum(value > 1 for value in count.values())}


def query_file(path):
    result = subprocess.run(['npx.cmd', '--yes', 'supabase@latest', 'db', 'query', '--linked',
                             '--project-ref', PROJECT, '--agent', 'no', '--output-format', 'json', '--file', str(path)],
                            cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=240)
    if result.returncode:
        # Database errors can echo sensitive INSERT values. Never print them.
        raise RuntimeError('Supabase rechazó la operación. No se muestran detalles que puedan incluir identificadores privados.')
    raw = result.stdout
    start = raw.find('[\n')
    if start < 0:
        start = raw.find('[')
    return json.loads(raw[start:])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    PRIVATE.mkdir(exist_ok=True)
    sql, summary = build_transaction(PRIVATE / 'organization-review.sqlite')
    target = PRIVATE / 'organization-connect.sql'
    target.write_text(sql, encoding='utf-8')
    print(json.dumps({'prepared': summary, 'privateStaging': True}, ensure_ascii=False))
    if args.apply:
        guard = PRIVATE / 'organization-guard.sql'
        guard.write_text("select current_user as connection_role, exists(select 1 from information_schema.tables where table_schema='red_conexion_gerencial' and table_name='people') as correct_schema;", encoding='utf-8')
        rows = query_file(guard)
        if not rows or rows[0] != {'connection_role': 'postgres', 'correct_schema': True}:
            raise RuntimeError('La conexión no corresponde al proyecto y rol previstos.')
        rows = query_file(target)
        # Explicit allowlist of aggregate results only.
        allowed = {'units', 'organisms', 'verified_directory_links', 'unmatched_directory_rows',
                   'confirmed_assignments', 'ambiguous_units', 'member_assignments', 'existing_records_unchanged'}
        print(json.dumps({'applied': [{k: v for k, v in row.items() if k in allowed} for row in rows]}, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'Operación detenida ({type(error).__name__}); no se exponen datos privados.')
        raise SystemExit(1) from None
