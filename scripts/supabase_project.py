"""Private project credentials for local maintenance; never log token values."""
from pathlib import Path
import json
import os
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PROJECT = 'pnhskmlejdaklwkvasxp'


def project_env():
    env = os.environ.copy()
    path = ROOT / '.env.supabase.local'
    if path.exists():
        for line in path.read_text(encoding='utf-8-sig').splitlines():
            if line.strip().startswith('SUPABASE_ACCESS_TOKEN='):
                token = line.split('=', 1)[1].strip().strip('\"\'')
                if token:
                    env['SUPABASE_ACCESS_TOKEN'] = token
    return env


def read_query(sql):
    """One read-only transaction against BASE GCBA, with a fixed credential."""
    local = ROOT / '.local'
    local.mkdir(exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', dir=local, encoding='utf8', delete=False) as file:
        file.write('begin read only;\n' + sql + '\nrollback;')
        target = Path(file.name)
    try:
        result = subprocess.run([shutil.which('npx.cmd') or 'npx', '--yes', 'supabase@latest',
            'db', 'query', '--linked', '--project-ref', PROJECT, '--file', str(target),
            '--agent', 'no', '--output-format', 'json'], cwd=ROOT, env=project_env(),
            capture_output=True, text=True, encoding='utf8', errors='replace', timeout=120)
        if result.returncode:
            raise RuntimeError('No se pudo realizar la lectura privada de BASE GCBA. No se muestran credenciales ni datos personales.')
        return json.loads(result.stdout[result.stdout.index('['):])
    finally:
        target.unlink(missing_ok=True)
