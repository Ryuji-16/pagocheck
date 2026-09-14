-- ==============================================================================
-- PagoCheck - Esquema Consolidado y Blindaje Integral de Base de Datos
-- ==============================================================================
-- Versión: 1.1.0+ (Arquitectura Limpia & Zero-Trust)
-- Compatibilidad: Supabase (PostgreSQL 15+)
--
-- Componentes Integrados:
-- 1. Extensiones (pgcrypto para contraseñas seguras y UUIDs).
-- 2. Tablas del Sistema:
--    - public.profiles (Vinculada a auth.users con RBAC multi-sucursal).
--    - public.movements (Historial de transacciones con índice anti-duplicados).
--    - public.audit_logs (Bitácora inmutable de auditoría y observabilidad).
-- 3. Bucket Privado de Comprobantes (storage.buckets 'receipts' con RLS).
-- 4. Funciones RBAC de Contexto (get_my_role, get_my_branch, get_my_username).
-- 5. Trigger de Sincronización Automática auth.users -> public.profiles.
-- 6. Políticas de Seguridad de Nivel de Fila (RLS) y Grants Mínimos.
-- ==============================================================================

-- ==============================================================================
-- 1. Extensiones y Permisos Base
-- ==============================================================================
create extension if not exists pgcrypto with schema extensions;
grant usage on schema public to anon, authenticated;

-- ==============================================================================
-- 2. Limpieza de Entidades Legacy Obsoletas
-- ==============================================================================
drop table if exists public.app_users cascade;
drop function if exists public.verify_login cascade;
drop function if exists public.change_user_password cascade;

-- ==============================================================================
-- 3. Tabla 'public.profiles' (Enlazada a auth.users)
-- ==============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  role text not null check (role in ('caja', 'admin', 'bot')),
  label text not null,
  branch text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Perfiles de operadores vinculados a auth.users con roles y sucursales autorizadas.';

-- ==============================================================================
-- 4. Funciones RBAC Auxiliares (Contexto del Operador Autenticado)
-- ==============================================================================

-- Obtiene el rol del usuario conectado
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid() limit 1;
$$;

-- Obtiene la sucursal del usuario conectado
create or replace function public.get_my_branch()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select branch from public.profiles where id = auth.uid() limit 1;
$$;

-- Obtiene el username del usuario conectado
create or replace function public.get_my_username()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select username from public.profiles where id = auth.uid() limit 1;
$$;

-- ==============================================================================
-- 5. Tabla 'public.movements' (Transacciones y Pagos Móviles)
-- ==============================================================================
create table if not exists public.movements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  username text not null,
  label text,
  branch text,
  type text not null check (type in ('pago', 'vuelto', 'anulacion')),
  status text check (status in ('ok', 'confirmed', 'not-found', 'error', 'pending')),
  amount text,
  reference text,
  phone text,
  bank text,
  cedula text,
  note text,
  receipt_image text,
  provider text default 'banesco'
);

comment on table public.movements is 'Registro de transacciones con aislamiento multi-sucursal y blindaje anti-duplicados.';

-- Índices de consulta rápida
create index if not exists idx_movements_created_at on public.movements (created_at desc);
create index if not exists idx_movements_branch on public.movements (branch);
create index if not exists idx_movements_username on public.movements (username);

-- ==============================================================================
-- 6. Blindaje Anti-Duplicados a Nivel de Base de Datos
-- ==============================================================================
-- Impide registrar dos veces la misma transacción confirmada en el mismo banco.
create unique index if not exists movements_unique_confirmed_reference
on public.movements (
  lower(coalesce(provider, 'banesco')),
  lower(coalesce(bank, '')),
  lower(trim(reference))
)
where (
  status in ('ok', 'confirmed')
  and reference is not null
  and length(trim(reference)) > 0
);

-- ==============================================================================
-- 7. Tabla 'public.audit_logs' (Bitácora Inmutable de Auditoría)
-- ==============================================================================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  timestamp timestamptz not null default now(),
  action text not null,
  entity_type text,
  entity_id text,
  status text not null check (status in ('success', 'failed', 'warning', 'info')),
  latency_ms integer,
  actor_id uuid references auth.users(id) on delete set null,
  actor_username text not null,
  actor_role text not null,
  actor_branch text,
  ip_address inet,
  user_agent text,
  details jsonb default '{}'::jsonb
);

comment on table public.audit_logs is 'Registro inmutable de trazabilidad forense y observabilidad operativa.';

create index if not exists idx_audit_logs_timestamp on public.audit_logs (timestamp desc);
create index if not exists idx_audit_logs_action on public.audit_logs (action);
create index if not exists idx_audit_logs_actor_username on public.audit_logs (actor_username);
create index if not exists idx_audit_logs_actor_branch on public.audit_logs (actor_branch);

