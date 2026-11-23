-- ============================================================================
-- RLS de Storage: cerrar la escritura anónima en los buckets `spirits` y
-- `accessories`.
-- ============================================================================
-- Problema: la clave anónima (la que va en el navegador) podía subir,
-- sobreescribir y borrar archivos del bucket `spirits` sin estar logueado.
--
-- Qué hace este script:
--   1. Crea el helper `public.is_admin()` (security definer) que comprueba
--      `usuarios.role = 'admin'` para el usuario autenticado.
--   2. Elimina las políticas de `storage.objects` que mencionan `spirits` o
--      `accessories`, y las políticas de escritura totalmente abiertas a
--      anon/public (esas son las que permitían escribir sin sesión).
--   3. Recrea lo necesario:
--        - `spirits/models/...`          → escribir solo admin
--        - `spirits/build_models/<uid>/…` → cada usuario su propia carpeta
--        - `accessories/...`             → escribir solo admin (packages.html)
--        - lectura/listado de `spirits`  → solo admin (botón Reparar caché)
--
-- Lo que NO cambia:
--   - Los objetos públicos se siguen leyendo por /storage/v1/object/public/…
--     (esa ruta no usa RLS), así que la web y el asistente funcionan igual.
--   - No toca ninguna tabla de la app (`spirits`, `usuarios`, etc.).
--
-- Ejecutar en Supabase → SQL Editor. Es idempotente.
-- ============================================================================

begin;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.usuarios
        where id = auth.uid()
          and role = 'admin'
    );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 1) Políticas que mencionan los buckets afectados (abiertas o no)
do $$
declare r record;
begin
    for r in
        select policyname
        from pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
          and (
                coalesce(qual, '') ilike '%spirits%'
             or coalesce(with_check, '') ilike '%spirits%'
             or policyname ilike '%spirit%'
             or coalesce(qual, '') ilike '%accessories%'
             or coalesce(with_check, '') ilike '%accessories%'
             or policyname ilike '%accessor%'
          )
    loop
        execute format('drop policy %I on storage.objects', r.policyname);
    end loop;
end $$;

-- 2) Políticas de escritura totalmente abiertas a anon/public (cualquier bucket)
do $$
declare r record;
begin
    for r in
        select policyname
        from pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
          and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
          and roles && array['anon', 'public']::name[]
          and coalesce(qual, 'true') = 'true'
          and coalesce(with_check, 'true') = 'true'
    loop
        execute format('drop policy %I on storage.objects', r.policyname);
    end loop;
end $$;

-- 3) Modelos 3D: escribir solo admin
drop policy if exists spirits_admin_models on storage.objects;
create policy spirits_admin_models on storage.objects
    for all to authenticated
    using (
        bucket_id = 'spirits'
        and split_part(name, '/', 1) = 'models'
        and public.is_admin()
    )
    with check (
        bucket_id = 'spirits'
        and split_part(name, '/', 1) = 'models'
        and public.is_admin()
    );

-- 4) Constructor 3D: cada usuario solo su carpeta build_models/<uid>/
drop policy if exists spirits_build_own on storage.objects;
create policy spirits_build_own on storage.objects
    for all to authenticated
    using (
        bucket_id = 'spirits'
        and split_part(name, '/', 1) = 'build_models'
        and split_part(name, '/', 2) = auth.uid()::text
    )
    with check (
        bucket_id = 'spirits'
        and split_part(name, '/', 1) = 'build_models'
        and split_part(name, '/', 2) = auth.uid()::text
    );

-- 5) Lectura/listado de spirits para el admin (botón "Reparar caché de modelos")
drop policy if exists spirits_admin_read on storage.objects;
create policy spirits_admin_read on storage.objects
    for select to authenticated
    using (bucket_id = 'spirits' and public.is_admin());

-- 6) Accesorios (packages.html, solo admin)
drop policy if exists accessories_admin on storage.objects;
create policy accessories_admin on storage.objects
    for all to authenticated
    using (bucket_id = 'accessories' and public.is_admin())
    with check (bucket_id = 'accessories' and public.is_admin());

commit;

-- Verificación: deben quedar solo las políticas de este script para estos
-- buckets (más las de otros buckets que no se han tocado).
select policyname, cmd, roles::text, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
