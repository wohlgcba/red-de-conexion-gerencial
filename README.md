# Red de Conexión Gerencial

Aplicación React, Vite y TypeScript conectada al schema `red_conexion_gerencial`
del proyecto Supabase **BASE GCBA** (`pnhskmlejdaklwkvasxp`). Se publica en
https://red-de-conexion-gerencial.vercel.app.

Para ejecutar localmente, copiá `.env.example` a `.env.local`, completá la URL y
la clave **publicable** de ese proyecto y ejecutá `npm install` y `npm run dev`.
Nunca uses una clave secreta o `service_role` en una variable `VITE_*`.

El portal permite consultar integrantes y sus áreas, compartir experiencias
mediante newsletters y administrar solicitudes de ingreso. Los XLSX de origen
y los datos personales no se versionan. Las cantidades de integrantes y áreas
se consultan en la aplicación: no son valores fijos del desarrollo.

## Secciones

| Sección | Funciones | Acceso |
| --- | --- | --- |
| Directorio | Búsqueda, filtros, perfiles y copia de contactos. | Integrantes y administradores |
| Newsletters | Publicaciones, reacciones, editor y publicaciones propias. | Integrantes y administradores |
| Administración | Solicitudes, Directorio gerencial, Cruce con Dotación y revisión editorial. | Administradores |
| Métricas | Evolución de integrantes, ingresos, lecturas y búsquedas. | Administradores |
| Mi cuenta | Perfil, foto, solicitudes y contraseña. | Usuarios autenticados, según su habilitación |

El ingreso abre `/newsletters`. El menú de usuario permite acceder a
`/mi-cuenta` y `/mis-newsletters`. El formulario de ingreso está disponible en
`/solicitar-acceso`, antes de tener acceso al Directorio.

## Directorio

- Orden alfabético por **apellido A–Z o Z–A**; ante apellidos iguales, por nombre.
  También permite ordenar por actividad editorial reciente.
- “Breve descripción” muestra la respuesta completa a **“Los temas laborales por
  los que me pueden consultar son”** del formulario anterior (`advisory_topics`).
  Si falta, utiliza la descripción existente (`bio`).
- **Activo:** tiene al menos un ingreso registrado en este nuevo portal.
- **Inactivo:** no tiene ingresos registrados en este nuevo portal.

El estado de uso es independiente de la habilitación administrativa
(`people.is_active`): no bloquea cuentas ni da de baja integrantes.
El filtro no cuenta el historial importado del directorio anterior ni accesos a
otras aplicaciones que comparten Supabase Auth. Depende de visitas efectivamente
registradas; no se deduce a partir de la existencia de una cuenta.

## Ingreso, administración y publicaciones

El solicitante indica su correo y CUIT/CUIL, verifica el correo y revisa sus
datos. Si figura como gerente en el padrón guardado, el formulario autocompleta
datos editables. Los demás solicitantes pueden completarlos manualmente.
El motivo de ingreso es opcional y la habilitación requiere revisión administrativa.

Las cuentas iniciales provisionadas por la Red usan el CUIT para el primer
ingreso y requieren cambio de contraseña. Las contraseñas nuevas requieren al
menos ocho caracteres, una mayúscula, una minúscula y un número. Las cuentas
existentes de BASE GCBA conservan su clave.

Administración incluye **Solicitudes**, **Directorio gerencial** y **Cruce con
Dotación**. La revisión permite aprobar acceso si se confirma el cargo gerencial,
aprobar como excepción en los otros casos, o rechazar con observación.

El cruce utiliza un padrón acotado guardado en Supabase: gerentes, subgerentes y
los registros necesarios para contrastar integrantes. Permite revisar cambios de
cargo o área, otros puestos, personas no encontradas, excepciones y candidatos.
No copia toda la Dotación de empleados. La actualización explícita consulta
MySQL desde el servidor mediante TLS. Los contactos de candidatos están
reservados a administradores.

