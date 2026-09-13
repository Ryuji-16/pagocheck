-- ==============================================================================
-- PagoCheck - Fase 4: Integridad de Base de Datos y Anti-Duplicados en PostgreSQL
-- ==============================================================================
-- Objetivo: Establecer a PostgreSQL como la autoridad final para prevenir
-- transacciones duplicadas e impedir estados de datos imposibles o inconsistentes.
-- ==============================================================================

-- 1. Agregar columna 'provider' para identificar el canal/proveedor bancario
alter table public.movements add column if not exists provider text not null default 'banesco';

-- 2. Restricciones CHECK para garantizar tipos y estados válidos
alter table public.movements drop constraint if exists movements_type_check;
alter table public.movements add constraint movements_type_check
  check (type in ('validacion', 'vuelto'));

alter table public.movements drop constraint if exists movements_status_check;
alter table public.movements add constraint movements_status_check
  check (status in ('confirmed', 'error', 'not-found', 'ok', 'pending'));

-- 3. Índice ÚNICO PARCIAL Anti-Duplicados (Autoridad Máxima en PostgreSQL)
-- Solo protege transacciones exitosas/confirmadas que tengan una referencia no vacía.
-- Permite reintentos si una operación previa falló por red ('not-found' o 'error').
drop index if exists public.movements_provider_bank_ref_idx;
create unique index movements_provider_bank_ref_idx
  on public.movements (
    lower(trim(provider)),
    lower(trim(bank)),
    lower(trim(reference))
  )
  where reference is not null and trim(reference) <> '' and status in ('confirmed', 'ok');

-- 4. Índices de Rendimiento para consultas y ordenamientos habituales
create index if not exists idx_movements_created_at
  on public.movements (created_at desc);

create index if not exists idx_movements_branch_created
  on public.movements (branch, created_at desc);

create index if not exists idx_movements_ref_lookup
  on public.movements (lower(trim(reference)));

-- Comentarios documentales en PostgreSQL
comment on index public.movements_provider_bank_ref_idx is 'Previene físicamente pagos duplicados para una misma referencia y banco en operaciones confirmadas.';
comment on column public.movements.provider is 'Proveedor o procesador bancario de la operación (ej: banesco, manual).';
