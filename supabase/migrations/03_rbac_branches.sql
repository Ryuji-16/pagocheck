-- ==============================================================================
-- PagoCheck - Fase 3: RBAC y Aislamiento Multi-Sucursal (DB-Level Enforcement)
-- ==============================================================================
-- Objetivo: Garantizar que la autorización y el aislamiento por sucursal se
-- ejecuten directamente en PostgreSQL mediante Row Level Security (RLS).
-- ==============================================================================

-- 1. Funciones auxiliares para consulta de identidad en RLS (rápidas, STABLE y seguras)
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.get_my_branch()
returns text
language sql
stable
security definer
set search_path = public, pg_temp as $$
  select branch from public.profiles where id = auth.uid();
$$;

create or replace function public.get_my_username()
returns text
language sql
stable
security definer
set search_path = public, pg_temp as $$
  select username from public.profiles where id = auth.uid();
$$;

grant execute on function public.get_my_role() to authenticated;
grant execute on function public.get_my_branch() to authenticated;
grant execute on function public.get_my_username() to authenticated;

-- ==============================================================================
-- 2. Políticas RLS Estrictas para 'public.movements'
-- ==============================================================================

-- Eliminar políticas previas más permisivas
drop policy if exists movements_select_policy on public.movements;
drop policy if exists movements_insert_policy on public.movements;

-- Política de LECTURA (SELECT):
-- - El Dueño de la empresa (admin sin sucursal fija) tiene visibilidad consolidada total.
-- - El Admin de sucursal solo ve transacciones de su sucursal.
-- - El Cajero solo ve transacciones de su sucursal asignada.
-- - El Bot tiene acceso a operaciones de delivery / bot.
create policy movements_select_policy on public.movements
  for select
  to authenticated
  using (
    -- 1. Dueño / Administrador General (sin sucursal fija asignada)
    (public.get_my_role() = 'admin' and public.get_my_branch() is null)
    or
    -- 2. Administrador de Sucursal (ve toda su tienda)
    (public.get_my_role() = 'admin' and branch = public.get_my_branch())
    or
    -- 3. Cajero (ve movimientos de su sucursal)
    (public.get_my_role() = 'caja' and branch = public.get_my_branch())
    or
    -- 4. Bot / WhatsApp (ve movimientos de delivery)
    (public.get_my_role() = 'bot')
  );

-- Política de INSERCIÓN (INSERT):
-- - Impide que un usuario registre transacciones en otra sucursal distinta a la suya.
-- - Impide que un cajero suplante el nombre de usuario de otro cajero.
create policy movements_insert_policy on public.movements
  for insert
  to authenticated
  with check (
    -- Campos mínimos obligatorios
    type is not null and
    amount is not null and
    -- Restricción de sucursal: solo su sucursal asignada (salvo el Dueño general)
    (public.get_my_branch() is null or branch = public.get_my_branch()) and
    -- Restricción de autoría: el username debe coincidir con el autenticado (salvo administradores)
    (public.get_my_role() = 'admin' or lower(username) = lower(public.get_my_username()))
  );

-- 3. Actualizar políticas de lectura de perfiles para respetar RBAC
drop policy if exists profiles_select_policy on public.profiles;
create policy profiles_select_policy on public.profiles
  for select
  to authenticated
  using (
    -- Dueño ve todos los perfiles
    (public.get_my_role() = 'admin' and public.get_my_branch() is null)
    or
    -- Admin de sucursal ve los perfiles de su propia tienda
    (public.get_my_role() = 'admin' and branch = public.get_my_branch())
    or
    -- Usuarios regulares ven su propio perfil o compañeros de la misma sucursal
    (branch = public.get_my_branch() or id = auth.uid())
  );