Los botones de correo ofrecen Gmail, Outlook y opciones de copia. Preparan un
mensaje para que el usuario lo envíe desde su correo; no envían invitaciones
automáticamente.

Los newsletters tienen editor de texto enriquecido, portadas, reacciones e
historial editorial. Administración permite solicitar cambios, aprobar,
corregir, ocultar, archivar y restaurar. Una edición pendiente conserva la versión
publicada hasta su aprobación. El filtro editorial abre en **Todos**.

## Organigrama

El Organigrama se conserva como proyecto independiente en la carpeta hermana
`Organigrama GCBA`, con su propia aplicación, scripts y pruebas. La Red ya no
incluye esa sección ni la revisión de autoridades. Sus migraciones históricas
se conservan para compatibilidad con la base y las pruebas del Directorio.

## Arquitectura y configuración

El frontend usa React 19, TypeScript, Vite y React Router. `src/pages/` y
`src/components/` contienen las pantallas; `src/app/` gestiona sesión y estado;
`src/services/` concentra consultas. `api/` y `server/` implementan ingreso y
Dotación. Vite integra esas API en desarrollo y Vercel las ejecuta en producción.

Se requiere Node.js y npm; Vercel está configurado con Node.js 24.

```powershell
npm ci
Copy-Item .env.example .env.local
# Completar las variables antes de iniciar.
npm run dev
```

Variables mínimas del frontend: `VITE_SUPABASE_URL` y
`VITE_SUPABASE_PUBLISHABLE_KEY`. Las variables privadas de servidor se describen
en `.env.example`; pueden guardarse localmente en `.env.dotacion.local`, ignorado
por Git. En producción se configuran en Vercel. La actualización de Dotación
requiere las variables `DOTACION_DB_*` y no debe desactivar la verificación TLS.

`supabase/red_conexion_gerencial.sql` contiene la base inicial y
`supabase/rcg_crud.sql` agrega las tablas, funciones, permisos y políticas del
CRUD. `supabase/rcg_grant_admin.sql` habilita la cuenta administradora una vez
creada y confirmada en Supabase Auth. La clave publicable puede estar en el
frontend; las contraseñas y claves secretas no deben guardarse en este repo.

La Data API expone este schema para usuarios autenticados. RLS bloquea a los
anónimos, limita la escritura del directorio a administradores y vincula cada
newsletter a la identidad del autor. Las portadas se almacenan en el bucket
privado `rcg-newsletters`.

La sección Métricas (solo administradores) muestra la evolución de integrantes por cargo, los
ingresos a la Red, el uso de Newsletters y quiénes nunca
ingresaron. `supabase/rcg_metrics.sql` registra la actividad agregada por
persona y día en `rcg_private`; `scripts/import_metrics_history.py` aplica la
migración y carga la historia de la Red anterior desde el XLSX local (ensayo
con reversión por defecto, `--apply` para confirmar).

`supabase/rcg_directory_portal_activity.sql` requiere `rcg_metrics.sql`.
Conserva el primer ingreso propio del nuevo portal en
`rcg_private.portal_entries` y expone solo el indicador de uso mediante
`directory_portal_activity()`, para usuarios habilitados. El historial anterior
permanece disponible para métricas, separado del estado del Directorio.

Las ampliaciones de administración, cuentas, ingreso, padrón gerencial,
editorial, fotos, reacciones y métricas están en archivos `supabase/rcg_*.sql`.
Revisar los requisitos de cada archivo antes de aplicarlo; no ejecutar toda la
carpeta indiscriminadamente. Los archivos `*_check.sql` son comprobaciones,
no migraciones de instalación.

## Verificación y despliegue

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

`tests/` incluye pruebas del frontend, servicios y SQL con PGlite. También hay
comprobaciones transaccionales en `supabase/rcg_*_check.sql`.

Vercel compila con `npm run build`, publica `dist` y conserva las rutas `/api/`
para las funciones del servidor. Los cambios enviados a `main` activan el
despliegue conectado a GitHub. Las migraciones SQL se aplican por separado:
un push no actualiza automáticamente la base de datos.
