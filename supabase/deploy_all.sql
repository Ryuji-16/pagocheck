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
-- ==============================================================================
-- PagoCheck - Fase 2: Provisión de Usuarios Iniciales y Sincronización de Perfiles
-- ==============================================================================
-- Objetivo: Crear cuentas de cajeros y administradores en auth.users con contraseñas
-- encriptadas (bcrypt), sincronizar auth.identities y poblar la tabla public.profiles.
-- ==============================================================================

-- 1. Habilitar extensión pgcrypto para encriptación de contraseñas
create extension if not exists pgcrypto with schema extensions;

-- 2. Trigger automático para sincronizar nuevos usuarios de auth.users hacia public.profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp as $$
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

-- 3. Procedimiento auxiliar para registrar usuarios en Supabase Auth y Profiles
create or replace function public.seed_pago_user(
  p_username text,
  p_password text,
  p_role text,
  p_label text,
  p_branch text
)
returns void
language plpgsql
security definer
set search_path = public, extensions, auth as $$
declare
  v_email text := lower(trim(p_username)) || '@auth.pagocheck.com';
  v_user_id uuid;
  v_encrypted_pw text;
begin
  v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf', 10));

  -- Buscar si el usuario ya existe en auth.users
  select id into v_user_id from auth.users where lower(email) = lower(v_email);

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    -- Inserción en auth.users
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      v_encrypted_pw,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'username', lower(trim(p_username)),
        'role', p_role,
        'label', p_label,
        'branch', p_branch
      ),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    -- Inserción en auth.identities para autenticación con email/password
    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      v_user_id,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      v_user_id::text,
      now(),
      now(),
      now()
    );
  else
    -- Si ya existe, sincronizar credenciales y metadata
    update auth.users
    set encrypted_password = v_encrypted_pw,
        raw_user_meta_data = jsonb_build_object(
          'username', lower(trim(p_username)),
          'role', p_role,
          'label', p_label,
          'branch', p_branch
        ),
        updated_at = now()
    where id = v_user_id;
  end if;

  -- Asegurar sincronización en public.profiles
  insert into public.profiles (id, username, role, label, branch, active)
  values (v_user_id, lower(trim(p_username)), p_role, p_label, p_branch, true)
  on conflict (id) do update set
    username = excluded.username,
    role = excluded.role,
    label = excluded.label,
    branch = excluded.branch,
    active = excluded.active,
    updated_at = now();
end;
$$;

-- 4. Semilla de cuentas del sistema
-- Tienda 1 (Bella Vista)
select public.seed_pago_user('admin_t1', 'admin1', 'admin', 'Admin Bella Vista', 'Tienda 1 (Bella Vista)');
select public.seed_pago_user('caja1', 'caja1', 'caja', 'Caja 1', 'Tienda 1 (Bella Vista)');
select public.seed_pago_user('caja2', 'caja2', 'caja', 'Caja 2', 'Tienda 1 (Bella Vista)');
select public.seed_pago_user('caja3', 'caja3', 'caja', 'Caja 3', 'Tienda 1 (Bella Vista)');

-- Tienda 2 (Altamira)
select public.seed_pago_user('admin_t2', 'admin2', 'admin', 'Admin Altamira', 'Tienda 2 (Altamira)');
select public.seed_pago_user('t2_caja1', 'caja1', 'caja', 'Caja 1', 'Tienda 2 (Altamira)');
select public.seed_pago_user('t2_caja2', 'caja2', 'caja', 'Caja 2', 'Tienda 2 (Altamira)');
select public.seed_pago_user('t2_caja3', 'caja3', 'caja', 'Caja 3', 'Tienda 2 (Altamira)');

-- Tienda 3 (La Trinidad)
select public.seed_pago_user('admin_t3', 'admin3', 'admin', 'Admin La Trinidad', 'Tienda 3 (La Trinidad)');
select public.seed_pago_user('t3_caja1', 'caja1', 'caja', 'Caja 1', 'Tienda 3 (La Trinidad)');
select public.seed_pago_user('t3_caja2', 'caja2', 'caja', 'Caja 2', 'Tienda 3 (La Trinidad)');
select public.seed_pago_user('t3_caja3', 'caja3', 'caja', 'Caja 3', 'Tienda 3 (La Trinidad)');

-- Camión Móvil
select public.seed_pago_user('admin_camion', 'admincamion', 'admin', 'Admin Camión', 'Camión Móvil');
select public.seed_pago_user('camion_caja1', 'camion', 'caja', 'Caja Móvil', 'Camión Móvil');

-- Servicio / Bot
select public.seed_pago_user('bot_service', 'bot', 'bot', 'Asistente WhatsApp', 'WhatsApp / Delivery');

-- Dueño de la Empresa (Administrador General de todas las sucursales)
select public.seed_pago_user('admin', 'admin123', 'admin', 'Dueño / Admin General', null);

