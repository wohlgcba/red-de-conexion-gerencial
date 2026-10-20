"""Provision existing active Directory members. Dry-run unless --execute.

Verified Directory identifiers are read privately, never from the browser.
Only a salted bcrypt hash is sent to Auth; identifiers are never printed.
Existing Auth accounts (including Hub users) are never changed.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import time
import bcrypt
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from connect_organization import query_file


ROOT = Path(__file__).resolve().parents[1]
PROJECT_REF = "pnhskmlejdaklwkvasxp"  # BASE GCBA only
BASE_URL = f"https://{PROJECT_REF}.supabase.co/auth/v1/admin/users"
SQL_LINK = ROOT / "supabase" / "rcg_link_new_accounts.sql"


def valid_cuit(value: object) -> str | None:
    digits = str(int(value)) if isinstance(value, (int, float)) and int(value) == value else str(value).strip().replace('-', '').replace(' ', '')
    if len(digits) != 11 or not digits.isdigit() or len(set(digits)) == 1:
        return None
    factors = (5, 4, 3, 2, 7, 6, 5, 4, 3, 2)
    expected = 11 - sum(int(digit) * factor for digit, factor in zip(digits[:10], factors)) % 11
    expected = 0 if expected == 11 else 9 if expected == 10 else expected
    return digits if expected == int(digits[-1]) else None


def load_people() -> tuple[list[tuple[int, str, str]], list[int]]:
    # Current approved Directory only. Never provision candidates or the Dotación roster.
    sql = ROOT / '.local' / 'initial-accounts-source.sql'
    sql.parent.mkdir(exist_ok=True)
    sql.write_text("""select lower(trim(p.email)) as email,k.link_key as identifier
      from red_conexion_gerencial.people p left join rcg_private.directory_link_keys k on k.person_id=p.id
      where p.is_active order by p.id;""", encoding='utf-8')
    rows = query_file(sql)
    if not rows or len(rows)>2000:
        raise RuntimeError('El Directorio está vacío o excede el alcance previsto; no se crean cuentas.')
    valid, invalid, seen = [], [], set()
    for number, row in enumerate(rows, 1):
        email = str(row.get('email') or '').strip().lower()
        if not email or email.count('@') != 1 or email in seen:
            raise RuntimeError('Hay correos faltantes o duplicados; se requiere revisión antes de crear cuentas.')
        seen.add(email)
        cuit = valid_cuit(row.get('identifier'))
        if cuit: valid.append((number, email, cuit))
        else: invalid.append(number)
    return valid, invalid


def get_service_key(cli: str) -> str:
    result = subprocess.run(
        [cli, "--yes", "supabase@latest", "projects", "api-keys", "--project-ref", PROJECT_REF, "--output-format", "json", "--agent", "no"],
        cwd=ROOT, capture_output=True, text=True, check=False,
    )
    if result.returncode:
        raise RuntimeError("La CLI no tiene acceso a BASE GCBA. Iniciá sesión con la cuenta correcta.")
    keys = json.loads(result.stdout)
    if isinstance(keys, dict): keys = keys.get('api_keys', keys.get('keys', []))
    key = next((entry.get("api_key") for entry in keys if entry.get("name") == "service_role"), None)
    if not key or len(key) < 40:
        raise RuntimeError("No se encontró la clave administrativa de BASE GCBA.")
    return key


def api_request(key: str, method: str, url: str, body: dict | None = None) -> dict:
    payload = json.dumps(body).encode("utf-8") if body is not None else None
    request = Request(url, data=payload, method=method, headers={
        "apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
    })
    for attempt in range(4):
        try:
            with urlopen(request, timeout=30) as response:
                return json.load(response)
        except HTTPError as error:
            if error.code in (429, 500, 502, 503, 504) and attempt < 3:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(f"Falló la API administrativa de Supabase (HTTP {error.code}).") from None
        except URLError:
            if attempt < 3:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError("No se pudo conectar con Supabase Auth.") from None
    raise RuntimeError("No se pudo completar la solicitud a Supabase Auth.")


def existing_emails(key: str) -> set[str]:
    result: set[str] = set()
    page = 1
    while True:
        query = urlencode({"page": page, "per_page": 1000})
        users = api_request(key, "GET", f"{BASE_URL}?{query}").get("users", [])
        result.update(str(user.get("email") or "").strip().lower() for user in users)
        if len(users) < 1000:
            return result
        page += 1


def link_new_accounts(cli: str) -> None:
    completed = subprocess.run(
        [cli, "--yes", "supabase@latest", "db", "query", "--linked", "--project-ref", PROJECT_REF,
         "--file", str(SQL_LINK), "--agent", "no", "--output-format", "text"],
        cwd=ROOT, capture_output=True, text=True, check=False,
    )
    if completed.returncode:
        raise RuntimeError("Las cuentas se crearon, pero falló el vínculo con el directorio. Repetí el script para completarlo.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true", help="Crear cuentas nuevas (sin este flag solo informa conteos).")
    parser.add_argument("--limit", type=int, default=0, help="Límite opcional para una prueba controlada.")
    args = parser.parse_args()
    valid, invalid = load_people()
    print(f"Integrantes con identificador verificado: {len(valid)}. Pendientes de revisión: {len(invalid)}.")
    cli = shutil.which("npx")
    if not cli:
        raise RuntimeError("No se encontró npx.")
    key = get_service_key(cli)
    existing = existing_emails(key)
    new = [item for item in valid if item[1] not in existing]
    if args.limit:
        new = new[:args.limit]
    print(f"Cuentas existentes que se conservan: {len(valid) - len([item for item in valid if item[1] not in existing])}. Cuentas nuevas a crear: {len(new)}.")
    if not args.execute:
        print('Simulación: no se crearon cuentas ni se modificaron contraseñas.')
        return
    created = 0
    try:
        for row_number, email, cuit in new:
            try:
                api_request(key, "POST", BASE_URL, {
                    # Trusted bootstrap exception for existing Directory members.
                    # Hash import keeps the public 8+mixed-case policy enabled.
                    "email": email, "password_hash": bcrypt.hashpw(cuit.encode(), bcrypt.gensalt(rounds=10)).decode(), "email_confirm": True,
                    "app_metadata": {"rcg_initial_cuit": True},
                })
            except RuntimeError as error:
                raise RuntimeError(f"Se detuvo en la fila {row_number}: {error}") from None
            created += 1
            if created % 25 == 0:
                link_new_accounts(cli)
                print(f"Cuentas creadas y vinculadas: {created}.")
    finally:
        link_new_accounts(cli)
    print(f"Finalizado. Cuentas nuevas creadas: {created}; las existentes no se modificaron.")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as error:
        raise SystemExit(str(error)) from None
