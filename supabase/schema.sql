-- PagoCheck: usuarios y movimientos.
-- Pegar esto en Supabase → SQL Editor → Run.

create table if not exists public.app_users (
  username text primary key,
  password_hash text not null,
  role text not null check (role in ('caja', 'admin', 'bot')),
  label text not null,
  branch text
);

create table if not exists public.movements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  username text not null,
  label text,
  branch text,
  type text not null,
  status text,
  amount text,
  reference text,
  phone text,
  bank text,
  cedula text,
  note text,
  receipt_image text
);

alter table public.movements add column if not exists branch text;
alter table public.movements add column if not exists receipt_image text;
alter table public.app_users add column if not exists branch text;
alter table public.app_users drop constraint if exists app_users_role_check;
alter table public.app_users add constraint app_users_role_check check (role in ('caja', 'admin', 'bot'));

alter table public.app_users enable row level security;
alter table public.movements enable row level security;

-- Restringir acceso directo a app_users: anon no debe hacer SELECT ni UPDATE directo sobre hashes de clave
drop policy if exists app_users_read on public.app_users;
drop policy if exists app_users_update on public.app_users;

drop policy if exists movements_read on public.movements;
create policy movements_read on public.movements
  for select to anon using (true);

drop policy if exists movements_insert on public.movements;
create policy movements_insert on public.movements
  for insert to anon with check (true);

-- 4. Funciones RPC seguras de login y cambio de clave (con search_path protegido)
create or replace function public.verify_login(p_username text, p_password_hash text)
returns table(username text, role text, label text, branch text)
language plpgsql security definer set search_path = public as $$
begin
  return query
  select u.username, u.role, u.label, u.branch
  from public.app_users u
  where lower(u.username) = lower(p_username)
    and u.password_hash = p_password_hash;
end;
$$;

create or replace function public.change_user_password(p_username text, p_old_hash text, p_new_hash text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_updated boolean := false;
begin
  update public.app_users
  set password_hash = p_new_hash
  where lower(username) = lower(p_username)
    and password_hash = p_old_hash;
  if found then
    v_updated := true;
  end if;
  return v_updated;
end;
$$;

grant execute on function public.verify_login(text, text) to anon, authenticated;
grant execute on function public.change_user_password(text, text, text) to anon, authenticated;


insert into public.app_users (username, password_hash, role, label, branch) values
  -- Tienda 1 (Centro)
  ('caja1', '718f5e902521aa92b7b67969bee4f942cf7707f67267bed775b1f6cbaa8c37a9', 'caja',  'Caja 1', 'Tienda 1 - Centro'),
  ('caja2', 'b6ce1f832308579039e8186583d08923767ef782c8584838b1cb343eda48df68', 'caja',  'Caja 2', 'Tienda 1 - Centro'),
  ('caja3', 'e5f8af6baeb3ea76bcbd07ea6c6f892505c01ff1c7aca5edf9fb6f7dabbc8023', 'caja',  'Caja 3', 'Tienda 1 - Centro'),
  -- Tienda 2 (Norte)
  ('t2_caja1', '718f5e902521aa92b7b67969bee4f942cf7707f67267bed775b1f6cbaa8c37a9', 'caja',  'Caja 1', 'Tienda 2 - Norte'),
  ('t2_caja2', 'b6ce1f832308579039e8186583d08923767ef782c8584838b1cb343eda48df68', 'caja',  'Caja 2', 'Tienda 2 - Norte'),
  ('t2_caja3', 'e5f8af6baeb3ea76bcbd07ea6c6f892505c01ff1c7aca5edf9fb6f7dabbc8023', 'caja',  'Caja 3', 'Tienda 2 - Norte'),
  -- Tienda 3 (Sur)
  ('t3_caja1', '718f5e902521aa92b7b67969bee4f942cf7707f67267bed775b1f6cbaa8c37a9', 'caja',  'Caja 1', 'Tienda 3 - Sur'),
  ('t3_caja2', 'b6ce1f832308579039e8186583d08923767ef782c8584838b1cb343eda48df68', 'caja',  'Caja 2', 'Tienda 3 - Sur'),
  ('t3_caja3', 'e5f8af6baeb3ea76bcbd07ea6c6f892505c01ff1c7aca5edf9fb6f7dabbc8023', 'caja',  'Caja 3', 'Tienda 3 - Sur'),
  -- Camión Móvil
  ('camion_caja1', '8eeb22ff4e24c432485075abfbbdc1fc22ee435b6d3b652f8f2d406e0f762b49', 'caja', 'Caja Móvil', 'Camión Móvil'),
  -- Administrador General
  ('admin', '2cafd21f5b0069e302c5f1f48def2dc1a08d01a7154a6e762ba9a901cafa4cf4', 'admin', 'Admin General', null)
on conflict (username) do update set
  branch = excluded.branch,
  label = excluded.label,
  role = excluded.role;

-- Cuenta de servicio para integración con Bot / WhatsApp
insert into public.app_users (username, password_hash, role, label, branch) values
  ('bot_service', 'dfde2a0423d2c1e4b741dddf0058d298e7e3b1a75354f6b8c192cd8f7b5866fa', 'bot', 'Asistente WhatsApp', 'WhatsApp / Delivery')
on conflict (username) do nothing;

-- Eliminar usuario demo y sus movimientos si existían
delete from public.app_users where username = 'demo';
delete from public.movements where username = 'demo';

