-- SCRIPT SUPER SIMPLE PARA ARREGLAR FAVORITOS
-- Ejecuta EXACTAMENTE esto en Supabase SQL Editor

-- 1. DESACTIVAR RLS COMPLETAMENTE (temporal)
ALTER TABLE public.favorites DISABLE ROW LEVEL SECURITY;

-- ¡YA ESTÁ! Ahora deberían funcionar los favoritos sin errores 403

-- Opcional: Verificar que se desactivó
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE tablename = 'favorites' AND schemaname = 'public';

-- Deberías ver: rowsecurity = false
