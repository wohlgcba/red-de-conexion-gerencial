"""Activate Métricas on BASE GCBA and load the previous Red's history from its workbook.

Usage (PowerShell, paths in quotes):
  python scripts/import_metrics_history.py --xlsx "Red de Conexion Gerencial.xlsx"           # rehearsal, rolled back
  python scripts/import_metrics_history.py --xlsx "Red de Conexion Gerencial.xlsx" --apply   # commits

One transaction: supabase/rcg_metrics.sql plus rcg_private.import_metrics_history with the sheets
Accesos, VistasDetalle, Busquedas and Eliminados (manual deletions only). Protected tables are
checksummed before and after. The SQL with personal data lives in ignored .local/ only while it runs.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import unicodedata
from pathlib import Path

import pandas as pd

from supabase_project import PROJECT, ROOT, project_env

PROTECTED = ['red_conexion_gerencial.people', 'red_conexion_gerencial.member_accounts', 'red_conexion_gerencial.newsletters',
             'red_conexion_gerencial.newsletter_reactions', 'red_conexion_gerencial.admin_users', 'red_conexion_gerencial.directorates']
QUOTE = '$rcg_metrics$'


def name_key(value) -> str:
    text = unicodedata.normalize('NFKD', str(value)).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'\s+', ' ', text).strip()


def stamp(value) -> str | None:
    moment = pd.to_datetime(value, errors='coerce')
    return None if pd.isna(moment) else moment.strftime('%Y-%m-%dT%H:%M:%S')


def email(value) -> str:
    return '' if pd.isna(value) else str(value).strip().lower()


def read_history(path: Path) -> dict[str, list[dict]]:
    sheets = pd.read_excel(path, sheet_name=['Respuestas de formulario 1', 'Accesos', 'VistasDetalle', 'Busquedas', 'Eliminados'])
    roster = sheets['Respuestas de formulario 1'].dropna(how='all').reset_index(drop=True)
    mail_column = next(column for column in roster.columns if str(column).startswith('Email'))
    roster['row'] = roster.index + 2
    roster['key'] = roster['Nombre'].map(name_key) + ' ' + roster['Apellido'].map(name_key)
    roster['mail'] = roster[mail_column].map(email)
    by_row = dict(zip(roster['row'], zip(roster['key'], roster['mail'])))
    by_name = roster.groupby('key')['mail'].agg(list)

    # Rows shifted after later deletions, so the stored row only counts when the name agrees.
    def target(row) -> str | None:
        key = name_key(row['Contacto'])
        stored = by_row.get(int(row['Fila contacto'])) if not pd.isna(row['Fila contacto']) else None
        if stored and stored[0] == key:
            return stored[1]
        candidates = by_name.get(key, [])
        return candidates[0] if len(candidates) == 1 else None

    logins = [{'email': email(r['Email']), 'at': stamp(r['Fecha'])} for _, r in sheets['Accesos'].iterrows() if stamp(r['Fecha'])]
    views = [{'viewer': email(r['Email']), 'target': target(r), 'at': stamp(r['Fecha'])} for _, r in sheets['VistasDetalle'].iterrows() if stamp(r['Fecha'])]
    searches = [{'email': email(r['Email']), 'at': stamp(r['Fecha']), 'term': '' if pd.isna(r['Busqueda']) else str(r['Busqueda']),
                 'results': 0 if pd.isna(r['Resultados']) else int(r['Resultados'])} for _, r in sheets['Busquedas'].iterrows() if stamp(r['Fecha'])]
    deleted = sheets['Eliminados']
    deleted = deleted[deleted['Estado Administrador'] == 'ELIMINADO_MANUAL']
    role_column = next(column for column in deleted.columns if str(column).startswith('Cargo'))
    departures = [{'joined_on': stamp(r['Marca temporal'])[:10], 'left_on': stamp(r['Fecha Eliminacion'])[:10], 'role': str(r[role_column]),
                   'email': email(r[next(c for c in deleted.columns if str(c).startswith('Email'))]), 'reason': 'Eliminación manual en la Red anterior'}
                  for _, r in deleted.iterrows() if stamp(r['Marca temporal']) and stamp(r['Fecha Eliminacion'])]
    return {'logins': logins, 'views': views, 'searches': searches, 'departures': departures}


def checksum(table: str) -> str:
    return f"md5(coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text from {table} t),'[]'))"


def build_sql(history: dict[str, list[dict]], apply: bool) -> str:
    payloads = [json.dumps(history[name], ensure_ascii=False) for name in ['logins', 'views', 'searches', 'departures']]
    if any(QUOTE in payload for payload in payloads):
        raise SystemExit('El libro contiene el delimitador reservado; no se generó SQL.')
    migration = re.sub(r'(?m)^(begin;|commit;)\s*$', '', (ROOT / 'supabase' / 'rcg_metrics.sql').read_text(encoding='utf-8'))
    before = ',\n'.join(f"('{table}', {checksum(table)})" for table in PROTECTED)
    after = '\n'.join(f"""do $$ begin if (select value from metrics_protected where entity = '{table}') is distinct from {checksum(table)}
  then raise exception 'Protected records changed: {table}'; end if; end $$;""" for table in PROTECTED)
    args = ', '.join(f'{QUOTE}{payload}{QUOTE}::jsonb' for payload in payloads)
    return f"""begin;
