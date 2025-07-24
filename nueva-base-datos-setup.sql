-- SCRIPT PARA NUEVA BASE DE DATOS SUPABASE
-- Crear tabla favorites SIN problemas de RLS

-- 1. Crear tabla favorites
CREATE TABLE public.favorites (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_title TEXT NOT NULL,
  movie_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, movie_title)
);

-- 2. NO habilitar RLS (dejar sin seguridad por ahora)
-- ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY; <-- NO ejecutar esto

-- 3. Crear índices para rendimiento
CREATE INDEX idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX idx_favorites_movie_title ON public.favorites(movie_title);

-- 4. Verificar que se creó correctamente
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'favorites' 
ORDER BY ordinal_position;

-- 5. Verificar que RLS está DESHABILITADO
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE tablename = 'favorites';
-- Debería mostrar rowsecurity = false