-- ==============================================================================
-- 8. Almacenamiento Seguro de Comprobantes (Storage Bucket 'receipts')
-- ==============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- ==============================================================================
-- 9. Trigger de Sincronización Automática (auth.users -> public.profiles)
-- ==============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, username, role, label, branch, active)
  values (
    new.id,
    lower(trim(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)))),
    coalesce(new.raw_user_meta_data->>'role', 'caja'),
    coalesce(new.raw_user_meta_data->>'label', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'branch',
    true
  )
  on conflict (id) do update set
    username = excluded.username,
    role = excluded.role,
    label = excluded.label,
    branch = excluded.branch,
    active = excluded.active,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ==============================================================================
-- 10. Políticas RLS (Row Level Security)
-- ==============================================================================

-- A. Tablas del Sistema: Habilitar RLS
alter table public.profiles enable row level security;
alter table public.movements enable row level security;
alter table public.audit_logs enable row level security;

-- Revocar accesos por defecto a roles públicos y anónimos
revoke all on table public.profiles from anon, public;
revoke all on table public.movements from anon, public;
revoke all on table public.audit_logs from anon, public;

-- ------------------------------------------------------------------------------
-- Políticas para 'public.profiles'
-- ------------------------------------------------------------------------------
drop policy if exists profiles_select_policy on public.profiles;
create policy profiles_select_policy on public.profiles
  for select to authenticated
  using (true);

drop policy if exists profiles_update_policy on public.profiles;
create policy profiles_update_policy on public.profiles
  for update to authenticated
  using (auth.uid() = id);

grant select on table public.profiles to authenticated;
grant update (label, updated_at) on table public.profiles to authenticated;

-- ------------------------------------------------------------------------------
-- Políticas para 'public.movements' (Aislamiento Multi-Sucursal RBAC)
-- ------------------------------------------------------------------------------
drop policy if exists movements_select_policy on public.movements;
create policy movements_select_policy on public.movements
  for select to authenticated
  using (
    public.get_my_role() = 'admin' and (public.get_my_branch() is null or public.get_my_branch() = '')
    or (branch is not null and branch = public.get_my_branch())
    or (username = public.get_my_username())
  );

drop policy if exists movements_insert_policy on public.movements;
create policy movements_insert_policy on public.movements
  for insert to authenticated
  with check (
    type is not null and
    amount is not null and (
      (public.get_my_role() = 'admin' and (public.get_my_branch() is null or public.get_my_branch() = ''))
      or (branch = public.get_my_branch())
      or (username = public.get_my_username())
    )
  );

drop policy if exists movements_update_policy on public.movements;
create policy movements_update_policy on public.movements
  for update to authenticated
  using (false);

drop policy if exists movements_delete_policy on public.movements;
create policy movements_delete_policy on public.movements
  for delete to authenticated
  using (false);

grant select, insert on table public.movements to authenticated;

-- ------------------------------------------------------------------------------
-- Políticas para 'public.audit_logs' (Inmutabilidad Estricta)
-- ------------------------------------------------------------------------------
drop policy if exists audit_logs_select_policy on public.audit_logs;
create policy audit_logs_select_policy on public.audit_logs
  for select to authenticated
  using (
    (public.get_my_role() = 'admin' and (public.get_my_branch() is null or public.get_my_branch() = ''))
    or (public.get_my_role() = 'admin' and actor_branch = public.get_my_branch())
    or (actor_username = public.get_my_username())
  );

drop policy if exists audit_logs_insert_policy on public.audit_logs;
create policy audit_logs_insert_policy on public.audit_logs
  for insert to authenticated
  with check (
    actor_id = auth.uid() or actor_id is null
  );

drop policy if exists audit_logs_update_policy on public.audit_logs;
create policy audit_logs_update_policy on public.audit_logs
  for update to authenticated
  using (false);

drop policy if exists audit_logs_delete_policy on public.audit_logs;
create policy audit_logs_delete_policy on public.audit_logs
  for delete to authenticated
  using (false);

grant select, insert on table public.audit_logs to authenticated;

-- ------------------------------------------------------------------------------
-- Políticas para 'storage.objects' (Bucket 'receipts')
-- ------------------------------------------------------------------------------
drop policy if exists receipts_select_policy on storage.objects;
create policy receipts_select_policy on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts');

drop policy if exists receipts_insert_policy on storage.objects;
create policy receipts_insert_policy on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts');

drop policy if exists receipts_update_policy on storage.objects;
create policy receipts_update_policy on storage.objects
  for update to authenticated
  using (bucket_id = 'receipts');

drop policy if exists receipts_delete_policy on storage.objects;
create policy receipts_delete_policy on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'receipts'
    and (public.get_my_role() = 'admin' and (public.get_my_branch() is null or public.get_my_branch() = ''))
  );

-- ==============================================================================
-- Fin del Esquema Consolidado
-- ==============================================================================