set local statement_timeout = '180s';
do $$ begin
  if current_user <> 'postgres' or to_regclass('rcg_private.admin_audit') is null or to_regclass('red_conexion_gerencial.newsletter_reactions') is null
    then raise exception 'Unexpected metrics target'; end if;
end $$;
create temporary table metrics_protected(entity text primary key, value text) on commit drop;
insert into metrics_protected values {before};
{migration}
create temporary table metrics_import(stats jsonb) on commit drop;
insert into metrics_import select rcg_private.import_metrics_history({args});
{after}
select (select stats from metrics_import) as import,
  (select jsonb_object_agg(source || ':' || kind, n) from (select source, kind, count(*) as n from rcg_private.member_activity group by 1, 2) x) as activity_rows,
  (select count(*) from rcg_private.directory_searches) as searches,
  (select count(*) from rcg_private.metrics_departures) as departures,
  (select count(*) from rcg_private.metrics_people() m where m.active) as members,
  (select count(*) from rcg_private.metrics_people() m where m.active and exists(select 1 from rcg_private.member_activity a where a.person_id = m.person_id)) as entered,
  {'true' if apply else 'false'} as committed;
{'commit' if apply else 'rollback'};
"""


def run(sql: str, apply: bool) -> list[dict]:
    target = ROOT / '.local' / 'metrics-activation.sql'
    target.parent.mkdir(exist_ok=True)
    target.write_text(sql, encoding='utf-8')
    try:
        result = subprocess.run([shutil.which('npx.cmd') or 'npx', '--yes', 'supabase@latest', 'db', 'query', f'--remote={PROJECT}', '--yes',
                                 '--file', str(target), '--agent', 'no', '--output-format', 'json'], cwd=ROOT, env=project_env(),
                                capture_output=True, text=True, encoding='utf8', errors='replace', timeout=300)
        if result.returncode or '[' not in result.stdout:
            message = result.stdout[-1500:] + result.stderr[-800:]
            raise SystemExit('La activación no se completó; la transacción se revirtió.\n' + re.sub(r'sbp_\w+', '[token]', message))
        return json.loads(result.stdout[result.stdout.index('['):])
    finally:
        target.unlink(missing_ok=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--xlsx', type=Path, default=ROOT / 'Red de Conexion Gerencial.xlsx')
    parser.add_argument('--apply', action='store_true', help='confirmar los cambios; sin esta opción se revierten')
    args = parser.parse_args()
    data = read_history(args.xlsx)
    print(json.dumps({'workbook': {name: len(rows) for name, rows in data.items()},
                      'viewsWithTarget': sum(1 for row in data['views'] if row['target'])}, ensure_ascii=False))
    print(json.dumps(run(build_sql(data, args.apply), args.apply), ensure_ascii=False, indent=1))
