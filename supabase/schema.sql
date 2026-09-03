-- PagoCheck: usuarios y movimientos.
-- Pegar esto en Supabase → SQL Editor → Run.

create table if not exists public.app_users (
  username text primary key,
  password_hash text not null,
  role text not null check (role in ('caja', 'admin')),
  label text not null
);

create table if not exists public.movements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  username text not null,
  label text,
  type text not null,
  status text,
  amount text,
  reference text,
  phone text,
  bank text,
  cedula text,
  note text
);

alter table public.app_users enable row level security;
alter table public.movements enable row level security;

drop policy if exists app_users_read on public.app_users;
create policy app_users_read on public.app_users
  for select to anon using (true);

drop policy if exists app_users_update on public.app_users;
create policy app_users_update on public.app_users
  for update to anon using (true) with check (true);

drop policy if exists movements_read on public.movements;
create policy movements_read on public.movements
  for select to anon using (true);

drop policy if exists movements_insert on public.movements;
create policy movements_insert on public.movements
  for insert to anon with check (true);

insert into public.app_users (username, password_hash, role, label) values
  ('demo',  'a814881dabd0110183e7e0c8b18e025be9d42425faad5fb9c095c05ce6463ae0', 'caja',  'Prueba'),
  ('caja1', '718f5e902521aa92b7b67969bee4f942cf7707f67267bed775b1f6cbaa8c37a9', 'caja',  'Caja 1'),
  ('caja2', 'b6ce1f832308579039e8186583d08923767ef782c8584838b1cb343eda48df68', 'caja',  'Caja 2'),
  ('caja3', 'e5f8af6baeb3ea76bcbd07ea6c6f892505c01ff1c7aca5edf9fb6f7dabbc8023', 'caja',  'Caja 3'),
  ('admin', '2cafd21f5b0069e302c5f1f48def2dc1a08d01a7154a6e762ba9a901cafa4cf4', 'admin', 'Admin de tienda')
on conflict (username) do nothing;
