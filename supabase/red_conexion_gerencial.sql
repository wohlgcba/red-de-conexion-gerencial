-- Directorio de Red de Conexión Gerencial, aislado de los otros sistemas
-- alojados en el proyecto Supabase BASE GCBA.
-- Este schema NO se debe agregar a los "Exposed schemas" de la Data API
-- hasta implementar autenticación y políticas de acceso específicas.

create schema if not exists red_conexion_gerencial;

revoke all on schema red_conexion_gerencial from public, anon, authenticated, service_role;

create table if not exists red_conexion_gerencial.people (
  id uuid primary key default gen_random_uuid(),
  source_sheet text not null default 'Respuestas de formulario 1',
  source_row integer not null check (source_row >= 2),
  source_registered_at timestamp without time zone,
  given_name text not null check (length(trim(given_name)) > 0),
  family_name text not null check (length(trim(family_name)) > 0),
  position_title text not null check (length(trim(position_title)) > 0),
  ministry text not null check (length(trim(ministry)) > 0),
  secretariat text,
  directorate text,
  phone text not null,
  email text not null check (length(trim(email)) > 3),
  advisory_topics text,
  imported_at timestamptz not null default now()
);

create unique index if not exists people_email_normalized_idx
  on red_conexion_gerencial.people (lower(email));

create index if not exists people_ministry_idx
  on red_conexion_gerencial.people (ministry);

create index if not exists people_directorate_idx
  on red_conexion_gerencial.people (directorate);

alter table red_conexion_gerencial.people enable row level security;

revoke all on all tables in schema red_conexion_gerencial
  from public, anon, authenticated, service_role;
revoke all on all sequences in schema red_conexion_gerencial
  from public, anon, authenticated, service_role;
revoke all on all functions in schema red_conexion_gerencial
  from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema red_conexion_gerencial
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema red_conexion_gerencial
  revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema red_conexion_gerencial
  revoke all on functions from public, anon, authenticated, service_role;
