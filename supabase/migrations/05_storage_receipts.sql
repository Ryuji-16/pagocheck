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
