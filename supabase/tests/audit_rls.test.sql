-- ==============================================================================
-- PagoCheck - Test Suite: RLS e Inmutabilidad en audit_logs
-- ==============================================================================
-- Ejecutar en Supabase SQL Editor o con 'supabase test db' (pgTAP)
-- ==============================================================================

begin;

-- 1. Verificar que RLS está habilitado en audit_logs
do $$
begin
  assert (
    select relrowsecurity
    from pg_class
    where oid = 'public.audit_logs'::regclass
  ), 'ERROR: RLS no está habilitado en public.audit_logs';
end $$;

-- 2. Verificar que nadie puede modificar ni eliminar registros de auditoría (Inmutabilidad)
do $$
declare
  v_policies text[];
begin
  select array_agg(policyname::text) into v_policies
  from pg_policies
  where schemaname = 'public' and tablename = 'audit_logs';

  assert 'audit_logs_update_policy' = any(v_policies), 'Falta audit_logs_update_policy';
  assert 'audit_logs_delete_policy' = any(v_policies), 'Falta audit_logs_delete_policy';
  assert 'audit_logs_select_policy' = any(v_policies), 'Falta audit_logs_select_policy';
  assert 'audit_logs_insert_policy' = any(v_policies), 'Falta audit_logs_insert_policy';
end $$;

-- 3. Verificar que verify_login y change_user_password ya no existen
do $$
declare
  v_count int;
begin
  select count(*) into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('verify_login', 'change_user_password');

  assert v_count = 0, 'ERROR: verify_login o change_user_password todavía existen en pg_proc';
end $$;

rollback;
