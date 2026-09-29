# Red de Conexión Gerencial

Frontend React + Vite + TypeScript con datos ficticios locales.

Versión publicada: https://red-de-conexion-gerencial.vercel.app

El archivo XLSX local no forma parte del repositorio. La aplicación todavía muestra datos ficticios.

Los 590 registros vigentes del directorio se importaron al schema privado
`red_conexion_gerencial` del proyecto Supabase `BASE GCBA`. El schema no está
expuesto a la Data API; `anon`, `authenticated` y `service_role` no tienen
permisos sobre él. La tabla tiene RLS activo y ninguna política de acceso.
No se importaron CUIT, registros eliminados, administradores ni trazas de uso.

La definición reproducible está en `supabase/red_conexion_gerencial.sql` y el
importador, que requiere el XLSX local y una sesión CLI autenticada, está en
`scripts/import_people.py`. No conectar la web a estos datos hasta implementar
autenticación, autorización y políticas de lectura verificadas.

Desde esta carpeta:

```powershell
npm install
npm run dev
```

Abrí la dirección local que muestre Vite (normalmente `http://localhost:5173`).

Verificaciones disponibles: `npm run lint`, `npm run typecheck` y `npm run build`.
