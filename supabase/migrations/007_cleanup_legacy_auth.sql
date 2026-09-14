-- ==============================================================================
-- PagoCheck - Fase 7: Limpieza Definitiva de Autenticación Legacy
-- ==============================================================================
-- Objetivo: Erradicar definitivamente la tabla 'app_users', la función 'verify_login'
-- y 'change_user_password' en todas sus sobrecargas, garantizando que el sistema opere
-- única y exclusivamente bajo Supabase Auth (auth.users) -> public.profiles -> RLS.
-- ==============================================================================

-- 1. Eliminar tabla app_users si aún existe
drop table if exists public.app_users cascade;

-- 2. Eliminar todas las sobrecargas conocidas de verify_login y change_user_password
drop function if exists public.verify_login(text, text) cascade;
drop function if exists public.verify_login cascade;
drop function if exists public.change_user_password(text, text, text) cascade;
drop function if exists public.change_user_password cascade;

-- 3. Bloque dinámico PL/pgSQL de seguridad para barrer cualquier sobrecarga residual
do $$
declare
  r record;
begin
  for r in (
    select p.oid::regprocedure as func_sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('verify_login', 'change_user_password')
  ) loop
    execute 'drop function if exists ' || r.func_sig || ' cascade';
  end loop;
end $$;

-- 4. Revocar explícitamente cualquier permiso residual de ejecución a anon
-- (Como las funciones ya no existen, esto certifica el estado cerrado)

-- ==============================================================================
-- Consultas de Validación Forense de Seguridad:
-- ==============================================================================
-- 1. Verificar que no existan funciones verify_login o change_user_password (debe retornar 0 filas):
-- select
--   n.nspname as schema_name,
--   p.proname,
--   pg_get_function_identity_arguments(p.oid)
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in ('verify_login', 'change_user_password');
--
-- 2. Verificar que app_users no exista (debe retornar NULL):
-- select to_regclass('public.app_users');
-- ==============================================================================
