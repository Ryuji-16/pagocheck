-- ==============================================================================
-- PagoCheck - Test Suite: RLS en movements
-- ==============================================================================
-- Ejecutar en Supabase SQL Editor o con 'supabase test db' (pgTAP)
-- ==============================================================================

begin;

-- 1. Verificar que RLS está habilitado en movements
do $$
begin
  assert (
    select relrowsecurity
    from pg_class
    where oid = 'public.movements'::regclass
  ), 'ERROR: RLS no está habilitado en public.movements';
end $$;

-- 2. Verificar que 'anon' no tiene grants de escritura directa
do $$
begin
  assert not has_table_privilege('anon', 'public.movements', 'INSERT'),
    'ERROR: anon no debe tener permisos de INSERT en movements';
  assert not has_table_privilege('anon', 'public.movements', 'UPDATE'),
    'ERROR: anon no debe tener permisos de UPDATE en movements';
  assert not has_table_privilege('anon', 'public.movements', 'DELETE'),
    'ERROR: anon no debe tener permisos de DELETE en movements';
end $$;

-- 3. Verificar que las políticas RLS requeridas existen
do $$
declare
  v_policies text[];
begin
  select array_agg(policyname::text) into v_policies
  from pg_policies
  where schemaname = 'public' and tablename = 'movements';

  assert 'movements_select_policy' = any(v_policies), 'Falta movements_select_policy';
  assert 'movements_insert_policy' = any(v_policies), 'Falta movements_insert_policy';
  assert 'movements_update_policy' = any(v_policies), 'Falta movements_update_policy';
  assert 'movements_delete_policy' = any(v_policies), 'Falta movements_delete_policy';
end $$;

-- 4. Verificar existencia del índice único anti-duplicados
do $$
begin
  assert exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'movements'
      and indexname = 'movements_unique_confirmed_reference'
  ), 'ERROR: Falta el índice único movements_unique_confirmed_reference';
end $$;

rollback;
