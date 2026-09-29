# Red de Conexión Gerencial

Aplicación React, Vite y TypeScript conectada al schema `red_conexion_gerencial`
del proyecto Supabase **BASE GCBA** (`pnhskmlejdaklwkvasxp`). Se publica en
https://red-de-conexion-gerencial.vercel.app.

Para ejecutar localmente, copiá `.env.example` a `.env.local`, completá la URL y
la clave **publicable** de ese proyecto y ejecutá `npm install` y `npm run dev`.
Nunca uses una clave secreta o `service_role` en una variable `VITE_*`.

El directorio contiene 590 personas importadas del XLSX local; el XLSX y los
datos personales no se versionan. Las 350 Direcciones Generales derivadas del
texto original conservan variantes de escritura para evitar fusiones erróneas.
Los newsletters comienzan vacíos y se crean desde la aplicación.

`supabase/red_conexion_gerencial.sql` contiene la base inicial y
`supabase/rcg_crud.sql` agrega las tablas, funciones, permisos y políticas del
CRUD. `supabase/rcg_grant_admin.sql` habilita la cuenta administradora una vez
creada y confirmada en Supabase Auth. La clave publicable puede estar en el
frontend; las contraseñas y claves secretas no deben guardarse en este repo.

La Data API expone este schema para usuarios autenticados. RLS bloquea a los
anónimos, limita la escritura del directorio a administradores y vincula cada
newsletter a la identidad del autor. Las portadas se almacenan en el bucket
privado `rcg-newsletters`.

Comprobaciones: `npm run lint`, `npm run typecheck`, `npm run build` y las
consultas transaccionales `supabase/rcg_*_check.sql`.
