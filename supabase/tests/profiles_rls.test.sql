-- ==============================================================================
-- PagoCheck - Test Suite: RLS en profiles
-- ==============================================================================
-- Ejecutar en Supabase SQL Editor o con 'supabase test db' (pgTAP)
-- ==============================================================================

begin;

-- 1. Verificar que RLS está habilitado en profiles
do $$
begin
  assert (
    select relrowsecurity
    from pg_class
    where oid = 'public.profiles'::regclass
  ), 'ERROR: RLS no está habilitado en public.profiles';
end $$;

-- 2. Verificar que 'anon' no puede acceder a profiles
do $$
begin
  assert not has_table_privilege('anon', 'public.profiles', 'INSERT'),
    'ERROR: anon no debe tener permisos de INSERT en profiles';
  assert not has_table_privilege('anon', 'public.profiles', 'UPDATE'),
    'ERROR: anon no debe tener permisos de UPDATE en profiles';
  assert not has_table_privilege('anon', 'public.profiles', 'DELETE'),
    'ERROR: anon no debe tener permisos de DELETE en profiles';
end $$;

-- 3. Verificar que las políticas de profiles existen
do $$
declare
  v_policies text[];
begin
  select array_agg(policyname::text) into v_policies
  from pg_policies
  where schemaname = 'public' and tablename = 'profiles';

  assert 'profiles_select_policy' = any(v_policies), 'Falta profiles_select_policy';
  assert 'profiles_update_policy' = any(v_policies), 'Falta profiles_update_policy';
end $$;

-- 4. Verificar que la tabla app_users ya no existe
do $$
begin
  assert to_regclass('public.app_users') is null,
    'ERROR: public.app_users todavía existe en la base de datos';
end $$;

rollback;
