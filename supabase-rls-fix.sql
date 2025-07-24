-- SQL para corregir problemas de RLS en la tabla favorites
-- Ejecuta este script en el editor SQL de tu proyecto Supabase

-- 1. Verificar si la tabla existe y mostrar su estructura actual
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'favorites' 
ORDER BY ordinal_position;

-- 2. Mostrar políticas actuales
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual, 
  with_check
FROM pg_policies 
WHERE tablename = 'favorites';

-- 3. Eliminar TODAS las políticas existentes (fuerza la eliminación)
DO $$ 
DECLARE 
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'favorites' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.favorites', policy_record.policyname);
    END LOOP;
END $$;

-- 4. Verificar que la tabla existe, si no crearla
CREATE TABLE IF NOT EXISTS public.favorites (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_title TEXT NOT NULL,
  movie_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, movie_title)
);

-- 5. Deshabilitar RLS temporalmente para limpiar
ALTER TABLE public.favorites DISABLE ROW LEVEL SECURITY;

-- 6. Habilitar RLS nuevamente
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- 7. Crear políticas RLS con nombres únicos y condiciones explícitas
CREATE POLICY "favorites_select_policy" ON public.favorites
  FOR SELECT 
  TO authenticated 
  USING (user_id = auth.uid());

CREATE POLICY "favorites_insert_policy" ON public.favorites
  FOR INSERT 
  TO authenticated 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "favorites_update_policy" ON public.favorites
  FOR UPDATE 
  TO authenticated 
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "favorites_delete_policy" ON public.favorites
  FOR DELETE 
  TO authenticated 
  USING (user_id = auth.uid());

-- 8. Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_movie_title ON public.favorites(movie_title);

-- 9. Verificar que las políticas fueron creadas correctamente
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual, 
  with_check
FROM pg_policies 
WHERE tablename = 'favorites' AND schemaname = 'public';

-- 10. Verificar estructura de la tabla final
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'favorites' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 11. Verificar que RLS está habilitado
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE tablename = 'favorites' AND schemaname = 'public';

-- 12. Prueba de funcionamiento (opcional - ejecutar solo si quieres probar)
-- NOTA: Descomenta las siguientes líneas solo para probar
-- INSERT INTO public.favorites (user_id, movie_title, movie_data) 
-- VALUES (auth.uid(), 'TEST_MOVIE', '{"test": true}');
-- SELECT * FROM public.favorites WHERE user_id = auth.uid();
-- DELETE FROM public.favorites WHERE movie_title = 'TEST_MOVIE' AND user_id = auth.uid();
