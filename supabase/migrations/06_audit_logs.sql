-- ==============================================================================
-- PagoCheck - Fase 9: Bitácora Inmutable de Auditoría y Observabilidad (audit_logs)
-- ==============================================================================
-- Objetivo: Proporcionar trazabilidad forense inmutable de todas las verificaciones
-- bancarias, intentos de duplicados, operaciones de vuelto y eventos de seguridad.
-- ==============================================================================

-- 1. Crear tabla 'public.audit_logs'
create table if not exists public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_username text,
  actor_branch text,
  action text not null,
  entity_type text,
  entity_id text,
  status text not null check (status in ('success', 'warning', 'error', 'info')),
  details jsonb default '{}'::jsonb,
  duration_ms integer
);

-- Comentarios de documentación en base de datos
comment on table public.audit_logs is 'Bitácora inmutable de eventos críticos de negocio, verificaciones bancarias y seguridad.';
comment on column public.audit_logs.action is 'Código de evento: VERIFY_ATTEMPT, VERIFY_CONFIRMED, VERIFY_NOT_FOUND, VERIFY_ERROR, VERIFY_DUPLICATE_BLOCKED, VUELTO_ISSUED, etc.';
comment on column public.audit_logs.duration_ms is 'Latencia de respuesta de la pasarela bancaria o Edge Function en milisegundos.';

-- ==============================================================================
-- 2. Índices de Rendimiento y Búsqueda
-- ==============================================================================
create index if not exists idx_audit_logs_created_at
  on public.audit_logs (created_at desc);

create index if not exists idx_audit_logs_branch_created
  on public.audit_logs (actor_branch, created_at desc);

create index if not exists idx_audit_logs_action
  on public.audit_logs (action, created_at desc);

create index if not exists idx_audit_logs_entity
  on public.audit_logs (entity_type, entity_id);

-- ==============================================================================
-- 3. Inmutabilidad y Permisos Estrictos (Anti-Tampering)
-- ==============================================================================
-- Asegurar que la tabla tenga Row Level Security activado
alter table public.audit_logs enable row level security;

-- Revocar explícitamente UPDATE y DELETE para garantizar inmutabilidad
revoke update, delete on public.audit_logs from anon, authenticated;

-- Revocar cualquier acceso a anónimos
revoke all on public.audit_logs from anon;

-- Otorgar solo INSERT y SELECT al rol autenticado
grant select, insert on public.audit_logs to authenticated;

-- ==============================================================================
-- 4. Políticas RLS para 'public.audit_logs'
-- ==============================================================================
drop policy if exists audit_logs_insert_policy on public.audit_logs;
drop policy if exists audit_logs_select_policy on public.audit_logs;

-- Política de INSERCIÓN: Cualquier usuario autenticado puede insertar logs de auditoría
-- vinculados a su propia sesión
create policy audit_logs_insert_policy
  on public.audit_logs
  for insert
  to authenticated
  with check (
    actor_id = auth.uid() or actor_id is null
  );

-- Política de LECTURA (SELECT):
-- - 'admin' (dueño): Visibilidad consolidada de todos los eventos del negocio.
-- - 'admin_sucursal': Visibilidad estricta únicamente de los eventos de su sucursal.
-- - 'cajero': No tiene acceso de lectura a la bitácora general de seguridad.
create policy audit_logs_select_policy
  on public.audit_logs
  for select
  to authenticated
  using (
    public.get_my_role() = 'admin'
    or (
      public.get_my_role() in ('admin_sucursal', 'admin_tienda')
      and actor_branch = public.get_my_branch()
    )
  );