-- Limpieza preventiva: eliminar función de seed para que no quede expuesta
drop function if exists public.seed_pago_user(text, text, text, text, text);
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
-- ==============================================================================
-- PagoCheck - Fase 4: Integridad de Base de Datos y Anti-Duplicados en PostgreSQL
-- ==============================================================================
-- Objetivo: Establecer a PostgreSQL como la autoridad final para prevenir
-- transacciones duplicadas e impedir estados de datos imposibles o inconsistentes.
-- ==============================================================================

-- 1. Agregar columna 'provider' para identificar el canal bancario
alter table public.movements add column if not exists provider text not null default 'banesco';

-- 2. Normalizar registros existentes antes de aplicar los constraints
update public.movements
set status = case
  when lower(trim(coalesce(status, ''))) in ('confirmed', 'confirmado', 'ok', 'exitoso', 'success') then 'confirmed'
  when lower(trim(coalesce(status, ''))) in ('simulado', 'vuelto_simulado') then 'simulado'
  when lower(trim(coalesce(status, ''))) in ('not-found', 'not_found', 'no_encontrado') then 'not-found'
  when lower(trim(coalesce(status, ''))) in ('error', 'fallido') then 'error'
  when lower(trim(coalesce(status, ''))) in ('pending', 'pendiente') then 'pending'
  else 'confirmed'
end
where status is null or status not in ('confirmed', 'simulado', 'not-found', 'error', 'ok', 'pending');

update public.movements
set type = case
  when lower(trim(coalesce(type, ''))) in ('vuelto', 'cambio') then 'vuelto'
  else 'validacion'
end
where type is null or type not in ('validacion', 'vuelto');

-- 3. Restricciones CHECK para garantizar tipos y estados válidos
alter table public.movements drop constraint if exists movements_type_check;
alter table public.movements add constraint movements_type_check
  check (type in ('validacion', 'vuelto'));

alter table public.movements drop constraint if exists movements_status_check;
alter table public.movements add constraint movements_status_check
  check (status in ('confirmed', 'simulado', 'not-found', 'error', 'ok', 'pending'));

-- 4. Índice ÚNICO PARCIAL Anti-Duplicados (Autoridad Máxima en PostgreSQL)
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

-- 5. Índices de Rendimiento para consultas y ordenamientos habituales
create index if not exists idx_movements_created_at
  on public.movements (created_at desc);

create index if not exists idx_movements_branch_created
  on public.movements (branch, created_at desc);

create index if not exists idx_movements_ref_lookup
  on public.movements (lower(trim(reference)));

-- Comentarios documentales en PostgreSQL
comment on index public.movements_provider_bank_ref_idx is 'Previene físicamente pagos duplicados para una misma referencia y banco en operaciones confirmadas.';
comment on column public.movements.provider is 'Proveedor o procesador bancario de la operación (ej: banesco, manual).';
-- ============================================================================
-- PagoCheck - Migración 05: Configuración de Storage y Políticas de Comprobantes
-- ============================================================================

-- 1. Crear o actualizar el bucket privado 'receipts'
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  5242880, -- 5 MB máximo por comprobante
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

-- 2. Eliminar políticas previas si existían
drop policy if exists "Authenticated users can upload receipts" on storage.objects;
drop policy if exists "Users can view authorized receipts" on storage.objects;
drop policy if exists "Admins can delete receipts" on storage.objects;

-- 3. Política de Subida (INSERT)
-- Cualquier usuario autenticado (cajero, admin, bot) puede subir comprobantes al bucket receipts
create policy "Authenticated users can upload receipts"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'receipts'
);

-- 4. Política de Lectura (SELECT)
-- - El usuario que subió la imagen (owner/owner_id) siempre tiene acceso.
-- - El dueño general (admin) tiene acceso a todos los comprobantes.
-- - Los cajeros y administradores de sucursal acceden a comprobantes vinculados
--   a movimientos que su RLS les permite ver.
create policy "Users can view authorized receipts"
on storage.objects for select
to authenticated
using (
  bucket_id = 'receipts'
  and (
    -- Usuario que subió el objeto (compatible con auth.uid() en owner o owner_id)
    (auth.uid() is not null and (auth.uid() = owner or auth.uid()::text = owner_id))
    -- Dueño general (sin sucursal fija o username admin)
    or public.get_my_username() = 'admin'
    or (public.get_my_role() = 'admin' and public.get_my_branch() is null)
    -- Enlazado a un movimiento visible en la sucursal del usuario
    or exists (
      select 1 from public.movements m
      where m.receipt_image = storage.objects.name
    )
  )
);

-- 5. Política de Eliminación (DELETE)
-- Solo el dueño general o administradores pueden eliminar comprobantes
create policy "Admins can delete receipts"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'receipts'
  and (
    public.get_my_username() = 'admin'
    or (public.get_my_role() = 'admin' and public.get_my_branch() is null)
  )
);
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
