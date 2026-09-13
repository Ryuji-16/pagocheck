-- ==============================================================================
-- PagoCheck - Fase 1: Blindaje de Seguridad y Grants Mínimos
-- ==============================================================================
-- Objetivo: Cerrar accesos abiertos de 'anon', definir políticas CRUD explícitas
-- y preparar la infraestructura para Supabase Auth sin romper el flujo actual.
-- ==============================================================================

-- 1. Permisos base del esquema public
grant usage on schema public to anon, authenticated;

-- ==============================================================================
-- 2. Tabla 'movements': Revocar accesos automáticos y definir RLS granular
-- ==============================================================================
alter table public.movements enable row level security;

-- Revocar cualquier acceso amplio residual concedido por defecto
revoke all on table public.movements from anon, public;

-- Eliminar políticas abiertas previas (que permitían a anon leer/escribir con 'status is not null')
drop policy if exists movements_read on public.movements;
drop policy if exists movements_insert on public.movements;
drop policy if exists movements_select_policy on public.movements;
drop policy if exists movements_insert_policy on public.movements;
drop policy if exists movements_update_policy on public.movements;
drop policy if exists movements_delete_policy on public.movements;

-- Política de LECTURA: Solo usuarios autenticados
create policy movements_select_policy on public.movements
  for select
  to authenticated
  using (true);

-- Política de INSERCIÓN: Solo usuarios autenticados con campos mínimos requeridos
create policy movements_insert_policy on public.movements
  for insert
  to authenticated
  with check (
    type is not null and
    amount is not null
  );

-- Política de ACTUALIZACIÓN: Bloqueada por defecto para clientes (solo server-side / admin)
create policy movements_update_policy on public.movements
  for update
  to authenticated
  using (false);

-- Política de ELIMINACIÓN: Bloqueada para clientes directos
create policy movements_delete_policy on public.movements
  for delete
  to authenticated
  using (false);

-- Conceder únicamente SELECT e INSERT a usuarios autenticados
grant select, insert on table public.movements to authenticated;

-- ==============================================================================
-- 3. Tabla 'app_users' (Tabla legacy de transición)
-- ==============================================================================
alter table public.app_users enable row level security;

-- Cerrar cualquier acceso directo a nivel de tabla para anon y public
revoke all on table public.app_users from anon, public;
drop policy if exists app_users_read on public.app_users;
drop policy if exists app_users_update on public.app_users;

-- ==============================================================================
-- 4. Funciones RPC: Prevenir Secuestro de Search Path (search_path hijacking)
-- ==============================================================================

-- Función de login de transición (con search_path estricto)
create or replace function public.verify_login(p_username text, p_password_hash text)
returns table(username text, role text, label text, branch text)
language plpgsql
security definer
set search_path = public, pg_temp as $$
begin
  -- Validación básica de parámetros para evitar consumo innecesario
  if p_username is null or p_password_hash is null or length(trim(p_username)) = 0 then
    return;
  end if;

  return query
  select u.username, u.role, u.label, u.branch
  from public.app_users u
  where lower(u.username) = lower(trim(p_username))
    and u.password_hash = p_password_hash;
end;
$$;

-- Función de cambio de clave protegida
create or replace function public.change_user_password(p_username text, p_old_hash text, p_new_hash text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp as $$
declare
  v_updated boolean := false;
begin
  if p_username is null or p_old_hash is null or p_new_hash is null then
    return false;
  end if;

  update public.app_users
  set password_hash = p_new_hash
  where lower(username) = lower(trim(p_username))
    and password_hash = p_old_hash;

  if found then
    v_updated := true;
  end if;
  return v_updated;
end;
$$;

-- verify_login debe seguir accesible a anon durante la Fase 1 para el login actual
grant execute on function public.verify_login(text, text) to anon, authenticated;

-- change_user_password se revoca de anon: nadie debe cambiar claves anónimamente
revoke execute on function public.change_user_password(text, text, text) from anon, public;
grant execute on function public.change_user_password(text, text, text) to authenticated;

-- ==============================================================================
-- 5. Preparación de 'public.profiles' para Fase 2 (Enlazada a auth.users)
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

alter table public.profiles enable row level security;

-- Revocar accesos por defecto a anon
revoke all on table public.profiles from anon, public;

-- Políticas RLS para profiles
drop policy if exists profiles_select_policy on public.profiles;
create policy profiles_select_policy on public.profiles
  for select
  to authenticated
  using (true);

drop policy if exists profiles_update_policy on public.profiles;
create policy profiles_update_policy on public.profiles
  for update
  to authenticated
  using (auth.uid() = id);

grant select on table public.profiles to authenticated;
grant update (label, updated_at) on table public.profiles to authenticated;

-- Comentario informativo en base de datos
comment on table public.profiles is 'Perfiles de empleados y operadores vinculados a auth.users (Fase 2).';
comment on table public.movements is 'Registro de transacciones con RLS blindado a nivel de BD.';
