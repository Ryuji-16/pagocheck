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
select public.seed_pago_user('caja1', 'caja1', 'caja', 'Caja 1', 'Tienda 1 (Bella Vista)');
select public.seed_pago_user('caja2', 'caja2', 'caja', 'Caja 2', 'Tienda 1 (Bella Vista)');
select public.seed_pago_user('caja3', 'caja3', 'caja', 'Caja 3', 'Tienda 1 (Bella Vista)');

-- Tienda 2 (Altamira)
select public.seed_pago_user('t2_caja1', 'caja1', 'caja', 'Caja 1', 'Tienda 2 (Altamira)');
select public.seed_pago_user('t2_caja2', 'caja2', 'caja', 'Caja 2', 'Tienda 2 (Altamira)');
select public.seed_pago_user('t2_caja3', 'caja3', 'caja', 'Caja 3', 'Tienda 2 (Altamira)');

-- Tienda 3 (La Trinidad)
select public.seed_pago_user('t3_caja1', 'caja1', 'caja', 'Caja 1', 'Tienda 3 (La Trinidad)');
select public.seed_pago_user('t3_caja2', 'caja2', 'caja', 'Caja 2', 'Tienda 3 (La Trinidad)');
select public.seed_pago_user('t3_caja3', 'caja3', 'caja', 'Caja 3', 'Tienda 3 (La Trinidad)');

-- Camión Móvil
select public.seed_pago_user('camion_caja1', 'camion', 'caja', 'Caja Móvil', 'Camión Móvil');

-- Servicio / Bot
select public.seed_pago_user('bot_service', 'bot', 'bot', 'Asistente WhatsApp', 'WhatsApp / Delivery');

-- Administrador General
select public.seed_pago_user('admin', 'admin123', 'admin', 'Admin General', null);

-- Limpieza preventiva: eliminar función de seed para que no quede expuesta
drop function if exists public.seed_pago_user(text, text, text, text, text);
